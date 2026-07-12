import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";

export const PRACTICE_SESSION_KEY = "practice-session";
export const PENDING_PRACTICE_START_KEY = "pending-practice-start";

export type PracticeReviewTiming = "afterEachStem" | "atEnd";

export type PendingPracticeStart = {
  payload: SetGeneratorInput & {
    unlimited?: boolean;
    reviewTiming: PracticeReviewTiming;
  };
  ucatSectionId: string;
};

export type PracticeSessionFilterMeta = {
  sectionLabel?: string;
  categoryLabels?: string[];
  examTimePerQuestionSeconds?: number | null;
};

export type PracticeSessionData =
  | {
      mode: "set";
      sessionId: string;
      stems: QuestionStemWithQuestions[];
      filters?: SetGeneratorInput;
      filterMeta?: PracticeSessionFilterMeta;
      timePerQuestionSeconds: number | null;
      startedAtMs?: number;
      reviewTiming?: PracticeReviewTiming;
    }
  | {
      mode: "unlimited";
      sessionId: string;
      filters: SetGeneratorInput;
      stems?: QuestionStemWithQuestions[];
      filterMeta?: PracticeSessionFilterMeta;
      timePerQuestionSeconds: number | null;
      startedAtMs?: number;
      reviewTiming?: PracticeReviewTiming;
    };

export function getPracticeSession(): PracticeSessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PRACTICE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PracticeSessionData;
    if (
      parsed.mode === "set" &&
      parsed.sessionId &&
      Array.isArray(parsed.stems) &&
      parsed.stems.length > 0
    ) {
      return parsed;
    }
    if (
      parsed.mode === "unlimited" &&
      parsed.sessionId &&
      parsed.filters?.section
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setPracticeSession(data: PracticeSessionData): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PRACTICE_SESSION_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota or other storage errors
  }
}

export function clearPracticeSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PRACTICE_SESSION_KEY);
  } catch {
    // Ignore
  }
}

export function getPendingPracticeStart(): PendingPracticeStart | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_PRACTICE_START_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPracticeStart;
    if (!parsed.ucatSectionId || !parsed.payload?.section) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setPendingPracticeStart(data: PendingPracticeStart): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_PRACTICE_START_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota or other storage errors
  }
}

export function clearPendingPracticeStart(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_PRACTICE_START_KEY);
  } catch {
    // Ignore
  }
}
