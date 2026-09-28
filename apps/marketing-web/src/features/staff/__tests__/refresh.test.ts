import { POST } from "@/app/api/staff/refresh/route";
import { revalidatePath, revalidateTag } from "next/cache";
jest.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test";
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});
test("anonymous requests cannot invalidate the page", async () => {
  expect(
    (
      await POST(
        new Request("http://localhost/api/staff/refresh", { method: "POST" }),
      )
    ).status,
  ).toBe(401);
  expect(revalidatePath).not.toHaveBeenCalled();
});
test("non-admin JWTs cannot invalidate the page", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(Response.json(false));
  expect(
    (
      await POST(
        new Request("http://localhost/api/staff/refresh", {
          method: "POST",
          headers: { authorization: "Bearer tutor" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(revalidateTag).not.toHaveBeenCalled();
});
test("verified active admins invalidate both profile data and the about page", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(Response.json(true));
  expect(
    (
      await POST(
        new Request("http://localhost/api/staff/refresh", {
          method: "POST",
          headers: { authorization: "Bearer admin" },
        }),
      )
    ).status,
  ).toBe(200);
  expect(revalidateTag).toHaveBeenCalledWith("marketing-staff-profiles");
  expect(revalidatePath).toHaveBeenCalledWith("/about/");
});
