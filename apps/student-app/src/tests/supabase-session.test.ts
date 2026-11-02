import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createAuthReturnHandler, type PendingAuth } from "../features/auth/browser-auth-model";

const userId = "10000000-0000-0000-0000-000000000001";
function accessToken() {
  return [{ alg: "HS256", typ: "JWT" },
    { sub: userId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .concat(Buffer.from("auth-service-fixture").toString("base64url")).join(".");
}

test("native browser return persists a usable SDK session once, restores it and signs out locally", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
  const tokens = { access_token: accessToken(), refresh_token: "refresh-fixture" };
  const exchangeRequests: unknown[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== "https://native.local.test") throw new Error("Unexpected external origin");
    if (url.pathname === "/api/auth/native/exchange") {
      exchangeRequests.push(JSON.parse(String(init?.body)));
      return Response.json(tokens);
    }
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${tokens.access_token}`);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: userId, aud: "authenticated" });
    if (url.pathname === "/auth/v1/logout") {
      assert.equal(url.searchParams.get("scope"), "local");
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected Auth endpoint");
  };
  const client = () => createClient("https://native.local.test", "public-fixture", {
    auth: { storage, storageKey: "native-contract", persistSession: true,
      autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: transport },
  });
  const original = client();
  let pending: PendingAuth | null = { verifier: "v".repeat(43), state: "s".repeat(43),
    callback: "altitutor-student://auth-return", createdAt: 1000 };
  const complete = createAuthReturnHandler({
    read: async () => pending,
    clear: async () => { pending = null; },
    now: () => 2000,
    exchange: async (ticket, verifier) => {
      const response = await transport("https://native.local.test/api/auth/native/exchange", {
        method: "POST", body: JSON.stringify({ ticket, verifier }), credentials: "omit",
      });
      return response.json();
    },
    setSession: async (session) => {
      const { error } = await original.auth.setSession(session);
      if (error) throw error;
    },
  });
  const callback = `altitutor-student://auth-return#ticket=one-use-ticket&state=${"s".repeat(43)}`;
  await Promise.all([complete(callback), complete(callback)]);
  assert.deepEqual(exchangeRequests, [{ ticket: "one-use-ticket", verifier: "v".repeat(43) }]);
  assert.equal(pending, null);
  assert.equal((await original.auth.getUser()).data.user?.id, userId);
  original.auth.stopAutoRefresh();
  const reopened = client();
  assert.equal((await reopened.auth.getSession()).data.session?.access_token, tokens.access_token);
  assert.equal((await reopened.auth.getUser()).data.user?.id, userId);
  assert.equal((await reopened.auth.signOut({ scope: "local" })).error, null);
  assert.equal((await client().auth.getSession()).data.session, null);
});

test("authenticated view/RPC and file transfers preserve identity, bytes and useful denials", async () => {
  const token = accessToken();
  const bytes = new TextEncoder().encode("existing resource fixture");
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://native.local.test");
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${token}`);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: userId, aud: "authenticated" });
    if (url.pathname === "/rest/v1/vstudent_students") {
      assert.equal(url.searchParams.get("select"), "id");
      return Response.json([{ id: userId }]);
    }
    if (url.pathname === "/rest/v1/rpc/current_student_portal_access") {
      assert.equal(init?.method, "POST");
      return Response.json({ status: "allowed", student_id: userId });
    }
    if (url.pathname === "/storage/v1/object/resources/fixture.txt" && init?.method === "POST") {
      assert.deepEqual(new Uint8Array(await new Response(init.body).arrayBuffer()), bytes);
      return Response.json({ Key: "resources/fixture.txt", Id: "fixture" });
    }
    if (init?.method === "GET" && ["/storage/v1/object/resources/fixture.txt",
      "/storage/v1/object/authenticated/resources/fixture.txt"].includes(url.pathname)) {
      return new Response(bytes, { headers: { "content-type": "text/plain" } });
    }
    return Response.json({ code: "42501", message: "permission denied for view vstudent_denied" }, { status: 403 });
  };
  const client = createClient("https://native.local.test", "public-fixture", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: transport },
  });
  assert.equal((await client.auth.setSession({ access_token: token, refresh_token: "fixture" })).error, null);
  assert.deepEqual((await client.from("vstudent_students").select("id")).data, [{ id: userId }]);
  assert.deepEqual((await client.rpc("current_student_portal_access")).data,
    { status: "allowed", student_id: userId });
  const uploaded = await client.storage.from("resources").upload("fixture.txt", bytes,
    { contentType: "text/plain" });
  assert.equal(uploaded.error, null);
  assert.equal(uploaded.data?.path, "fixture.txt");
  const downloaded = await client.storage.from("resources").download("fixture.txt");
  assert.equal(downloaded.error, null);
  assert.equal(await downloaded.data?.text(), "existing resource fixture");
  const denied = await client.from("vstudent_denied").select("id");
  assert.equal(denied.status, 403);
  assert.equal(denied.error?.code, "42501");
});
