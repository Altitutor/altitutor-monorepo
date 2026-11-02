/** @jest-environment node */
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import {
  createAdminAuthDiagnostics,
  recordAdminAuthNavigation,
} from "../admin-auth-diagnostics";

const events: Sentry.ErrorEvent[] = [];
const originalEnv = process.env;
const browser = Object.assign(new EventTarget(), {
  location: new URL(
    "https://admin.altitutor.com/dashboard/private?token=private-url",
  ),
});
const page = Object.assign(new EventTarget(), { visibilityState: "visible" });

beforeAll(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browser,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: page,
  });
  Sentry.init({
    dsn: "https://public@sentry.example/1",
    defaultIntegrations: false,
    sendClientReports: false,
    tracesSampleRate: 0,
    release: "synthetic-release",
    transport: () => ({
      send: async () => {
        throw new Error("Offline test must not send telemetry");
      },
      flush: async () => true,
    }),
    beforeSend: (event) => {
      if (event.message === "Admin auth diagnostic") events.push(event);
      return null;
    },
  });
});
beforeEach(() => {
  events.length = 0;
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    CI: "",
    NEXT_PUBLIC_SENTRY_DSN: "https://public@sentry.example/1",
    NEXT_PUBLIC_SENTRY_DISABLED: "",
    NEXT_PUBLIC_SENTRY_TEST_OPT_IN: "",
    NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT: "production",
    NEXT_PUBLIC_ADMIN_AUTH_DIAGNOSTICS: "true",
  };
});
afterEach(() => {
  process.env = originalEnv;
});
afterAll(async () => {
  await Sentry.close();
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "document");
});

it("captures forced refresh rejection, SDK sign-out and anonymous denial without sensitive data", async () => {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: "private-access-token",
    refresh_token: "private-refresh-token",
    expires_at: now + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "private-user-id",
      email: "private@example.com",
      aud: "authenticated",
    },
  };
  const storage = new Map([["diagnostic-test", JSON.stringify(session)]]);
  const diagnostics = createAdminAuthDiagnostics({
    url: "https://database.example",
    anonymousKey: "private-anonymous-key",
    fetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/token")
        return new Response(
          JSON.stringify({
            msg: "private refresh error",
            error_code: "refresh_token_not_found",
          }),
          { status: 400 },
        );
      return new Response(
        JSON.stringify({ code: "42501", message: "private database error" }),
        { status: 401 },
      );
    },
  });
  const client = createClient(
    "https://database.example",
    "private-anonymous-key",
    {
      auth: {
        storageKey: "diagnostic-test",
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => {
            storage.set(key, value);
          },
          removeItem: (key) => {
            storage.delete(key);
          },
        },
      },
      global: { fetch: diagnostics?.fetch },
    },
  );
  diagnostics?.attach(client);
  try {
    await client.auth.getSession();
    storage.set(
      "diagnostic-test",
      JSON.stringify({ ...session, expires_at: now - 120 }),
    );
    browser.dispatchEvent(new Event("online"));
    await Promise.all(
      ["staff", "students", "notifications", "tasks"].map((table) =>
        client.from(table).select("id"),
      ),
    );
    await Sentry.flush(1000);
    expect(events).toHaveLength(1);
    expect(events[0].contexts?.admin_auth).toMatchObject({
      schema: 1,
      outcome: "denial",
      request: {
        category: "table",
        authorization: "configured-anonymous-key",
        status: 401,
      },
    });
    expect(events[0].extra?.admin_auth_timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "refresh-end", status: 400 }),
        expect.objectContaining({ kind: "SIGNED_OUT", session: false }),
        expect.objectContaining({ kind: "online" }),
      ]),
    );
    expect(events[0].release).toBe("synthetic-release");
    expect(JSON.stringify(events)).not.toMatch(
      /private|database\.example|42501|refresh_token_not_found/,
    );
  } finally {
    diagnostics?.dispose();
    await client.auth.dispose();
  }
});

