import { profileTitle } from "../profile-title";
import { getStaffProfiles } from "../server/profiles";
jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
test("removes old subject lists while preserving titles", () => {
  expect(profileTitle("UCAT COURSE MANAGERTutor: Biology, UCAT")).toBe(
    "UCAT COURSE MANAGER",
  );
  expect(profileTitle("Tutor : Biology, Chemistry")).toBe("");
});
test("adds administrative staff without replacing other titles or duplicating it", () => {
  expect(profileTitle("Course manager Tutor: Physics", true)).toBe(
    "Course manager\nAdministrative staff",
  );
  expect(profileTitle("ADMINISTRATIVE STAFF", true)).toBe(
    "ADMINISTRATIVE STAFF",
  );
});
test("unconfigured previews have real badges, new portraits and administrative titles", async () => {
  const profiles = await getStaffProfiles();
  const matt = profiles.find((person) => person.name === "Matthew Chua");
  expect(matt?.subjects).toContain("SACE Biology");
  expect(matt?.title).toContain("Administrative staff");
  expect(matt?.title).not.toMatch(/Tutor\s*:/i);
  expect(matt?.image).toContain("staff-profile-images/");
  expect(profiles.flatMap((person) => person.subjects)).not.toContain(
    "Homework Help",
  );
});
