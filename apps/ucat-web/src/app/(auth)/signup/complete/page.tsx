import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SignupOnboardingWizard } from "@/features/signup-onboarding/components/signup-onboarding-wizard";
import { loadSignupOnboardingInitial } from "@/features/signup-onboarding/lib/load-signup-onboarding-initial";
import { resolveSignupStateForUser } from "@/features/signup-onboarding/lib/resolve-signup-state";

export default async function SignupCompletePage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signup");
  }

  const state = await resolveSignupStateForUser(user);
  if (state.signupCompleted) {
    redirect("/dashboard");
  }

  const initial = await loadSignupOnboardingInitial(user);

  return (
    <Suspense fallback={null}>
      <SignupOnboardingWizard initial={initial} />
    </Suspense>
  );
}
