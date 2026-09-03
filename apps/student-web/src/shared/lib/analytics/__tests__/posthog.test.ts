import {
  sanitizeStudentAnalyticsPathname,
  sanitizeStudentAnalyticsUrl,
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

describe("sanitizeStudentAnalyticsUrl", () => {
  it("masks token paths and drops query values except a numeric step", () => {
    expect(
      sanitizeStudentAnalyticsUrl(
        "https://students.example/register/secret?step=4&email=private",
      ),
    ).toBe("https://students.example/register/[token]?step=4");
  });
});
