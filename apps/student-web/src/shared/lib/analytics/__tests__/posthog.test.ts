import {
  sanitizeStudentAnalyticsPathname,
  sanitizeStudentAnalyticsUrl,
  getStudentAnalyticsSurface,
} from "../posthog";

describe("sanitizeStudentAnalyticsPathname", () => {
  it.each([
    ["/register/secret", "/register/[token]"],
    ["/invite/secret", "/invite/[token]"],
    ["/form/secret/response", "/form/[token]/response"],
    ["/r/secret", "/r/[token]"],
    ["/b/secret", "/b/[token]"],
    ["/unenrol/secret", "/unenrol/[token]"],
  ])("masks public bearer-token paths", (pathname, expected) => {
    expect(sanitizeStudentAnalyticsPathname(pathname)).toBe(expected);
  });

  it("leaves ordinary application paths unchanged", () => {
    expect(sanitizeStudentAnalyticsPathname("/dashboard/classes")).toBe(
      "/dashboard/classes",
    );
  });
});

describe("getStudentAnalyticsSurface", () => {
  it("tags public booking routes separately from the logged-in app", () => {
    expect(getStudentAnalyticsSurface("/booking/trial-session")).toBe("booking");
    expect(getStudentAnalyticsSurface("/b/[token]")).toBe("booking");
    expect(getStudentAnalyticsSurface("/dashboard/classes")).toBe("application");
  });
});

describe("sanitizeStudentAnalyticsUrl", () => {
  it("masks token paths and drops query values except a numeric step", () => {
    expect(
      sanitizeStudentAnalyticsUrl(
        "https://students.example/register/secret?step=4&email=private",
      ),
    ).toBe("https://students.example/register/[token]?step=4");
  });
});
