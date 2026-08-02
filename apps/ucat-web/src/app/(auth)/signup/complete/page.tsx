import { Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SignupOnboardingWizard } from "@/features/signup-onboarding/components/signup-onboarding-wizard";
import { SignupCompleteHardRedirect } from "@/features/signup-onboarding/components/signup-complete-hard-redirect";
import { SignupCompleteSessionFallback } from "@/features/signup-onboarding/components/signup-complete-session-fallback";
import { loadSignupOnboardingInitial } from "@/features/signup-onboarding/lib/load-signup-onboarding-initial";
import { resolveSignupStateForUser } from "@/features/signup-onboarding/lib/resolve-signup-state";
import { safePostAuthReturnPath } from "@/features/auth/lib/return-intent";

// getSupabaseServerClient intentionally uses an empty-cookie placeholder during
// `next build`. Without this explicit contract, Next prerenders the fallback
// below and serves "no signup session" to every user from the static artifact.
export const dynamic = "force-dynamic";

async function resolveSignupCompleteUser(): Promise<User | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  // Middleware already validated via getUser(). A concurrent refresh race can
  // make this page's getUser() return null while cookies still hold a session.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user ?? null;
}

export default async function SignupCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safePostAuthReturnPath(params.redirect);
  const user = await resolveSignupCompleteUser();

  if (!user) {
    return <SignupCompleteSessionFallback />;
  }

  const state = await resolveSignupStateForUser(user);
  if (state.signupCompleted) {
    // Soft redirect("/dashboard") races middleware when the access view
    // briefly reports incomplete → soft-nav storm / blank screen.
    return <SignupCompleteHardRedirect to={returnTo} />;
  }

  const initial = await loadSignupOnboardingInitial(user);

  return (
    <Suspense fallback={null}>
      <SignupOnboardingWizard initial={initial} />
    </Suspense>
  );
}
