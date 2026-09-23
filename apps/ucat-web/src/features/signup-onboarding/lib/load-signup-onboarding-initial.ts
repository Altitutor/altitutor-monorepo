import { isProfileSetupComplete } from "@/features/auth/lib/signup-profile";
import {
  loadStudentSignupRow,
  resolveSignupState,
  type ResolvedSignupState,
} from "@/features/signup-onboarding/lib/resolve-signup-state";
import type { SignupOnboardingInitial } from "@/features/signup-onboarding/types";

export interface SignupOnboardingPageData {
  initial: SignupOnboardingInitial;
  state: ResolvedSignupState;
}

export async function loadSignupOnboardingPageData(user: {
  id: string;
  email?: string | null;
  new_email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<SignupOnboardingPageData> {
  const student = await loadStudentSignupRow(user.id);
  const state = resolveSignupState(
    student,
    isProfileSetupComplete(user.user_metadata),
  );
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
    state,
    initial: {
      userId: user.id,
      email: user.email ?? "",
      pendingEmail: user.new_email?.trim() ?? "",
      firstName:
        student?.first_name?.trim() ||
        metadataFirstName ||
        fullNameParts[0] ||
        "",
      lastName:
        student?.last_name?.trim() ||
        metadataLastName ||
        (fullNameParts.length > 1 ? fullNameParts.slice(1).join(" ") : ""),
      phone: student?.phone?.trim() ?? "",
      step: state.step,
    },
  };
}