it("bounds a denial burst and records only the first subsequent successful request", async () => {
  let status = 403;
  const diagnostics = createAdminAuthDiagnostics({
    url: "https://database.example",
    anonymousKey: "synthetic-key",
    fetch: async () => new Response("[]", { status }),
  });
  const client = createClient("https://database.example", "synthetic-key", {
    auth: {
      storageKey: "burst-test",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: diagnostics?.fetch },
  });
  diagnostics?.attach(client);
  try {
    await Promise.all(
      Array.from({ length: 35 }, () => client.from("staff").select("id")),
    );
    status = 200;
    await client.from("students").select("id");
    await client.from("notifications").select("id");
    await Sentry.flush(1000);
    expect(events.map((event) => event.contexts?.admin_auth?.outcome)).toEqual([
      "denial",
      "first-success",
    ]);
    expect(events[0].contexts?.admin_auth?.burst).toBe(
      events[1].contexts?.admin_auth?.burst,
    );
    expect(events[1].contexts?.admin_auth?.request).toMatchObject({
      status: 200,
    });
    expect(events[0].extra?.admin_auth_timeline).not.toEqual(
      events[1].extra?.admin_auth_timeline,
    );
  } finally {
    diagnostics?.dispose();
    await client.auth.dispose();
  }
});

it("observes browser wake and session metadata, then removes listeners on page exit", async () => {
  const now = Math.floor(Date.now() / 1000);
  const storage = new Map([
    [
      "lifecycle-test",
      JSON.stringify({
        access_token: "private-session-bearer",
        refresh_token: "private-refresh",
        expires_at: now + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user: { id: "private-lifecycle-user", aud: "authenticated" },
      }),
    ],
  ]);
  const diagnostics = createAdminAuthDiagnostics({
    url: "https://database.example",
    anonymousKey: "synthetic-key",
    fetch: async () => new Response("[]", { status: 403 }),
  });
  const client = createClient("https://database.example", "synthetic-key", {
    auth: {
      storageKey: "lifecycle-test",
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
    },
    global: { fetch: diagnostics?.fetch },
  });
  diagnostics?.attach(client);
  diagnostics?.attach(client);
  try {
    await client.auth.getSession();
    page.visibilityState = "hidden";
    page.dispatchEvent(new Event("visibilitychange"));
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    browser.dispatchEvent(new Event("offline"));
    browser.dispatchEvent(new Event("online"));
    recordAdminAuthNavigation();
    await client.rpc("get_unread_contact_conversation_count");
    await Sentry.flush(1000);
    expect(events[0].contexts?.admin_auth?.request).toMatchObject({
      category: "rpc",
      authorization: "other-bearer",
      session: true,
      expiry: "over-5m",
    });
    const timeline = events[0].extra?.admin_auth_timeline as {
      kind: string;
      visible?: boolean;
    }[];
    expect(
      timeline.filter((entry) => entry.kind === "INITIAL_SESSION"),
    ).toHaveLength(1);
    expect(timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "visibility", visible: false }),
        expect.objectContaining({ kind: "visibility", visible: true }),
        expect.objectContaining({ kind: "offline" }),
        expect.objectContaining({ kind: "navigation" }),
      ]),
    );
    browser.dispatchEvent(new Event("pagehide"));
    events.length = 0;
    browser.dispatchEvent(new Event("online"));
    await client.from("staff").select("id");
    await Sentry.flush(1000);
    expect(events).toEqual([]);
  } finally {
    diagnostics?.dispose();
    await client.auth.dispose();
  }
});

it("connects the existing memoized browser client to the diagnostic fetch and auth lifecycle", async () => {
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://database.example";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-browser-key";
  Object.assign(page, { cookie: "" });
  globalThis.fetch = async () => new Response("[]", { status: 401 });
  const { getSupabaseClient } = await import("@/shared/lib/supabase/client");
  const client = getSupabaseClient();
  try {
    expect(getSupabaseClient()).toBe(client);
    await client.from("staff").select("id");
    await Sentry.flush(1000);
    expect(
      events.filter((event) => event.message === "Admin auth diagnostic"),
    ).toHaveLength(1);
    expect(
      events.find((event) => event.message === "Admin auth diagnostic")?.extra
        ?.admin_auth_timeline,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "INITIAL_SESSION", session: false }),
      ]),
    );
  } finally {
    browser.dispatchEvent(new Event("pagehide"));
    await client.auth.dispose();
    globalThis.fetch = previousFetch;
  }
});

