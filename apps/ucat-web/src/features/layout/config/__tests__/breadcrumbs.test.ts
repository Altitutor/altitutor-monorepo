import { getBreadcrumbItems } from "@/features/layout/config/breadcrumbs";

const ATTEMPT_ID = "5085d8f3-33e8-4c50-80ac-a57b42deaa88";
const MOCK_ID = "e1117590-8d45-46b0-bdf0-438152dc6d1e";
const SET_ID = "59b990a4-6777-4bd5-ad0f-a31a5c1911ba";
const SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function labels(pathname: string): string[] {
  return getBreadcrumbItems(pathname).map((item) => item.label);
}

function hrefs(pathname: string): (string | undefined)[] {
  return getBreadcrumbItems(pathname).map((item) => item.effectiveHref ?? undefined);
}

describe("getBreadcrumbItems", () => {
  it("returns empty array for exam routes", () => {
    expect(getBreadcrumbItems("/exam/sets")).toEqual([]);
  });

  it("omits structural segments on progress set-attempt section route", () => {
    expect(
      labels(`/progress/sections/3/set-attempts/${ATTEMPT_ID}`),
    ).toEqual(["Progress", "Quantitative Reasoning", "Set attempt"]);

    expect(
      hrefs(`/progress/sections/3/set-attempts/${ATTEMPT_ID}`),
    ).toEqual([
      "/progress",
      "/progress/sections/3",
      `/progress/sections/3/set-attempts/${ATTEMPT_ID}`,
    ]);
  });

  it("omits structural segments on flat progress set-attempt route", () => {
    expect(labels(`/progress/set-attempts/${ATTEMPT_ID}`)).toEqual([
      "Progress",
      "Set attempt",
    ]);
  });

  it("omits structural segments on progress mock-attempt nested set route", () => {
    expect(
      labels(`/progress/mock-attempts/${MOCK_ID}/sets/${SET_ID}`),
    ).toEqual(["Progress", "Mock attempt", "Set"]);

    expect(
      hrefs(`/progress/mock-attempts/${MOCK_ID}/sets/${SET_ID}`),
    ).toEqual([
      "/progress",
      `/progress/mock-attempts/${MOCK_ID}`,
      `/progress/mock-attempts/${MOCK_ID}/sets/${SET_ID}`,
    ]);
  });

  it("omits structural segments on sets section detail route", () => {
    expect(labels(`/sets/sections/1/${SET_ID}`)).toEqual([
      "Sets",
      "Verbal Reasoning",
      "Set",
    ]);

    expect(hrefs(`/sets/sections/1/${SET_ID}`)).toEqual([
      "/sets",
      "/sets/sections/1",
      `/sets/sections/1/${SET_ID}`,
    ]);
  });

  it("omits structural segments on sets section list route", () => {
    expect(labels("/sets/sections/2")).toEqual(["Sets", "Decision Making"]);
  });

  it("omits structural segments on session set detail route", () => {
    expect(labels(`/sessions/${SESSION_ID}/sets/${SET_ID}`)).toEqual([
      "Sessions",
      "Session",
      "Set",
    ]);
  });

  it("omits structural segments on session mock detail route", () => {
    expect(labels(`/sessions/${SESSION_ID}/mocks/${MOCK_ID}`)).toEqual([
      "Sessions",
      "Session",
      "Mock",
    ]);
  });

  it("keeps valid intermediate pages on progress mocks section route", () => {
    expect(labels("/progress/mocks/sections/3")).toEqual([
      "Progress",
      "Mocks",
      "Quantitative Reasoning",
    ]);

    expect(hrefs("/progress/mocks/sections/3")).toEqual([
      "/progress",
      "/progress/mocks",
      "/progress/mocks/sections/3",
    ]);
  });

  it("keeps settings hub on nested settings routes", () => {
    expect(labels("/settings/profile")).toEqual(["Settings", "My profile"]);
    expect(hrefs("/settings/profile")).toEqual(["/settings", "/settings/profile"]);
  });

  it("omits practice-sessions structural segment", () => {
    expect(labels(`/progress/practice-sessions/${ATTEMPT_ID}`)).toEqual([
      "Progress",
      "Practice session",
    ]);
  });
});
