import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadSignupProfileInitial } from "@/features/auth/lib/signup-profile";
import { resolveSignupStateForUser } from "@/features/signup-onboarding/lib/resolve-signup-state";
import type { SignupOnboardingInitial } from "@/features/signup-onboarding/types";

export async function loadSignupOnboardingInitial(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<SignupOnboardingInitial> {
  const profile = await loadSignupProfileInitial(user.id);
  const state = await resolveSignupStateForUser(user);

  let testYear: number | null = null;
  let testDate: string | null = null;
  let targetScores = { s1: null as number | null, s2: null as number | null, s3: null as number | null };

  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("students")
      .select(
        "ucat_test_year, ucat_test_date, ucat_target_score_s1, ucat_target_score_s2, ucat_target_score_s3",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    testYear = data?.ucat_test_year ?? null;
    testDate = data?.ucat_test_date ?? null;
    targetScores = {
      s1: data?.ucat_target_score_s1 ?? null,
      s2: data?.ucat_target_score_s2 ?? null,
      s3: data?.ucat_target_score_s3 ?? null,
    };
  }

  return {
    email: user.email ?? "",
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    step: state.step,
    testYear: testYear ?? state.testYear,
    testDate,
    targetScores,
  };
}
