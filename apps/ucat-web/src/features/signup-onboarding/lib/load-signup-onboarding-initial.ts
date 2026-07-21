import { loadSignupProfileInitial } from "@/features/auth/lib/signup-profile";
import { resolveSignupStateForUser } from "@/features/signup-onboarding/lib/resolve-signup-state";
import type { SignupOnboardingInitial } from "@/features/signup-onboarding/types";

export async function loadSignupOnboardingInitial(user: {
  id: string;
  email?: string | null;
  new_email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<SignupOnboardingInitial> {
  const profile = await loadSignupProfileInitial(user.id);
  const state = await resolveSignupStateForUser(user);
  const metadata = user.user_metadata;
  const metadataFirstName =
    typeof metadata?.given_name === "string"
      ? metadata.given_name.trim()
      : typeof metadata?.first_name === "string"
        ? metadata.first_name.trim()
        : "";
  const metadataLastName =
    typeof metadata?.family_name === "string"
      ? metadata.family_name.trim()
      : typeof metadata?.last_name === "string"
        ? metadata.last_name.trim()
        : "";
  const fullName =
    typeof metadata?.full_name === "string"
      ? metadata.full_name.trim()
      : typeof metadata?.name === "string"
        ? metadata.name.trim()
        : "";
  const fullNameParts = fullName.split(/\s+/).filter(Boolean);

  return {
    email: user.email ?? "",
    pendingEmail: user.new_email?.trim() ?? "",
    firstName: profile.firstName || metadataFirstName || fullNameParts[0] || "",
    lastName:
      profile.lastName ||
      metadataLastName ||
      (fullNameParts.length > 1 ? fullNameParts.slice(1).join(" ") : ""),
    phone: profile.phone,
    newsletterOptIn: metadata?.pending_newsletter_opt_in === true,
    step: state.step,
  };
}
