/**
 * Per-tour completion persistence for the UCAT onboarding flows.
 *
 * Uses localStorage with one key per tour. Keys are namespaced with the tour
 * version so we can re-show a specific tour to existing users after a major
 * change by bumping `TOUR_VERSIONS` entry (without affecting other tours).
 *
 * The storage shape is intentionally simple so it can be replaced with a
 * server-backed JSONB column on `students` (e.g. `onboarding_progress`)
 * later without touching tour components or the auto-start logic.
 */

const KEY_PREFIX = "ucat-onboarding";

/**
 * Bump the integer for a single tour to force it to re-show. Tours not
 * listed default to v1.
 */
const TOUR_VERSIONS: Record<string, number> = {
  // "ucat-welcome": 2, // example: bumping this would re-show the welcome tour
};

function versionFor(tourId: string): number {
  return TOUR_VERSIONS[tourId] ?? 1;
}

function keyFor(tourId: string): string {
  return `${KEY_PREFIX}:${tourId}:v${versionFor(tourId)}`;
}

export const onboardingStorage = {
  isCompleted(tourId: string): boolean {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(keyFor(tourId)) === "true";
    } catch {
      return false;
    }
  },

  markCompleted(tourId: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(keyFor(tourId), "true");
    } catch {
      // Storage unavailable (private mode, quota). Fail silently.
    }
  },

  reset(tourId: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(keyFor(tourId));
    } catch {
      // Storage unavailable; nothing to clear.
    }
  },

  resetAll(tourIds: readonly string[]): void {
    for (const id of tourIds) {
      this.reset(id);
    }
  },
};