it("keeps a bounded timeline and page capture budget across cached-page restoration", async () => {
  const clock = jest.spyOn(Date, "now");
  let time = 1800000000000;
  clock.mockImplementation(() => time);
  let status = 401;
  const diagnostics = createAdminAuthDiagnostics({
    url: "https://database.example",
    anonymousKey: "synthetic-key",
    fetch: async () => new Response("[]", { status }),
  });
  const client = createClient("https://database.example", "synthetic-key", {
    auth: {
      storageKey: "budget-test",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: diagnostics?.fetch },
  });
  diagnostics?.attach(client);
  try {
    for (let burst = 0; burst < 5; burst++) {
      if (burst === 0) {
        for (let index = 0; index < 100; index++)
          browser.dispatchEvent(new Event("online"));
      }
      status = 401;
      await client.from("staff").select("id");
      status = 200;
      await client.from("staff").select("id");
      browser.dispatchEvent(
        Object.assign(new Event("pagehide"), { persisted: true }),
      );
      browser.dispatchEvent(new Event("pageshow"));
      time += 60001;
    }
    await Sentry.flush(1000);
    expect(events).toHaveLength(6);
    for (const event of events) {
      expect(
        (event.extra?.admin_auth_timeline as unknown[]).length,
      ).toBeLessThanOrEqual(32);
    }
    expect(events[2].extra?.admin_auth_timeline).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "pageshow" })]),
    );
  } finally {
    diagnostics?.dispose();
    await client.auth.dispose();
    clock.mockRestore();
  }
});

it.each([
  { NEXT_PUBLIC_ADMIN_AUTH_DIAGNOSTICS: "" },
  { NEXT_PUBLIC_ADMIN_AUTH_DIAGNOSTICS: "false" },
  { NEXT_PUBLIC_SENTRY_DISABLED: "true" },
  { NEXT_PUBLIC_SENTRY_DSN: "" },
  { NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT: "development" },
  { CI: "true" },
  { NODE_ENV: "test" as const, NEXT_PUBLIC_SENTRY_TEST_OPT_IN: "true" },
])("is inert when diagnostic or automatic collection is off: %j", (env) => {
  process.env = { ...process.env, ...env };
  expect(
    createAdminAuthDiagnostics({
      url: "https://database.example",
      anonymousKey: "synthetic-key",
    }),
  ).toBeUndefined();
});

it("redacts inherited telemetry and hostile request data while preserving fetch responses and failures", async () => {
  const failure = new Error("private-network-error");
  let reject = false;
  const response = new Response("private-response-body", { status: 403 });
  const diagnostics = createAdminAuthDiagnostics({
    url: "https://database.example",
    anonymousKey: "private-anonymous-key",
    fetch: async () => {
      if (reject) throw failure;
      return response;
    },
  });
  Sentry.setUser({ id: "private-user", email: "private@example.com" });
  Sentry.setContext("private-context", { url: "private-context-url" });
  Sentry.addBreadcrumb({ message: "private-breadcrumb" });
  try {
    const request = new Request(
      "https://database.example/rest/v1/private-table?secret=private-query",
      {
        headers: {
          Authorization: "Basic private-header",
          "x-private": "private-value",
        },
      },
    );
    expect(await diagnostics?.fetch(request)).toBe(response);
    expect(await response.text()).toBe("private-response-body");
    reject = true;
    await expect(diagnostics?.fetch(request)).rejects.toBe(failure);
    await Sentry.flush(1000);
    expect(events).toHaveLength(1);
    expect(events[0].contexts?.admin_auth?.request).toMatchObject({
      authorization: "other-authorization",
      category: "table",
    });
    expect(JSON.stringify(events)).not.toMatch(
      /private|secret|Authorization|database\.example/,
    );
  } finally {
    diagnostics?.dispose();
    Sentry.setUser(null);
    Sentry.setContext("private-context", null);
    Sentry.getIsolationScope().clearBreadcrumbs();
  }
});

it("keeps healthy refresh quiet and preserves its bearer sequence if a later request is denied", async () => {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: "synthetic-old-bearer",
    refresh_token: "synthetic-refresh",
    expires_at: now + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "synthetic-user", aud: "authenticated" },
  };
  const storage = new Map([["healthy-test", JSON.stringify(session)]]);
  let databaseStatus = 200;
  const diagnostics = createAdminAuthDiagnostics({
    url: "https://database.example",
    anonymousKey: "synthetic-key",
    fetch: async (input) =>
      new Response(
        JSON.stringify(
          new URL(String(input)).pathname === "/auth/v1/token"
            ? { ...session, access_token: "synthetic-new-bearer" }
            : [],
        ),
        {
          status:
            new URL(String(input)).pathname === "/auth/v1/token"
              ? 200
              : databaseStatus,
        },
      ),
  });
  const client = createClient("https://database.example", "synthetic-key", {
    auth: {
      storageKey: "healthy-test",
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
    },
    global: { fetch: diagnostics?.fetch },
  });
  diagnostics?.attach(client);
  try {
    await client.auth.getSession();
    storage.set(
      "healthy-test",
      JSON.stringify({ ...session, expires_at: now - 120 }),
    );
    const results = await Promise.all(
      ["staff", "students", "tasks"].map((table) =>
        client.from(table).select("id"),
      ),
    );
    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
    await Sentry.flush(1000);
    expect(events).toEqual([]);
    databaseStatus = 403;
    await client.from("staff").select("id");
    await Sentry.flush(1000);
    expect(events[0].contexts?.admin_auth?.request).toMatchObject({
      authorization: "other-bearer",
      session: true,
    });
    expect(events[0].extra?.admin_auth_timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "refresh-end", status: 200 }),
        expect.objectContaining({ kind: "TOKEN_REFRESHED", session: true }),
      ]),
    );
  } finally {
    diagnostics?.dispose();
    await client.auth.dispose();
  }
});

