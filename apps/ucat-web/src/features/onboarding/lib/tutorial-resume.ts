const TUTORIAL_RESUME_STORAGE_KEY = "ucat-contextual-tutorial-resume";

export type TutorialResumeState = {
  tourId: string;
  stepIndex: number;
  pathname: string;
};

function isTutorialResumeState(value: unknown): value is TutorialResumeState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TutorialResumeState>;
  return (
    typeof candidate.tourId === "string" &&
    typeof candidate.stepIndex === "number" &&
    Number.isInteger(candidate.stepIndex) &&
    candidate.stepIndex >= 0 &&
    typeof candidate.pathname === "string" &&
    candidate.pathname.startsWith("/")
  );
}

export function saveTutorialResume(state: TutorialResumeState): void {
  if (typeof window === "undefined") return;
  const retained = readAllTutorialResumes().filter(
    (candidate) =>
      candidate.tourId !== state.tourId || candidate.pathname !== state.pathname,
  );
  writeAllTutorialResumes([...retained, state]);
}

function readAllTutorialResumes(): TutorialResumeState[] {
  if (typeof window === "undefined") return [];
  let stored: string | null;
  try {
    stored = window.sessionStorage.getItem(TUTORIAL_RESUME_STORAGE_KEY);
  } catch {
    return [];
  }
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (isTutorialResumeState(parsed)) return [parsed];
    if (Array.isArray(parsed) && parsed.every(isTutorialResumeState)) {
      return parsed;
    }
  } catch {
    // Invalid session state should never prevent a tutorial from starting.
  }

  writeAllTutorialResumes([]);
  return [];
}

function writeAllTutorialResumes(states: TutorialResumeState[]): void {
  try {
    if (states.length === 0) {
      window.sessionStorage.removeItem(TUTORIAL_RESUME_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(
      TUTORIAL_RESUME_STORAGE_KEY,
      JSON.stringify(states.length === 1 ? states[0] : states),
    );
  } catch {
    // Best effort only; an unavailable store is equivalent to no resume state.
  }
}

export function readTutorialResume(
  tourId?: string,
  pathname?: string,
): TutorialResumeState | null {
  const matches = readAllTutorialResumes().filter(
    (state) =>
      (!tourId || state.tourId === tourId) &&
      (!pathname || state.pathname === pathname),
  );
  return matches.at(-1) ?? null;
}

export function consumeTutorialResume(
  tourId: string,
  pathname: string,
): TutorialResumeState | null {
  const state = readTutorialResume(tourId, pathname);
  if (!state) return null;
  writeAllTutorialResumes(
    readAllTutorialResumes().filter(
      (candidate) =>
        candidate.tourId !== tourId || candidate.pathname !== pathname,
    ),
  );
  return state;
}

export function clearTutorialResume(tourId?: string): void {
  if (typeof window === "undefined") return;
  writeAllTutorialResumes(
    tourId
      ? readAllTutorialResumes().filter((state) => state.tourId !== tourId)
      : [],
  );
}

/**
 * Records the exact step and destination for a required interaction that
 * navigates between pages. The destination page can then resume the same tour
 * without briefly rendering the next spotlight against the old page.
 */
export function handoffTutorialToPath(input: TutorialResumeState): void {
  saveTutorialResume(input);
}
