import {
  createAndPersistPracticeSession,
  type PracticeSessionStartInput,
} from "@/features/practice/api/create-practice-session";
import type { PracticeSessionData } from "@/features/practice/lib/session-storage";
import {
  clearPendingPracticeStart,
  getPendingPracticeStart,
} from "@/features/practice/lib/session-storage";

/**
 * Dedupes Strict Mode double-mount so we only create one session from a
 * claimed pending start.
 */
let inFlightPendingCreate: Promise<PracticeSessionData> | null = null;

export function getInFlightPendingPracticeCreate(): Promise<PracticeSessionData> | null {
  return inFlightPendingCreate;
}

export function claimAndCreatePracticeSessionFromPending(
  override?: PracticeSessionStartInput,
): Promise<PracticeSessionData> | null {
  if (inFlightPendingCreate) return inFlightPendingCreate;

  const pending = override ?? getPendingPracticeStart();
  if (!pending) return null;

  clearPendingPracticeStart();
  inFlightPendingCreate = createAndPersistPracticeSession(pending).finally(
    () => {
      inFlightPendingCreate = null;
    },
  );
  return inFlightPendingCreate;
}