it("does not mistake an older in-flight success for recovery or carry in-flight denials across page restoration", async () => {
  let finish: (response: Response) => void = () => {
    throw new Error("Request has not started");
  };
  let start: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    start = resolve;
  });
  let status = 401;
  const diagnostics = createAdminAuthDiagnostics({
    url: "https://database.example",
    anonymousKey: "synthetic-key",
    fetch: async (input) => {
      if (new URL(String(input)).pathname.endsWith("/students")) {
        start();
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
      return new Response("[]", { status });
    },
  });
  const client = createClient("https://database.example", "synthetic-key", {
    auth: {
      storageKey: "ordering-test",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: diagnostics?.fetch },
  });
  diagnostics?.attach(client);
  try {
    const older = client
      .from("students")
      .select("id")
      .then((result) => result);
    await started;
    await client.from("staff").select("id");
    finish(new Response("[]", { status: 200 }));
    await older;
    await Sentry.flush(1000);
    expect(events.map((event) => event.contexts?.admin_auth?.outcome)).toEqual([
      "denial",
    ]);
    status = 200;
    await client.from("staff").select("id");
    await Sentry.flush(1000);
    expect(events.map((event) => event.contexts?.admin_auth?.outcome)).toEqual([
      "denial",
      "first-success",
    ]);

    // A separate cached-page generation must not inherit an old request result.
    const pending = diagnostics!.fetch(
      "https://database.example/rest/v1/students",
    );
    browser.dispatchEvent(
      Object.assign(new Event("pagehide"), { persisted: true }),
    );
    browser.dispatchEvent(new Event("pageshow"));
    const clock = jest.spyOn(Date, "now").mockReturnValue(Date.now() + 60001);
    try {
      finish(new Response("[]", { status: 401 }));
      await pending;
      await Sentry.flush(1000);
      expect(events).toHaveLength(2);
    } finally {
      clock.mockRestore();
    }
  } finally {
    diagnostics?.dispose();
    await client.auth.dispose();
  }
});

it("passes through relative and foreign requests without collecting unrelated traffic", async () => {
  const response = new Response("[]", { status: 401 });
  const diagnostics = createAdminAuthDiagnostics({
    url: "https://database.example",
    anonymousKey: "synthetic-key",
    fetch: async () => response,
  });
  try {
    expect(await diagnostics?.fetch("/rest/v1/staff")).toBe(response);
    expect(
      await diagnostics?.fetch(
        "https://foreign.example/rest/v1/staff?private=value",
      ),
    ).toBe(response);
    expect(
      await diagnostics?.fetch("https://database.example/storage/v1/private"),
    ).toBe(response);
    await Sentry.flush(1000);
    expect(events).toEqual([]);
  } finally {
    diagnostics?.dispose();
  }
});

it("retains a refresh transport failure as status zero without changing the thrown error", async () => {
  const failure = new Error("private-refresh-network-error");
  const diagnostics = createAdminAuthDiagnostics({
    url: "https://database.example",
    anonymousKey: "synthetic-key",
    fetch: async (input) => {
      if (String(input).includes("/auth/v1/token")) throw failure;
      return new Response("[]", { status: 401 });
    },
  });
  try {
    await expect(
      diagnostics?.fetch(
        "https://database.example/auth/v1/token?grant_type=refresh_token",
      ),
    ).rejects.toBe(failure);
    await diagnostics?.fetch("https://database.example/rest/v1/staff");
    await Sentry.flush(1000);
    expect(events[0].extra?.admin_auth_timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "refresh-end", status: 0 }),
      ]),
    );
    expect(JSON.stringify(events)).not.toContain("private");
  } finally {
    diagnostics?.dispose();
  }
});
