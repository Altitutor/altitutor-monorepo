import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import type {
  PracticeReviewTiming,
  PracticeSessionData,
  PracticeSessionFilterMeta,
  StudyPlanPracticeLink,
} from "@/features/practice/lib/session-storage";
import { setPracticeSession } from "@/features/practice/lib/session-storage";
import { assertOkOrQuotaExceeded } from "@/lib/ucat/quota/parse-quota-error";

export type PracticeSessionStartInput = {
  payload: PracticeSelectionInput & {
    unlimited?: boolean;
    reviewTiming: PracticeReviewTiming;
  };
  ucatSectionId: string;
  filterMeta?: PracticeSessionFilterMeta;
  studyPlan?: StudyPlanPracticeLink;
};

export type CreatePracticeSessionResult =
  | {
      unlimited: true;
      sessionId: string;
      stems: [];
    }
  | {
      unlimited?: false;
      sessionId: string;
      stems: QuestionStemWithQuestions[];
      questionCount: number;
      totalMatchingQuestions: number;
    };

export async function createPracticeSession(
  input: PracticeSessionStartInput,
): Promise<CreatePracticeSessionResult> {
  const { unlimited, reviewTiming, ...filters } = input.payload;
  const sectionKey = filters.section;
  const filtersSnapshot = {
    ...filters,
    reviewTiming,
    ...(input.studyPlan ? { studyPlanTaskId: input.studyPlan.taskId } : {}),
  };

  if (unlimited) {
    const createSessionRes = await fetch("/api/ucat/practice-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionKey,
        ucatSectionId: input.ucatSectionId,
        filtersSnapshot,
        unlimited: true,
      }),
    });

    if (!createSessionRes.ok) {
      await assertOkOrQuotaExceeded(createSessionRes);
      const body = (await createSessionRes.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(body.error ?? "Failed to create practice session");
    }

    const { id: sessionId } = (await createSessionRes.json()) as {
      id: string;
    };
    return { unlimited: true, stems: [], sessionId };
  }

  const createSessionRes = await fetch("/api/ucat/practice-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sectionKey,
      ucatSectionId: input.ucatSectionId,
      filtersSnapshot,
      unlimited: false,
    }),
  });

  if (!createSessionRes.ok) {
    await assertOkOrQuotaExceeded(createSessionRes);
    const body = (await createSessionRes.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? "Failed to create practice session");
  }

  const sessionData = (await createSessionRes.json()) as {
    id: string;
    stems: QuestionStemWithQuestions[];
    questionCount: number;
    totalMatchingQuestions: number;
  };

  return {
    stems: sessionData.stems,
    questionCount: sessionData.questionCount,
    totalMatchingQuestions: sessionData.totalMatchingQuestions,
    sessionId: sessionData.id,
  };
}

export function buildPracticeSessionData(
  result: CreatePracticeSessionResult,
  input: PracticeSessionStartInput,
): PracticeSessionData {
  const timePerQuestionSeconds =
    input.payload.timePerQuestionSeconds != null &&
    input.payload.timePerQuestionSeconds > 0
      ? input.payload.timePerQuestionSeconds
      : null;

  if (result.unlimited) {
    return {
      mode: "unlimited",
      sessionId: result.sessionId,
      filters: input.payload,
      filterMeta: input.filterMeta,
      timePerQuestionSeconds,
      startedAtMs: Date.now(),
      reviewTiming: input.payload.reviewTiming,
      studyPlan: input.studyPlan,
    };
  }

  return {
    mode: "set",
    sessionId: result.sessionId,
    stems: result.stems,
    filters: input.payload,
    filterMeta: input.filterMeta,
    timePerQuestionSeconds,
    startedAtMs: Date.now(),
    reviewTiming: input.payload.reviewTiming,
    studyPlan: input.studyPlan,
  };
}

export async function createAndPersistPracticeSession(
  input: PracticeSessionStartInput,
): Promise<PracticeSessionData> {
  const result = await createPracticeSession(input);
  const data = buildPracticeSessionData(result, input);
  setPracticeSession(data);
  return data;
}
