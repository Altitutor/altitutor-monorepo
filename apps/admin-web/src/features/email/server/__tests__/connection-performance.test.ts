/** @jest-environment node */
import { connectMailbox } from "../connection";
jest.mock("server-only", () => ({}));
jest.mock("../identity", () => ({
  ensureMailboxIdentity: async () => ({
    environment: "development",
    address: "admin@development.altitutor.com",
    allowedRecipients: ["matt@altitutor.com"],
  }),
}));
jest.mock("@/shared/lib/supabase/server", () => ({
  getServerSupabaseAdmin: () => ({}),
}));
const originalFetch = global.fetch;
const originalEnv = process.env;
afterEach(() => {
  global.fetch = originalFetch;
  process.env = originalEnv;
  jest.useRealTimers();
});
it("reuses authorization across concurrent mailbox commands, refreshes before expiry, and honors credential rotation", async () => {
  jest.useFakeTimers();
  process.env = {
    ...originalEnv,
    EMAIL_M365_TENANT_ID: "fixture-tenant",
    EMAIL_M365_CLIENT_ID: "fixture-client",
    EMAIL_M365_CLIENT_SECRET: "fixture-credential",
  };
  let authorizations = 0;
  global.fetch = jest.fn(async (input) => {
    if (String(input).startsWith("https://login.microsoftonline.com/")) {
      authorizations++;
      return Response.json({
        access_token: "fixture-access",
        expires_in: 3600,
      });
    }
    return Response.json({ id: "message", isDraft: true });
  });
  const clients = await Promise.all([connectMailbox(), connectMailbox()]);
  await Promise.all(clients.map((client) => client.message("message")));
  await (await connectMailbox()).message("message");
  expect(authorizations).toBe(1);
  jest.advanceTimersByTime(3540_001);
  await (await connectMailbox()).message("message");
  expect(authorizations).toBe(2);
  process.env.EMAIL_M365_CLIENT_SECRET = "rotated-fixture-credential";
  await (await connectMailbox()).message("message");
  expect(authorizations).toBe(3);
});
