const SIGNUP_TOUR_FLAG = "ucat-signup-start-tour";
const SIGNUP_JUST_COMPLETED_FLAG = "ucat-signup-just-completed";

/** Signal dashboard welcome tour after signup onboarding completes. */
export function markSignupOnboardingTourPending() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SIGNUP_TOUR_FLAG, "1");
}

export function consumeSignupOnboardingTourPending(): boolean {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(SIGNUP_TOUR_FLAG) !== "1") return false;
  sessionStorage.removeItem(SIGNUP_TOUR_FLAG);
  return true;
}

/** Prevents OnboardingGateRedirect from bouncing back before access cache refreshes. */
export function markSignupJustCompleted() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SIGNUP_JUST_COMPLETED_FLAG, "1");
}

export function isSignupJustCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SIGNUP_JUST_COMPLETED_FLAG) === "1";
}

export function clearSignupJustCompleted() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SIGNUP_JUST_COMPLETED_FLAG);
}
