const TUTORIAL_REPLAY_KEY = "ucat-contextual-tutorial-replay";

export interface TutorialReplayContext {
  tourId: string;
  returnTo: string;
}

function isSafeAppPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  );
}

export function beginTutorialReplay(context: TutorialReplayContext): void {
  if (typeof window === "undefined" || !isSafeAppPath(context.returnTo)) return;
  window.sessionStorage.setItem(TUTORIAL_REPLAY_KEY, JSON.stringify(context));
}

export function readTutorialReplay(
  tourId: string | null,
): TutorialReplayContext | null {
  if (typeof window === "undefined" || !tourId) return null;
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(TUTORIAL_REPLAY_KEY) ?? "null",
    ) as Partial<TutorialReplayContext> | null;
    if (
      parsed?.tourId !== tourId ||
      !isSafeAppPath(parsed.returnTo)
    ) {
      return null;
    }
    return { tourId, returnTo: parsed.returnTo };
  } catch {
    return null;
  }
}

export function clearTutorialReplay(tourId: string): void {
  if (typeof window === "undefined") return;
  const replay = readTutorialReplay(tourId);
  if (replay) window.sessionStorage.removeItem(TUTORIAL_REPLAY_KEY);
}
