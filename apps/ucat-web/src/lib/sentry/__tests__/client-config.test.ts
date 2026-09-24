import {
  shouldEnableClientSentry,
  shouldSendClientSentryEvent,
  shouldSendClientSentryTransaction,
} from "@/lib/sentry/client-config";

describe("shouldEnableClientSentry", () => {
  it("initializes the local client when a DSN exists so feedback is available", () => {
    expect(
      shouldEnableClientSentry(
        "https://public@sentry.example/1",
        "localhost",
      ),
    ).toBe(true);
  });

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

describe("local Sentry telemetry filtering", () => {
  it.each(["localhost", "127.0.0.1", "::1"])(
    "sends only explicit feedback events from %s",
    (hostname) => {
      expect(shouldSendClientSentryEvent("feedback", hostname)).toBe(true);
      expect(shouldSendClientSentryEvent(undefined, hostname)).toBe(false);
      expect(shouldSendClientSentryTransaction(hostname)).toBe(false);
    },
  );

  it("sends events and transactions from deployed hosts", () => {
    expect(
      shouldSendClientSentryEvent(undefined, "ucat.altitutor.com"),
    ).toBe(true);
    expect(shouldSendClientSentryTransaction("ucat.altitutor.com")).toBe(true);
  });
});
