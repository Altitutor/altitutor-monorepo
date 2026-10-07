/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";
import { createGatewayReadFetch } from "../gateway-read-fetch";

const origin = "http://127.0.0.1:54321";
const message = "An invalid response was received from the upstream server";
const response = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function client(fetcher: typeof fetch) {
  return createClient(origin, "public-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: "Bearer supplied-session" },
      fetch: createGatewayReadFetch(origin, fetcher),
    },
  });
}

test("the real SDK recovers a REST view GET after one gateway 502", async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(response(502, { message }))
    .mockResolvedValueOnce(response(200, [{ id: "subscription" }]));
  const result = client(fetcher)
    .from("vstudent_subscriptions")
    .select("id")
    .then((value) => value);
  await jest.advanceTimersByTimeAsync(500);
  expect(await result).toMatchObject({ status: 200, error: null });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1]).toEqual(fetcher.mock.calls[0]);
  expect(
    new Headers(fetcher.mock.calls[1][1]?.headers).get("Authorization"),
  ).toBe("Bearer supplied-session");
});

test("a persistent gateway failure is returned after exactly one retry", async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockImplementation(async () => response(502, { message }));
  const result = client(fetcher)
    .from("students")
    .select("id")
    .then((value) => value);
  await jest.advanceTimersByTimeAsync(500);
  expect(await result).toMatchObject({ status: 502, error: { message } });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test.each([
  [401, "invalid credentials"],
  [403, "insufficient privilege"],
  [500, "canceling statement due to statement timeout"],
])("HTTP %s is returned without replay", async (status, errorMessage) => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(
      response(status, { message: errorMessage, code: "57014" }),
    );
  const result = await client(fetcher).from("students").select("id");
  expect(result.status).toBe(status);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test.each([
  ["POST", "/rest/v1/students"],
  ["PATCH", "/rest/v1/students"],
  ["DELETE", "/rest/v1/students"],
  ["HEAD", "/rest/v1/students"],
  ["POST", "/rest/v1/rpc/get_student_ucat_online_tier"],
  ["GET", "/rest/v1/rpc/get_student_ucat_online_tier"],
  ["GET", "/auth/v1/user"],
  ["GET", "/storage/v1/object/test"],
])("%s %s is never replayed", async (method, path) => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(response(502, { message }));
  const result = await createGatewayReadFetch(origin, fetcher)(origin + path, {
    method,
  });
  expect(result.status).toBe(502);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("other upstream origins are never replayed", async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(response(502, { message }));
  await createGatewayReadFetch(
    origin,
    fetcher,
  )("https://other.example/rest/v1/students");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("a Request preserves its headers and abort signal during recovery", async () => {
  const request = new Request(origin + "/rest/v1/students?select=id", {
    headers: { Authorization: "Bearer supplied-session" },
  });
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(response(502, { message }))
    .mockResolvedValueOnce(response(200, []));
  const result = createGatewayReadFetch(origin, fetcher)(request);
  await jest.advanceTimersByTimeAsync(500);
  expect((await result).status).toBe(200);
  expect(fetcher.mock.calls).toEqual([
    [request, undefined],
    [request, undefined],
  ]);
});

test("aborting during the recovery delay prevents another network request", async () => {
  const controller = new AbortController();
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(response(502, { message }));
  const result = createGatewayReadFetch(origin, fetcher)(
    origin + "/rest/v1/students",
    {
      signal: controller.signal,
    },
  );
  const rejection = expect(result).rejects.toMatchObject({
    name: "AbortError",
  });
  await jest.advanceTimersByTimeAsync(100);
  controller.abort();
  await rejection;
  await jest.advanceTimersByTimeAsync(500);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("an already aborted signal never starts a request", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  await expect(
    createGatewayReadFetch(origin, fetcher)(origin + "/rest/v1/students", {
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetcher).not.toHaveBeenCalled();
});

test("the terminal response preserves its own gateway error body", async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(response(502, { message }))
    .mockResolvedValueOnce(
      response(502, { message: "still unavailable", code: "terminal" }),
    );
  const result = client(fetcher)
    .from("students")
    .select("id")
    .then((value) => value);
  await jest.advanceTimersByTimeAsync(500);
  expect(await result).toMatchObject({
    status: 502,
    error: { message: "still unavailable", code: "terminal" },
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("a retained response clone cannot block gateway recovery", async () => {
  const first = response(502, { message });
  const retained = first.clone();
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(response(200, []));
  const settled = jest.fn();
  const result = createGatewayReadFetch(
    origin,
    fetcher,
  )(origin + "/rest/v1/students").then(settled);
  try {
    await jest.advanceTimersByTimeAsync(500);
    expect(settled).toHaveBeenCalledWith(
      expect.objectContaining({ status: 200 }),
    );
  } finally {
    void retained.body?.cancel();
    void result;
  }
});

test("a retained response clone cannot delay aborting recovery", async () => {
  const first = response(502, { message });
  const retained = first.clone();
  const controller = new AbortController();
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(first);
  const rejected = jest.fn();
  const result = createGatewayReadFetch(origin, fetcher)(
    origin + "/rest/v1/students",
    {
      signal: controller.signal,
    },
  ).catch(rejected);
  try {
    await jest.advanceTimersByTimeAsync(10);
    controller.abort();
    await jest.advanceTimersByTimeAsync(1);
    expect(rejected).toHaveBeenCalledWith(
      expect.objectContaining({ name: "AbortError" }),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally {
    void retained.body?.cancel();
    void result;
  }
});
