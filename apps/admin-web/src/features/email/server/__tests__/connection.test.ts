/** @jest-environment node */
import { mailboxConfigured, getMailboxAccessToken } from "../connection";
jest.mock("server-only", () => ({}));
jest.mock("@/shared/lib/supabase/server", () => ({
  getServerSupabaseAdmin: jest.fn(),
}));
const previousEnv = { ...process.env };
afterEach(() => {
  process.env = { ...previousEnv };
  jest.restoreAllMocks();
});
it("does not use legacy onboarding credentials to authorize either mailbox", async () => {
  delete process.env.EMAIL_M365_TENANT_ID;
  delete process.env.EMAIL_M365_CLIENT_ID;
  delete process.env.EMAIL_M365_CLIENT_SECRET;
  process.env.ONBOARDING_M365_TENANT_ID = "legacy-tenant";
  process.env.ONBOARDING_M365_CLIENT_ID = "legacy-client";
  process.env.ONBOARDING_M365_CLIENT_SECRET = "fixture-not-a-secret";
  const fetch = jest.spyOn(global, "fetch");
  expect(mailboxConfigured()).toBe(false);
  await expect(getMailboxAccessToken()).rejects.toThrow("not configured");
  expect(fetch).not.toHaveBeenCalled();
});
