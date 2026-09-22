import React from "react";
import SignupCompletePage, { dynamic } from "../page";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock(
  "@/features/signup-onboarding/components/signup-onboarding-wizard",
  () => ({ SignupOnboardingWizard: () => null }),
);
jest.mock(
  "@/features/signup-onboarding/components/signup-complete-hard-redirect",
  () => ({ SignupCompleteHardRedirect: () => null }),
);
jest.mock(
  "@/features/signup-onboarding/components/signup-complete-session-fallback",
  () => ({ SignupCompleteSessionFallback: () => null }),
);

const student = {
  ucat_signup_step: 1,
  ucat_signup_completed_at: null,
  ucat_onboarding_completed_at: null,
  first_name: "Test",
  last_name: "Student",
  phone: "0400000000",
};

function studentQuery() {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: student, error: null }),
      }),
    }),
  };
}

describe("/signup/complete rendering contract", () => {
  beforeEach(() => {
    Object.assign(globalThis, { React });
    jest.clearAllMocks();
    jest.mocked(getSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "student@example.com",
              user_metadata: {},
            },
          },
        }),
        getSession: jest.fn(),
      },
    } as unknown as Awaited<ReturnType<typeof getSupabaseServerClient>>);
    jest
      .mocked(supabaseAdmin!.from)
      .mockImplementation(() => studentQuery() as never);
  });

  it("is never prerendered without the request's auth cookies", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("loads the signup student once", async () => {
    await SignupCompletePage({ searchParams: Promise.resolve({}) });

    expect(supabaseAdmin!.from).toHaveBeenCalledTimes(1);
    expect(supabaseAdmin!.from).toHaveBeenCalledWith("students");
  });
});
