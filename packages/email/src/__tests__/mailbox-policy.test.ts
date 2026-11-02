import {
  resolveMailboxPolicy,
  assertMailboxRecipients,
} from "../mailbox-policy";
describe("mailbox deployment configuration", () => {
  it("selects preview mail even when the application is built in production mode", () => {
    expect(
      resolveMailboxPolicy({ VERCEL_ENV: "preview", NODE_ENV: "production" }),
    ).toMatchObject({
      environment: "development",
      address: "admin@development.altitutor.com",
    });
    expect(resolveMailboxPolicy({ VERCEL_ENV: "production" })).toMatchObject({
      environment: "production",
      address: "admin@altitutor.com",
    });
    expect(resolveMailboxPolicy({ NODE_ENV: "production" })).toMatchObject({
      environment: "development",
      address: "admin@development.altitutor.com",
    });
    expect(() =>
      resolveMailboxPolicy({
        VERCEL_ENV: "preview",
        EMAIL_ENVIRONMENT: "production",
      }),
    ).toThrow("conflicts");
    expect(() =>
      resolveMailboxPolicy({ EMAIL_ENVIRONMENT: "unknown" }),
    ).toThrow("Invalid");
  });
  it("requires every To/Cc/Bcc recipient to be explicitly allowed in development", () => {
    const policy = resolveMailboxPolicy({
      EMAIL_ENVIRONMENT: "development",
      EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS:
        "matt@altitutor.com, colleague@altitutor.com",
    });
    expect(() =>
      assertMailboxRecipients(policy, {
        to: ["MATT@altitutor.com"],
        cc: ["colleague@altitutor.com"],
      }),
    ).not.toThrow();
    expect(() =>
      assertMailboxRecipients(policy, {
        to: ["matt@altitutor.com"],
        bcc: ["customer@example.test"],
      }),
    ).toThrow("configured test recipients");
    expect(() =>
      assertMailboxRecipients(resolveMailboxPolicy({}), {
        to: ["matt@altitutor.com"],
      }),
    ).toThrow("configured test recipients");
  });
});
