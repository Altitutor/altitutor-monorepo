/** @jest-environment node */
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { createBrowserAuthDiagnostics } from "../browser-auth-diagnostics";
import { filterExpectedUcatWebError } from "@/lib/sentry/before-send";

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
