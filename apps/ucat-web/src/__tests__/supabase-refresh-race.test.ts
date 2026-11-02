/** @jest-environment node */

import { createClient } from "@supabase/supabase-js";

it("overlapping tabs keep the session already saved by the winning refresh", async () => {
  const id = "10000000-0000-0000-0000-000000000001";
  const user = { id, aud: "authenticated" };
  const token = (exp: number) => [{ alg: "HS256", typ: "JWT" }, { sub: id, exp }]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .concat(Buffer.from("external-auth-fixture").toString("base64url")).join(".");
  const accessToken = token(Math.floor(Date.now() / 1000) + 3600);
  const values = new Map([["tab-session", JSON.stringify({ access_token: token(1),
    refresh_token: "old-refresh", expires_at: 1, expires_in: 3600, token_type: "bearer", user })]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  let releaseSlow: (response: Response) => void = () => { throw new Error("Slow request not started"); };
  let started: () => void = () => {};
  const slowStarted = new Promise<void>((resolve) => { started = resolve; });
  const response = () => Response.json({ access_token: accessToken, refresh_token: "new-refresh",
    expires_in: 3600, token_type: "bearer", user });
  const tab = (fetch: typeof global.fetch) => createClient("https://tabs.local.test", "public-fixture", {
    auth: { storage, storageKey: "tab-session", persistSession: true,
      autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
  });
  const fast = tab(async (input) => {
    expect(new URL(String(input)).pathname).toBe("/auth/v1/token");
    await slowStarted;
    return response();
  });
  const slow = tab(async (input) => {
    expect(new URL(String(input)).pathname).toBe("/auth/v1/token");
    return new Promise<Response>((resolve) => { releaseSlow = resolve; started(); });
  });
  const first = fast.auth.getSession();
  const second = slow.auth.getSession();
  expect((await first).data.session?.access_token).toBe(accessToken);
  releaseSlow(response());
  const resumed = await second;
  expect(resumed.error).toBeNull();
  expect(resumed.data.session?.access_token).toBe(accessToken);
  expect((await slow.auth.getSession()).data.session?.user.id).toBe(id);
});
