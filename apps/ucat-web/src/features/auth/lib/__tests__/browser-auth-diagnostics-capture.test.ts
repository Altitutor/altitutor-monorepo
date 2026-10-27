/** @jest-environment node */
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { createBrowserAuthDiagnostics } from "../browser-auth-diagnostics";
import { filterExpectedUcatWebError } from "@/lib/sentry/before-send";
import { recoverTransientBrowserSession } from "@/lib/supabase/recover-transient-session";

const origin = "https://project.supabase.co";
const credential = "private-fixture-password@example.com";
const anonymousKey = "private-fixture-anonymous-key";
let events: Sentry.Event[];
type Envelope = Parameters<
  ReturnType<
    NonNullable<Parameters<typeof Sentry.init>[0]["transport"]>
  >["send"]
>[0];

beforeAll(() => {
  Sentry.init({
    dsn: "https://public@sentry.invalid/1",
    defaultIntegrations: false,
    sendDefaultPii: false,
    beforeSend: filterExpectedUcatWebError,
    transport: () => ({
      send: async (envelope: Envelope) => {
        for (const [header, payload] of envelope[1]) {
          if (header.type === "event") events.push(payload as Sentry.Event);
        }
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });
});
beforeEach(() => {
  events = [];
});
afterAll(async () => {
  await Sentry.close(2000);
});

function clientWithDiagnostics(fetcher: typeof fetch) {
  const diagnostics = createBrowserAuthDiagnostics(
    origin,
    anonymousKey,
    fetcher,
  );
  const client = diagnostics.observeClient(
    createClient<Database>(origin, anonymousKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: diagnostics.fetch },
    }),
  );
  Sentry.instrumentSupabaseClient(client);
  return client;
}

function boundaries(event: Sentry.Event) {
  return Object.values(event.contexts?.ucat_auth_boundary ?? {}).filter(
    (value) => typeof value === "object" && value !== null,
  );
}

function expectPrivateFieldsAbsent() {
  const serialized = JSON.stringify(events);
  expect(serialized).not.toContain(credential);
  expect(serialized).not.toContain(anonymousKey);
  expect(serialized).not.toContain("grant_type=");
}

it("preserves the existing invalid-credentials filter through the real SDK capture pipeline", async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Invalid login credentials",
          code: "invalid_credentials",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
  const client = clientWithDiagnostics(fetcher);
  const result = await client.auth.signInWithPassword({
    email: credential,
    password: credential,
  });
  expect(result.error?.message).toBe("Invalid login credentials");
  await Sentry.flush(2000);
  expect(events).toHaveLength(0);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("enriches each actual SDK auth capture once using its own error snapshot", async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockRejectedValue(new TypeError("Failed to fetch"));
  const client = clientWithDiagnostics(fetcher);
  for (let i = 0; i < 2; i += 1) {
    const result = await client.auth.signInWithPassword({
      email: credential,
      password: credential,
    });
    expect(result.error?.name).toBe("AuthRetryableFetchError");
  }
  await Sentry.flush(2000);
  expect(events).toHaveLength(2);
  for (const [index, event] of events.entries()) {
    expect(event.exception?.values?.[0]?.mechanism?.type).toBe(
      "auto.db.supabase.auth",
    );
    expect(event.contexts?.ucat_auth_boundary).toMatchObject({
      version: 1,
      association: "sdk-error",
    });
    expect(
      boundaries(event).filter(
        (value) => "kind" in value && value.kind === "request-end",
      ),
    ).toHaveLength(index + 1);
    expect(boundaries(event)).toContainEqual(
      expect.objectContaining({
        kind: "request-end",
        operation: "password",
        response_received: false,
        response_status: null,
        credential_mode: "anonymous-key",
        request_sequence: index + 1,
      }),
    );
  }
  expect(fetcher).toHaveBeenCalledTimes(2);
  expectPrivateFieldsAbsent();
});

it("keeps immutable snapshots on concurrent SDK auth errors and never enriches an unrelated capture", async () => {
  const rejects: ((error: Error) => void)[] = [];
  const client = clientWithDiagnostics(
    () => new Promise<Response>((_resolve, reject) => rejects.push(reject)),
  );
  const first = client.auth.signInWithPassword({
    email: credential,
    password: credential,
  });
  const second = client.auth.signInWithPassword({
    email: credential,
    password: credential,
  });
  while (rejects.length < 2)
    await new Promise((resolve) => setTimeout(resolve, 0));
  rejects[1]!(new TypeError("Failed to fetch"));
  await second;
  await Sentry.flush(2000);
  expect(events).toHaveLength(1);
  const firstCapturedContext = JSON.stringify(
    events[0]?.contexts?.ucat_auth_boundary,
  );
  rejects[0]!(new TypeError("Load failed"));
  await first;
  Sentry.captureException(new Error("unrelated-concurrent-fixture"));
  await Sentry.flush(2000);
  expect(events).toHaveLength(3);
  expect(JSON.stringify(events[0]?.contexts?.ucat_auth_boundary)).toBe(
    firstCapturedContext,
  );
  const authEvents = events.filter(
    (event) =>
      event.exception?.values?.[0]?.mechanism?.type === "auto.db.supabase.auth",
  );
  expect(authEvents).toHaveLength(2);
  for (const event of authEvents)
    expect(event.contexts?.ucat_auth_boundary?.association).toBe("sdk-error");
  expect(
    events.find(
      (event) =>
        event.exception?.values?.[0]?.value === "unrelated-concurrent-fixture",
    )?.contexts,
  ).not.toHaveProperty("ucat_auth_boundary");
  expectPrivateFieldsAbsent();
});

it("attaches bounded operation history to the three concurrent SDK view captures only", async () => {
  const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
    async (input) => {
      const view = new URL(String(input)).pathname.slice("/rest/v1/".length);
      return new Response(
        JSON.stringify({
          code: "42501",
          message: `permission denied for view ${view}`,
          details: null,
          hint: null,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    },
  );
  const client = clientWithDiagnostics(fetcher);
  await Promise.all([
    client.from("vstudent_profile").select("id"),
    client.from("vstudent_ucat_my_access").select("id"),
    client.from("vstudent_operational_sessions").select("id"),
  ]);
  Sentry.captureException(new Error("unrelated fixture"));
  await Sentry.flush(2000);
  expect(events).toHaveLength(4);
  const captured = events.filter(
    (event) =>
      event.exception?.values?.[0]?.mechanism?.type ===
      "auto.db.supabase.postgres",
  );
  expect(captured).toHaveLength(3);
  expect(
    captured
      .map((event) => event.contexts?.ucat_auth_boundary?.trigger_operation)
      .sort(),
  ).toEqual(["access", "profile", "sessions"]);
  for (const event of captured) {
    const operation = event.contexts?.ucat_auth_boundary?.trigger_operation;
    expect(event.contexts?.ucat_auth_boundary?.association).toBe(
      "operation-window",
    );
    expect(boundaries(event)).toContainEqual(
      expect.objectContaining({
        kind: "request-end",
        operation,
        response_status: 401,
        credential_mode: "anonymous-key",
      }),
    );
  }
  expect(
    events.find(
      (event) => event.exception?.values?.[0]?.value === "unrelated fixture",
    )?.contexts,
  ).not.toHaveProperty("ucat_auth_boundary");
  expect(fetcher).toHaveBeenCalledTimes(3);
  expectPrivateFieldsAbsent();
});

it.each([
  { throwFromObserver: false, restoreSession: false },
  { throwFromObserver: true, restoreSession: false },
  { throwFromObserver: false, restoreSession: true },
])(
  "serializes refresh and recovery outcome $restoreSession with throwing observer $throwFromObserver after rollover",
  async ({ throwFromObserver, restoreSession }) => {
    const values = new Map<string, string>();
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "private-fixture-user", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
    const session = {
      access_token: token,
      refresh_token: credential,
      token_type: "bearer",
      expires_in: 3600,
      user: {
        id: "private-fixture-user",
        aud: "authenticated",
        role: "authenticated",
      },
    };
    let denyViews = false;
    const fetcher: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      const body =
        path === "/auth/v1/user"
          ? session.user
          : path === "/auth/v1/token"
            ? session
            : denyViews
              ? {
                  code: "42501",
                  message: `permission denied for view ${path.slice("/rest/v1/".length)}`,
                }
              : [];
      return new Response(JSON.stringify(body), {
        status: denyViews && path.startsWith("/rest/v1/") ? 401 : 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const diagnostics = createBrowserAuthDiagnostics(
      origin,
      anonymousKey,
      fetcher,
    );
    const client = recoverTransientBrowserSession(
      diagnostics.observeClient(
        createClient<Database>(origin, anonymousKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: true,
            storage: {
              getItem: (key) => values.get(key) ?? null,
              setItem: (key, value) => {
                values.set(key, value);
              },
              removeItem: (key) => {
                values.delete(key);
              },
            },
          },
          global: { fetch: diagnostics.fetch },
        }),
      ),
      (observation) => {
        diagnostics.observeRecovery(observation);
        if (throwFromObserver) throw new Error(credential);
      },
    );
    Sentry.instrumentSupabaseClient(client);
    expect(
      (
        await client.auth.setSession({
          access_token: token,
          refresh_token: credential,
        })
      ).error,
    ).toBeNull();
    expect((await client.auth.getSession()).data.session).not.toBeNull();
    expect((await client.auth.refreshSession()).error).toBeNull();
    const preservedValues = [...values.entries()];
    values.clear();
    if (restoreSession)
      setTimeout(() => {
        for (const [key, value] of preservedValues) values.set(key, value);
      }, 100);
    expect(Boolean((await client.auth.getSession()).data.session)).toBe(
      restoreSession,
    );
    for (let index = 0; index < 15; index += 1)
      await client.from("vstudent_profile").select("id");
    denyViews = true;
    await Promise.all([
      client.from("vstudent_profile").select("id"),
      client.from("vstudent_ucat_my_access").select("id"),
      client.from("vstudent_operational_sessions").select("id"),
    ]);
    await Sentry.flush(2000);
    expect(events).toHaveLength(3);
    for (const event of events) {
      expect(event.contexts?.ucat_auth_boundary?.last_refresh).toMatchObject({
        response_status: 200,
        response_received: true,
        request_sequence: 1,
      });
      expect(event.contexts?.ucat_auth_boundary?.last_session).toMatchObject({
        result: restoreSession ? "present" : "missing",
        session_sequence: expect.any(Number),
        elapsed_ms: expect.any(Number),
      });
      expect(event.contexts?.ucat_auth_boundary?.recovery).toMatchObject({
        phase: "end",
        trigger: "missing-session",
        outcome: restoreSession ? "restored" : "missing",
        attempt_count: restoreSession ? expect.any(Number) : 5,
      });
      expect(event.contexts?.ucat_auth_boundary?.history).toMatchObject({
        dropped_entries: expect.any(Number),
      });
    }
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain("private-fixture-user");
    expectPrivateFieldsAbsent();
  },
);
