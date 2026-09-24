import { resolveServerSentryEnvironment } from "./sentry-environment";

describe("resolveServerSentryEnvironment", () => {
  it("does not label a local production-mode process as production", () => {
    expect(
      resolveServerSentryEnvironment({ nodeEnvironment: "production" }),
    ).toBe("local");
  });

  it("labels CI independently of NODE_ENV", () => {
    expect(
      resolveServerSentryEnvironment({
        ci: "true",
        nodeEnvironment: "production",
      }),
    ).toBe("ci");
  });

  it("uses the Vercel deployment environment in hosted builds", () => {
    expect(
      resolveServerSentryEnvironment({
        nodeEnvironment: "production",
        vercelEnvironment: "preview",
      }),
    ).toBe("preview");
  });

  it("honours an explicit Sentry environment override", () => {
    expect(
      resolveServerSentryEnvironment({
        ci: "true",
        explicitEnvironment: "staging",
        nodeEnvironment: "production",
        vercelEnvironment: "preview",
      }),
    ).toBe("staging");
  });

  it("preserves development and test environments", () => {
    expect(
      resolveServerSentryEnvironment({ nodeEnvironment: "development" }),
    ).toBe("development");
    expect(
      resolveServerSentryEnvironment({ nodeEnvironment: "test" }),
    ).toBe("test");
  });
});
