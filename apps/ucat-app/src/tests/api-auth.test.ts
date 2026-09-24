import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient, type AuthChangeEvent } from "@supabase/supabase-js";
import { createApiClient } from "../lib/api-client";

async function setup(authStatus: number, authBody: Record<string, unknown>) {
  const storage = new Map<string, string>();
  const events: AuthChangeEvent[] = [];
  let verifications = 0;
  const client = createClient("https://local.test", "test-key", {
    auth: {
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
    global: {
      fetch: async (url) => {
        if (String(url).includes("/token")) {
          return Response.json({
            access_token: "saved-access-token",
            refresh_token: "saved-refresh-token",
            expires_in: 3600,
            token_type: "bearer",
            user: { id: "student", aud: "authenticated" },
          });
        }
        verifications++;
        return Response.json(authBody, {
          status: authStatus,
          headers: { "x-supabase-api-version": "2024-01-01" },
        });
      },
    },
  });
  await client.auth.signInWithPassword({
    email: "student@test.local",
    password: "test",
  });
  client.auth.onAuthStateChange((event) => {
    events.push(event);
  });
  return { client, events, verifications: () => verifications };
}

test("a session deleted by a database reset clears native auth after an API failure", async () => {
  const state = await setup(403, {
    code: "session_not_found",
    msg: "Session not found",
  });
  let requests = 0;
  const api = createApiClient(
    state.client.auth,
    (path) => `https://api.test${path}`,
    async () => {
      requests++;
      return Response.json({ error: "Failed to get user" }, { status: 500 });
    },
  );
  await assert.rejects(
    api("/practice/sessions", { method: "POST", body: {} }),
    /Please sign in again/,
  );
  assert.equal((await state.client.auth.getSession()).data.session, null);
  assert.ok(state.events.includes("SIGNED_OUT"));
  assert.equal(
    requests,
    1,
    "a mutation must never be replayed during auth recovery",
  );
});

test("temporary Auth failures preserve the saved session", async () => {
  const state = await setup(500, {
    code: "unexpected_failure",
    msg: "Database unavailable",
  });
  const api = createApiClient(
    state.client.auth,
    (path) => `https://api.test${path}`,
    async () => Response.json({ error: "Failed to get user" }, { status: 500 }),
  );
  await assert.rejects(api("/skill-trainers"), /Failed to get user/);
  assert.ok((await state.client.auth.getSession()).data.session);
  assert.ok(!state.events.includes("SIGNED_OUT"));
});

test("successful requests and unrelated failures do not revalidate Auth", async () => {
  const state = await setup(200, { id: "student" });
  const api = createApiClient(
    state.client.auth,
    (path) => `https://api.test${path}`,
    async (url) =>
      String(url).endsWith("/sections")
        ? Response.json({ sections: [] })
        : Response.json({ error: "Allowance exceeded" }, { status: 403 }),
  );
  assert.deepEqual(await api("/sections"), { sections: [] });
  await assert.rejects(api("/practice/sessions"), /Allowance exceeded/);
  assert.equal(state.verifications(), 0);
});
