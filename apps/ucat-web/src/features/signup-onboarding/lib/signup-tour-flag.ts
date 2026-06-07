const SIGNUP_TOUR_FLAG = "ucat-signup-start-tour";

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
