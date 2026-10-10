/** @jest-environment node */
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { createBrowserAuthDiagnostics } from "../browser-auth-diagnostics";

jest.mock("@sentry/nextjs", () => ({
  addBreadcrumb: jest.fn(),
  addEventProcessor: jest.fn(),
  captureException: jest.fn(),
}));

const origin = "https://project.supabase.co";
const anonymousKey = "anonymous-fixture-key";
const secret = "private-password-token-email@example.com";

function response(status: number) {
  return new Response(
    JSON.stringify({
      message: "Invalid login credentials",
      code: "invalid_credentials",
    }),
    {
      status,
      headers: { "Content-Type": "application/json", "x-request-id": secret },
    },
  );
}

function eventContext(mechanism: string, originalException?: unknown) {
  const processor = jest
    .mocked(Sentry.addEventProcessor)
    .mock.calls.at(-1)?.[0];
  expect(processor).toBeDefined();
  return processor?.(
    {
      exception: {
        values: [
          {
            value: "permission denied for view vstudent_profile",
            mechanism: { type: mechanism },
          },
        ],
      },
    },
    { originalException },
  );
}

describe("targeted browser auth diagnostics", () => {
  beforeEach(() => jest.clearAllMocks());

  it("adds status-less login boundary facts before the real SDK returns a network error", async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockRejectedValue(new TypeError(secret));
    const diagnostics = createBrowserAuthDiagnostics(
      origin,
      anonymousKey,
      fetcher,
    );
    const client = createClient<Database>(origin, anonymousKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: diagnostics.fetch },
    });
    diagnostics.observeClient(client);
    const result = await client.auth.signInWithPassword({
      email: secret,
      password: secret,
    });
    expect(result.error?.name).toBe("AuthRetryableFetchError");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "ucat.auth.boundary",
        data: expect.objectContaining({
          operation: "password",
          response_received: false,
          response_status: null,
          aborted: false,
        }),
      }),
    );
    const event = await eventContext("auto.db.supabase.auth", result.error);
    expect(event).toMatchObject({
      contexts: {
        ucat_auth_boundary: { version: 1, association: "sdk-error" },
      },
    });
    expect(JSON.stringify(event)).not.toContain(secret);
    expect(
      JSON.stringify(jest.mocked(Sentry.addBreadcrumb).mock.calls),
    ).not.toContain(secret);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("distinguishes a readable provider400 from a failed browser fetch without adding retries", async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(response(400));
    const diagnostics = createBrowserAuthDiagnostics(
      origin,
      anonymousKey,
      fetcher,
    );
    const client = createClient<Database>(origin, anonymousKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: diagnostics.fetch },
    });
    diagnostics.observeClient(client);
    const result = await client.auth.signInWithPassword({
      email: secret,
      password: secret,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operation: "password",
          response_received: true,
          response_status: 400,
          credential_mode: "anonymous-key",
        }),
      }),
    );
    const event = await eventContext("auto.db.supabase.auth", result.error);
    expect(event).toHaveProperty(
      "contexts.ucat_auth_boundary.association",
      "sdk-error",
    );
    expect(JSON.stringify(event)).not.toContain(secret);
  });

  it("keeps abort and credential modes without retaining headers, bodies, or query parameters", async () => {
    const controller = new AbortController();
    controller.abort();
    const failure = Object.assign(new Error(secret), { name: "AbortError" });
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockRejectedValue(failure);
    const diagnostics = createBrowserAuthDiagnostics(
      origin,
      anonymousKey,
      fetcher,
    );
    const init = {
      method: "POST",
      credentials: "include" as const,
      headers: {
        Authorization: `Bearer ${secret}`,
        "X-private-header": secret,
      },
      body: secret,
      signal: controller.signal,
    };
    await expect(
      diagnostics.fetch(
        `${origin}/auth/v1/token?grant_type=password&email=${secret}`,
        init,
      ),
    ).rejects.toBe(failure);
    expect(fetcher).toHaveBeenCalledWith(
      `${origin}/auth/v1/token?grant_type=password&email=${secret}`,
      init,
    );
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aborted: true,
          fetch_credentials: "include",
          credential_mode: "bearer",
        }),
      }),
    );
    const serialized = JSON.stringify(
      jest.mocked(Sentry.addBreadcrumb).mock.calls,
    );
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toMatch(
      /Authorization|X-private-header|grant_type|email=/,
    );
  });

  it("ignores other endpoints and origins and leaves unrelated events untouched", async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(response(500));
    const diagnostics = createBrowserAuthDiagnostics(
      origin,
      anonymousKey,
      fetcher,
    );
    await diagnostics.fetch(
      `https://other.example/rest/v1/vstudent_profile?secret=${secret}`,
    );
    await diagnostics.fetch(`${origin}/rest/v1/students?secret=${secret}`);
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    const processor = jest
      .mocked(Sentry.addEventProcessor)
      .mock.calls.at(-1)?.[0];
    const unrelated = { message: secret };
    expect(await processor?.(unrelated, {})).toBe(unrelated);
  });

  it("bounds context history and separates view failures from auth captures", async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(response(401));
    const diagnostics = createBrowserAuthDiagnostics(
      origin,
      anonymousKey,
      fetcher,
    );
    for (let i = 0; i < 40; i += 1)
      await diagnostics.fetch(
        `${origin}/rest/v1/vstudent_profile?secret=${secret}`,
      );
    const event = await eventContext("auto.db.supabase.postgres");
    expect(
      Object.keys(event?.contexts?.ucat_auth_boundary ?? {}).filter((key) =>
        key.startsWith("event_"),
      ),
    ).toHaveLength(20);
    expect(await eventContext("auto.db.supabase.auth")).not.toHaveProperty(
      "contexts.ucat_auth_boundary",
    );
    expect(JSON.stringify(event)).not.toContain(secret);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("retains only exposed UUID provider correlation IDs from the strict header allowlist", async () => {
    const uuid = "01A11255-F395-7D24-8398-C18CB2E8D459";
    const fixtures: Record<string, string>[] = [
      { "sb-request-id": uuid, "x-private-id": secret },
      { "sb-request-id": secret, "x-request-id": uuid },
      { "x-private-id": uuid, "x-request-id": secret },
      { "sb-request-id": `${uuid}${secret}` },
    ];
    const fetcher = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    for (const headers of fixtures)
      fetcher.mockResolvedValueOnce(
        new Response(null, { status: 401, headers }),
      );
    const diagnostics = createBrowserAuthDiagnostics(
      origin,
      anonymousKey,
      fetcher,
    );
    for (let index = 0; index < fixtures.length; index += 1) {
      await diagnostics.fetch(`${origin}/rest/v1/vstudent_profile`);
      const entry = jest
        .mocked(Sentry.addBreadcrumb)
        .mock.calls.at(-1)?.[0]?.data;
      expect(entry?.provider_request_id).toBe(
        index < 2 ? uuid.toLowerCase() : undefined,
      );
    }
    const serialized = JSON.stringify(
      jest.mocked(Sentry.addBreadcrumb).mock.calls,
    );
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toMatch(/sb-request-id|x-request-id|x-private-id/);
  });

  it("keeps only cookie presence, offline state and visibility and expires history", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: `student-auth.0=${secret}`, visibilityState: "hidden" },
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { onLine: false },
    });
    try {
      const fetcher = jest
        .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
        .mockResolvedValue(response(401));
      const diagnostics = createBrowserAuthDiagnostics(
        origin,
        anonymousKey,
        fetcher,
      );
      await diagnostics.fetch(`${origin}/rest/v1/vstudent_profile`);
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cookie_present: true,
            online: false,
            visibility: "hidden",
          }),
        }),
      );
      expect(
        JSON.stringify(await eventContext("auto.db.supabase.postgres")),
      ).not.toContain(secret);
      now.mockReturnValue(31_001);
      expect(
        await eventContext("auto.db.supabase.postgres"),
      ).not.toHaveProperty("contexts.ucat_auth_boundary");
    } finally {
      Reflect.deleteProperty(globalThis, "document");
      Reflect.deleteProperty(globalThis, "navigator");
      now.mockRestore();
    }
  });

  it("does not enrich mobile bridge events or alter results when breadcrumbs throw", async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(response(401));
    const diagnostics = createBrowserAuthDiagnostics(
      origin,
      anonymousKey,
      fetcher,
    );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { href: `https://ucat.example/mobile-auth?ticket=${secret}` },
      },
    });
    try {
      await diagnostics.fetch(`${origin}/rest/v1/vstudent_profile`);
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
      expect(
        await eventContext("auto.db.supabase.postgres"),
      ).not.toHaveProperty("contexts.ucat_auth_boundary");
    } finally {
      Reflect.deleteProperty(globalThis, "window");
    }
    jest.mocked(Sentry.addBreadcrumb).mockImplementationOnce(() => {
      throw new Error(secret);
    });
    expect(
      (await diagnostics.fetch(`${origin}/rest/v1/vstudent_profile`)).status,
    ).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
