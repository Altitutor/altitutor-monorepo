import {
  buildUcatObservedFirstTouch,
  normalizeUcatAcquisitionSources,
  readUcatObservedFirstTouchCookie,
  writeUcatObservedFirstTouchCookie,
} from "../acquisition-attribution";

describe("UCAT acquisition attribution", () => {
  it("normalizes multi-select sources and keeps not-sure exclusive", () => {
    expect(
      normalizeUcatAcquisitionSources(["reddit", "reddit", "tiktok"]),
    ).toEqual(["reddit", "tiktok"]);
    expect(normalizeUcatAcquisitionSources(["not_sure"])).toEqual([
      "not_sure",
    ]);
    expect(
      normalizeUcatAcquisitionSources(["not_sure", "reddit"]),
    ).toBeNull();
  });

  it("captures standard UTMs without retaining the landing query string", () => {
    const attribution = buildUcatObservedFirstTouch({
      searchParams: new URLSearchParams({
        utm_source: "reddit",
        utm_medium: "organic_social",
        utm_campaign: "ucat_2027_launch",
        student_email: "must-not-be-stored@example.com",
      }),
      pathname: "/ucat/",
      referrer: "https://www.reddit.com/r/UCAT/",
      capturedAt: "2026-08-31T00:00:00.000Z",
    });

    expect(attribution).toEqual({
      utmSource: "reddit",
      utmMedium: "organic_social",
      utmCampaign: "ucat_2027_launch",
      utmContent: null,
      utmTerm: null,
      referrerDomain: "www.reddit.com",
      landingPath: "/ucat/",
      capturedAt: "2026-08-31T00:00:00.000Z",
    });
  });

  it("round-trips the shared parent-domain cookie", () => {
    const attribution = buildUcatObservedFirstTouch({
      searchParams: new URLSearchParams("utm_source=business_card"),
      pathname: "/ucat/",
      referrer: "",
      capturedAt: "2026-08-31T00:00:00.000Z",
    });
    const cookie = writeUcatObservedFirstTouchCookie(
      attribution,
      "ucat.altitutor.com",
    );

    expect(cookie).toContain("Domain=.altitutor.com");
    expect(readUcatObservedFirstTouchCookie(cookie)).toEqual(attribution);
  });
});
