/** @jest-environment node */
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { POST } from "@/app/api/interviews/commands/route";
import { GET as getAccess } from "@/app/api/interviews/access/route";
import { GET as getRounds } from "@/app/api/interviews/rounds/route";
import { createClient as createCookieClient } from "@/shared/lib/supabase/server-ssr";
import { createClient } from "@supabase/supabase-js";
import {
  resolveInterviewActor,
  createInterviewServiceClient,
} from "../context";

jest.mock("@/shared/lib/supabase/server-ssr", () => ({
  createClient: jest.fn(),
}));
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/sentry/instrument-supabase-client", () => ({
  instrumentSupabaseClient: <T>(client: T) => client,
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({
  captureApiError: jest.fn(),
}));
jest.mock("@altitutor/shared", () =>
  jest.requireActual("@altitutor/shared/interviews/validation"),
);

const actorId = "11111111-1111-4111-8111-111111111111";
const roundId = "22222222-2222-4222-8222-222222222222";
const commandId = "33333333-3333-4333-8333-333333333333";
const heartbeat = { type: "heartbeat", commandId, roundId };
const serviceRpc = jest.fn();
const maybeSingle = jest.fn();
const select = jest.fn();
const from = jest.fn();
const getUser = jest.fn();
function request(
  body: unknown = heartbeat,
  headers: Record<string, string> = {},
) {
  return new Request("https://portal.test/api/interviews/commands", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test-key";
  getUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  maybeSingle.mockResolvedValue({ data: { has_access: true }, error: null });
  select.mockReturnValue({ maybeSingle });
  from.mockReturnValue({ select });
  jest
    .mocked(createCookieClient)
    .mockReturnValue({ auth: { getUser }, from } as unknown as ReturnType<
      typeof createCookieClient
    >);
  serviceRpc.mockResolvedValue({
    data: { id: roundId, version: 2 },
    error: null,
  });
  jest
    .mocked(createClient)
    .mockReturnValue({ rpc: serviceRpc } as unknown as ReturnType<
      typeof createClient
    >);
});

describe("student interview HTTP boundary", () => {
  it("rejects an unauthenticated command before requesting a service client", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "expired" },
    });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });
  it("reports zero enrolment/subject access and denies commands", async () => {
    maybeSingle.mockResolvedValue({ data: { has_access: false }, error: null });
    expect(
      await (
        await getAccess(
          new Request("https://portal.test/api/interviews/access"),
        )
      ).json(),
    ).toEqual({ hasAccess: false });
    expect((await POST(request())).status).toBe(403);
    expect(serviceRpc).not.toHaveBeenCalled();
  });
  it("rejects malformed commands without invoking the database write", async () => {
    expect(
      (
        await POST(
          request({ type: "heartbeat", roundId: "not-a-uuid", commandId }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await POST(request({ type: "invented", roundId, commandId }))).status,
    ).toBe(400);
    expect(serviceRpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin, non-JSON and oversized requests", async () => {
    expect(
      (await POST(request(heartbeat, { origin: "https://attacker.test" })))
        .status,
    ).toBe(403);
    expect(
      (await POST(request(heartbeat, { "content-type": "text/plain" }))).status,
    ).toBe(415);
    expect(
      (await POST(request(heartbeat, { "content-length": "1048577" }))).status,
    ).toBe(413);
    expect(serviceRpc).not.toHaveBeenCalled();
  });
  it("uses the verified actor instead of caller-supplied identity and disables caching", async () => {
    const body = { ...heartbeat, actorId: "forged-actor" };
    const response = await POST(request(body));
    expect(jest.mocked(captureApiError).mock.calls).toEqual([]);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(serviceRpc).toHaveBeenCalledWith("interview_command", {
      p_actor_user_id: actorId,
      p_command: body,
    });
  });
  it("returns optimistic concurrency conflict without claiming a successful save", async () => {
    serviceRpc.mockResolvedValue({
      data: null,
      error: {
        code: "PT409",
        message: "Interview changed. Refresh and retry.",
      },
    });
    expect((await POST(request())).status).toBe(409);
  });
  it("reads rounds through the actor-scoped view", async () => {
    select.mockImplementation(() => ({
      maybeSingle,
      then: (resolve: (value: unknown) => void) =>
        resolve({ data: [{ data: { id: roundId } }], error: null }),
    }));
    const response = await getRounds(
      new Request("https://portal.test/api/interviews/rounds"),
    );
    expect(jest.mocked(captureApiError).mock.calls).toEqual([]);
    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("vstudent_interview_rounds");
    expect(await response.json()).toEqual([{ id: roundId }]);
  });
  it("does not allow student requests to call tutor commands even for an enrolled actor", async () => {
    const response = await POST(
      request({ type: "release", commandId, roundId, expectedVersion: 1 }),
    );
    expect(response.status).toBe(403);
    expect(serviceRpc).not.toHaveBeenCalled();
  });
});

describe("fresh authenticated interview reads", () => {
  it("never caches bearer-authenticated Supabase reads", async () => {
    jest
      .mocked(createClient)
      .mockReturnValue({ auth: { getUser }, from } as unknown as ReturnType<
        typeof createClient
      >);
    await resolveInterviewActor(
      new Request("https://portal.test/api/interviews/rounds", {
        headers: { authorization: "Bearer actor-token" },
      }),
    );
    const options = jest.mocked(createClient).mock.calls[0][2];
    expect(options?.global?.headers).toEqual({
      Authorization: "Bearer actor-token",
    });
    const originalFetch = global.fetch;
    const freshFetch = jest.fn().mockResolvedValue(new Response("{}"));
    global.fetch = freshFetch;
    try {
      await options?.global?.fetch?.("https://supabase.test/rest/v1/rounds", {
        cache: "force-cache",
      });
      expect(freshFetch).toHaveBeenCalledWith(
        "https://supabase.test/rest/v1/rounds",
        { cache: "no-store" },
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
  it("never caches service reads used to enforce media policy", async () => {
    createInterviewServiceClient();
    const options = jest.mocked(createClient).mock.calls[0][2];
    const originalFetch = global.fetch;
    const freshFetch = jest.fn().mockResolvedValue(new Response("{}"));
    global.fetch = freshFetch;
    try {
      await options?.global?.fetch?.("https://supabase.test/rest/v1/rounds");
      expect(freshFetch).toHaveBeenCalledWith(
        "https://supabase.test/rest/v1/rounds",
        { cache: "no-store" },
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
