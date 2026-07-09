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

  return {
    email: user.email ?? "",
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    step: state.step,
  };
}
