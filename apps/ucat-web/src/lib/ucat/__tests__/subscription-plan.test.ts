import { buildUcatCheckoutReturnPath, parseUcatCheckoutRequest } from "@/lib/ucat/subscription-plan";

describe("buildUcatCheckoutReturnPath", () => {
  it("carries a quota upgrade destination through the checkout success gate", () => {
    expect(
      buildUcatCheckoutReturnPath(
        "subscribe",
        "/sets/section-a/set-123?session=lesson-7",
      ),
    ).toBe(
      "/dashboard?checkout=success&redirect=%2Fsets%2Fsection-a%2Fset-123%3Fsession%3Dlesson-7",
    );
  });

  it("preserves the dedicated practice-session return flow", () => {
    expect(buildUcatCheckoutReturnPath("practice_session")).toBe(
      "/exam?checkout=success",
    );
  });
});

describe("parseUcatCheckoutRequest", () => {
  it("accepts founder codes without an F- prefix", () => {
    expect(
      parseUcatCheckoutRequest({
        tier: "unlimited",
        interval: "week",
        founderCode: "LAUNCH",
      }),
    ).toMatchObject({ founderCode: "LAUNCH" });
  });
});

describe("parseUcatCheckoutRequest", () => {
  it("accepts founder codes without an F- prefix", () => {
    expect(
      parseUcatCheckoutRequest({
        tier: "unlimited",
        interval: "week",
        founderCode: "LAUNCH",
      }),
    ).toMatchObject({ founderCode: "LAUNCH" });
  });
});
