import { isTransientSupabaseError } from "@/lib/supabase/transient-error";

describe("isTransientSupabaseError", () => {
  it.each([
    [
      {
        code: "57014",
        message: "canceling statement due to statement timeout",
      },
    ],
    [{ status: 504, message: "context deadline exceeded" }],
    [new Error("fetch failed")],
  ])("recognises a retryable dependency failure", (error) => {
    expect(isTransientSupabaseError(error)).toBe(true);
  });

  it("does not hide a permanent query error as an outage", () => {
    expect(
      isTransientSupabaseError({ code: "42703", message: "column missing" }),
    ).toBe(false);
  });
});
