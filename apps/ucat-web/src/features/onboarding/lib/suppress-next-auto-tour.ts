/**
 * When replaying a tour from Settings we reset the tour, navigate to its page,
 * then start it manually. {@link OnboardingAutoStart} would otherwise schedule
 * the same tour ~600ms later — this flag skips that duplicate start once.
 */
let suppressedTourId: string | null = null;

export function suppressNextOnboardingAutoStart(tourId: string) {
  suppressedTourId = tourId;
}

export function consumeOnboardingAutoStartSuppression(tourId: string): boolean {
  if (suppressedTourId !== tourId) {
    return false;
  }
  suppressedTourId = null;
  return true;
}
