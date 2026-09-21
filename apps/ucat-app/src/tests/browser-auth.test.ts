import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAuthReturnHandler,
  parseAuthReturn,
  readPendingAuth,
  type PendingAuth,
} from "../features/auth/browser-auth-model";
const pending: PendingAuth = {
  verifier: "v".repeat(43),
  state: "s".repeat(43),
  callback: "altitutor-ucat://auth-return",
  createdAt: 1000,
};
const returnUrl = `${pending.callback}#ticket=one-use-ticket&state=${pending.state}`;
function setup(changes: Partial<PendingAuth> = {}) {
  let saved: PendingAuth | null = { ...pending, ...changes };
  let exchanges = 0;
  let sessions = 0;
  const complete = createAuthReturnHandler({
    read: async () => saved,
    clear: async () => {
      saved = null;
    },
    now: () => 2000,
    exchange: async (ticket, verifier) => {
      exchanges++;
      assert.equal(ticket, "one-use-ticket");
      assert.equal(verifier, pending.verifier);
      return { access_token: "access", refresh_token: "refresh" };
    },
    setSession: async () => {
      sessions++;
    },
  });
  return { complete, counters: () => ({ exchanges, sessions, saved }) };
}
test("concurrent browser and deep-link callbacks consume one ticket and persist one session", async () => {
  const flow = setup();
  await Promise.all([flow.complete(returnUrl), flow.complete(returnUrl)]);
  await flow.complete(returnUrl);
  assert.deepEqual(flow.counters(), { exchanges: 1, sessions: 1, saved: null });
});
test("cold return recovers a persisted verifier", async () => {
  assert.deepEqual(readPendingAuth(JSON.stringify(pending)), pending);
  const flow = setup();
  await flow.complete(returnUrl);
  assert.equal(flow.counters().sessions, 1);
});
test("state mismatch or callback origin mismatch cannot exchange or clear pending auth", async () => {
  const flow = setup();
  await assert.rejects(
    flow.complete(returnUrl.replace(pending.state, "bad-state")),
    /does not match/,
  );
  await assert.rejects(
    flow.complete(returnUrl.replace("altitutor-ucat:", "other-app:")),
    /does not match/,
  );
  assert.equal(flow.counters().exchanges, 0);
  assert.deepEqual(flow.counters().saved, pending);
});
test("expired pending auth is cleared without exchanging a ticket", async () => {
  const flow = setup({ createdAt: -1800000 });
  await assert.rejects(flow.complete(returnUrl), /expired/);
  assert.deepEqual(flow.counters(), { exchanges: 0, sessions: 0, saved: null });
});
test("failed exchanges clear the consumed sign-in request", async () => {
  let cleared = false;
  const complete = createAuthReturnHandler({
    read: async () => pending,
    clear: async () => {
      cleared = true;
    },
    now: () => 2000,
    exchange: async () => {
      throw new Error("Server unavailable");
    },
    setSession: async () => {
      assert.fail("Should not sign in");
    },
  });
  await assert.rejects(complete(returnUrl), /Server unavailable/);
  assert.equal(cleared, true);
});
test("malformed, duplicate or query-only credentials are rejected", () => {
  assert.equal(readPendingAuth("not-json"), null);
  assert.equal(
    readPendingAuth(JSON.stringify({ ...pending, verifier: "short" })),
    null,
  );
  assert.throws(
    () => parseAuthReturn(`${returnUrl}&ticket=second`),
    /incomplete/,
  );
  assert.throws(
    () => parseAuthReturn(returnUrl.replace("#", "?")),
    /incomplete/,
  );
});
test("Expo Go callback retains its /--/ route separator", () => {
  const callback = "exp://192.168.1.2:8081/--/auth-return";
  assert.deepEqual(parseAuthReturn(`${callback}#ticket=a%2Bb&state=s`), {
    callback,
    ticket: "a+b",
    state: "s",
  });
});
