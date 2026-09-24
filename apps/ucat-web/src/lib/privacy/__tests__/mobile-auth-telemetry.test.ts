/** @jest-environment node */
import {
  containsMobileAuthData,
  filterMobileAuthTelemetry,
} from "../mobile-auth-telemetry";

describe("mobile auth telemetry exclusion", () => {
  it.each([
    "https://ucat.test/mobile-auth?challenge=secret&state=random",
    "https://ucat.test/mobile-browser#ticket=secret",
    "/api/auth/native/ticket",
    "/api/auth/native/exchange",
    "/api/auth/browser/ticket",
    "/api/auth/browser/exchange",
    "/login?redirect=%2Fmobile-auth%3Fchallenge%3Dsecret",
    "/login?malformed=%ZZ&redirect=%2Fmobile-auth%3Fchallenge%3Dsecret",
    "/auth/callback?next=%252Fmobile-auth%253Fstate%253Drandom",
  ])("excludes bridge and encoded redirect URLs: %s", (url) => {
    expect(containsMobileAuthData(url)).toBe(true);
    expect(
      filterMobileAuthTelemetry({
        request: { url, data: { ticket: "secret" } },
      }),
    ).toBeNull();
  });
  it("excludes transaction spans and historical breadcrumbs containing bridge URLs", () => {
    expect(
      filterMobileAuthTelemetry({
        spans: [{ data: { "url.full": "/api/auth/browser/exchange" } }],
      }),
    ).toBeNull();
    expect(
      filterMobileAuthTelemetry({
        breadcrumbs: [
          { data: { from: "/mobile-browser#ticket=secret", to: "/dashboard" } },
        ],
      }),
    ).toBeNull();
  });
  it("preserves unrelated analytics and does not match similarly named routes", () => {
    const event = {
      request: { url: "/dashboard?view=progress" },
      properties: { source: "mobile" },
    };
    expect(filterMobileAuthTelemetry(event)).toBe(event);
    expect(containsMobileAuthData("/mobile-browser-preview")).toBe(false);
    expect(containsMobileAuthData("/api/auth/native/exchange-other")).toBe(
      false,
    );
  });
  it("drops automatic events without URL fields while a bridge page is active", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { href: "https://ucat.test/mobile-browser#ticket=secret" },
      },
    });
    try {
      expect(filterMobileAuthTelemetry({ event: "$pageleave" })).toBeNull();
    } finally {
      Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("handles cyclic event metadata without throwing", () => {
    const event: Record<string, unknown> = { message: "unexpected error" };
    event.self = event;
    expect(filterMobileAuthTelemetry(event)).toBe(event);
  });
});
