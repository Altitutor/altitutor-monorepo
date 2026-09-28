import { parseStaffProfiles, getStaffProfiles } from "../server/profiles";
jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
const row = {
  staff_id: "staff-1",
  display_name: "A Tutor",
  public_title: "Tutor",
  profile_bio: "<script>bad()</script>",
  profile_image_bucket: "staff-profile-images",
  profile_image_storage_path: "staff/a photo.jpg",
  profile_image_metadata: { profileImageCrop: { x: 200, y: -1, zoom: 2 } },
};

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});
test("uses only public profile images, preserves plain text and clamps the chosen crop", () => {
  const [profile] = parseStaffProfiles([row], "https://example.supabase.co");
  expect(profile.image).toBe(
    "https://example.supabase.co/storage/v1/object/public/staff-profile-images/staff/a%20photo.jpg",
  );
  expect(profile.bio).toBe("<script>bad()</script>");
  expect(profile.crop).toEqual({ x: 100, y: 0, zoom: 2 });
  expect(
    parseStaffProfiles(
      [{ ...row, profile_image_bucket: "private" }],
      "https://example.supabase.co",
    )[0].image,
  ).toBeNull();
});
test("accepts an intentionally empty published roster but rejects malformed responses", () => {
  expect(parseStaffProfiles([], "https://example.supabase.co")).toEqual([]);
  expect(() =>
    parseStaffProfiles([{}], "https://example.supabase.co"),
  ).toThrow();
});
test("database failures throw rather than replacing a cached roster with editorial content", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test";
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response("", { status: 503 }));
  await expect(getStaffProfiles()).rejects.toThrow(
    "Staff profiles unavailable",
  );
});
