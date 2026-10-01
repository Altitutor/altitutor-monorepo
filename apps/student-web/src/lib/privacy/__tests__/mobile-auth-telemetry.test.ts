/** @jest-environment node */
import { containsMobileAuthData, filterMobileAuthTelemetry } from "../mobile-auth-telemetry";

describe("mobile auth telemetry exclusion", () => {
  it.each([
    "https://student.test/mobile-auth?challenge=secret&state=random",
    "https://student.test/mobile-browser#ticket=secret",
    "/api/auth/native/ticket",
    "/api/auth/native/exchange",
    "/api/auth/browser/ticket",
    "/api/auth/browser/exchange",
    "/login?next=%2Fmobile-auth%3Fchallenge%3Dsecret",
    "/login?malformed=%ZZ&next=%2Fmobile-auth%3Fchallenge%3Dsecret",
  ])("excludes bridge and encoded redirect URLs: %s", (url) => {
    expect(containsMobileAuthData(url)).toBe(true);
    expect(filterMobileAuthTelemetry({ request: { url, data: { ticket: "secret" } } })).toBeNull();
  });

  it("preserves unrelated analytics and does not match similarly named routes", () => {
    const event = { request: { url: "/dashboard?view=classes" }, properties: { source: "mobile" } };
    expect(filterMobileAuthTelemetry(event)).toBe(event);
    expect(containsMobileAuthData("/mobile-auth-preview")).toBe(false);
    expect(containsMobileAuthData("/mobile-browser-preview")).toBe(false);
    expect(containsMobileAuthData("/api/auth/native/exchange-other")).toBe(false);
    expect(containsMobileAuthData("/api/auth/browser/exchange-other")).toBe(false);
  });

  it("drops automatic events without URL fields while a bridge page is active", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { href: "https://student.test/mobile-auth?challenge=secret" } },
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
