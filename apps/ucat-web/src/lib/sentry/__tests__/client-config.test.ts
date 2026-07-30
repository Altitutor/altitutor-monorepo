import { shouldEnableClientSentry } from "@/lib/sentry/client-config";

describe("shouldEnableClientSentry", () => {
  it.each(["localhost", "127.0.0.1", "::1"])(
    "does not send local telemetry from %s",
    (hostname) => {
      expect(
        shouldEnableClientSentry("https://public@sentry.example/1", hostname),
      ).toBe(false);
    },
  );

  it("enables telemetry for a deployed host with a DSN", () => {
    expect(
      shouldEnableClientSentry(
        "https://public@sentry.example/1",
        "ucat.altitutor.com",
      ),
    ).toBe(true);
  });

  it("disables telemetry when no DSN is configured", () => {
    expect(shouldEnableClientSentry(undefined, "ucat.altitutor.com")).toBe(
      false,
    );
  });
});
