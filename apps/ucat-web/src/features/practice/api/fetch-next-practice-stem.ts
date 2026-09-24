import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import { assertOkOrQuotaExceeded } from "@/lib/ucat/quota/parse-quota-error";

export class PracticeStemRequestError extends Error {
  constructor(readonly status: number) {
    super(`Failed to load the next practice stem (${status})`);
    this.name = "PracticeStemRequestError";
  }
}

/**
 * A successful response with a null stem is the only exhaustion signal.
 * Transport and server failures must stay distinguishable so the question
 * engine never turns a transient failure into a completed practice session.
 */
export async function fetchNextPracticeStem(
  practiceSessionId: string,
  input: PracticeSelectionInput,
  excludeStemIds: string[],
  options?: { preview?: boolean; deliverStemId?: string },
): Promise<QuestionStemWithQuestions | null> {
  const response = await fetch("/api/ucat/practice-stems/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      excludeStemIds,
      practiceSessionId,
      preview: options?.preview,
      deliverStemId: options?.deliverStemId,
    }),
  });

  if (!response.ok) {
    await assertOkOrQuotaExceeded(response);
    throw new PracticeStemRequestError(response.status);
  }

  const data = (await response.json()) as {
    stem: QuestionStemWithQuestions | null;
  };
  return data.stem;
}

/** Reconciles a superseded preview once through server-owned delivery state. */
export async function fetchDeliveredPracticeStem(
  practiceSessionId: string,
  input: PracticeSelectionInput,
  excludeStemIds: string[],
  prefetchedStemId?: string,
): Promise<QuestionStemWithQuestions | null> {
  try {
    return await fetchNextPracticeStem(
      practiceSessionId,
      input,
      excludeStemIds,
      prefetchedStemId ? { deliverStemId: prefetchedStemId } : undefined,
    );
  } catch (error) {
    if (
      prefetchedStemId &&
      error instanceof PracticeStemRequestError &&
      error.status === 409
    ) {
      return fetchNextPracticeStem(practiceSessionId, input, excludeStemIds);
    }
    throw error;
  }
}
