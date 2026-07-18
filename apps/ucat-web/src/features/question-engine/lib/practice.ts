import type { QuestionItem } from "@/features/question-engine/model/types";
import {
  getClientPracticeQuestionDisplaySeconds,
  getQuestionDisplaySeconds,
  type ClientPracticeQuestionTiming,
  type PracticeActiveQuestionTiming,
} from "@/features/question-engine/lib/practice-question-timing";

/**
 * Returns the start and end indices (inclusive) of the stem containing the question at the given index.
 * In question mode (each question has unique stem), returns [index, index].
 * In question stem mode, returns the full range of questions sharing the same stemId.
 */
export function getStemBoundaries(
  questions: QuestionItem[],
  questionIndex: number,
  mode: "questions" | "questionStem",
): { startIndex: number; endIndex: number } {
  if (mode === "questions") {
    return { startIndex: questionIndex, endIndex: questionIndex };
  }

  const q = questions[questionIndex];
  if (!q) return { startIndex: questionIndex, endIndex: questionIndex };

  let startIndex = questionIndex;
  while (startIndex > 0 && questions[startIndex - 1]?.stemId === q.stemId) {
    startIndex -= 1;
  }

  let endIndex = questionIndex;
  while (
    endIndex < questions.length - 1 &&
    questions[endIndex + 1]?.stemId === q.stemId
  ) {
    endIndex += 1;
  }

  return { startIndex, endIndex };
}

/**
 * Returns true if the question at index is the last question of its unit (question or stem).
 */
export function isLastQuestionOfUnit(
  questions: QuestionItem[],
  questionIndex: number,
  mode: "questions" | "questionStem",
): boolean {
  const { endIndex } = getStemBoundaries(questions, questionIndex, mode);
  return questionIndex >= endIndex;
}

export type StemQuestionTime = {
  questionId: string;
  label: string;
  seconds: number;
};

export function computeStemQuestionTimes(
  questions: QuestionItem[],
  startIndex: number,
  endIndex: number,
  persistedSecondsByQuestionId: Record<string, number>,
  options?: {
    activeQuestionTiming?: PracticeActiveQuestionTiming | null;
    nowMs?: number;
  },
): { stemTimeSeconds: number; stemQuestionTimes: StemQuestionTime[] } {
  const nowMs = options?.nowMs ?? Date.now();
  return computeStemQuestionTimesFromDisplay(
    questions,
    startIndex,
    endIndex,
    (questionId) =>
      getQuestionDisplaySeconds(
        questionId,
        persistedSecondsByQuestionId,
        options?.activeQuestionTiming,
        nowMs,
      ),
  );
}

export function computeClientStemQuestionTimes(
  questions: QuestionItem[],
  startIndex: number,
  endIndex: number,
  clientTiming: ClientPracticeQuestionTiming,
  nowMs: number = Date.now(),
): { stemTimeSeconds: number; stemQuestionTimes: StemQuestionTime[] } {
  return computeStemQuestionTimesFromDisplay(
    questions,
    startIndex,
    endIndex,
    (questionId) =>
      getClientPracticeQuestionDisplaySeconds(questionId, clientTiming, nowMs),
  );
}

export function computeReconciledStemQuestionTimes(
  questions: QuestionItem[],
  startIndex: number,
  endIndex: number,
  persistedSecondsByQuestionId: Record<string, number>,
  clientTiming: ClientPracticeQuestionTiming,
  nowMs: number = Date.now(),
): { stemTimeSeconds: number; stemQuestionTimes: StemQuestionTime[] } {
  return computeStemQuestionTimesFromDisplay(
    questions,
    startIndex,
    endIndex,
    (questionId) =>
      Math.max(
        getQuestionDisplaySeconds(
          questionId,
          persistedSecondsByQuestionId,
          null,
          nowMs,
        ),
        getClientPracticeQuestionDisplaySeconds(
          questionId,
          clientTiming,
          nowMs,
        ),
      ),
  );
}

function computeStemQuestionTimesFromDisplay(
  questions: QuestionItem[],
  startIndex: number,
  endIndex: number,
  getQuestionSeconds: (questionId: string) => number,
): { stemTimeSeconds: number; stemQuestionTimes: StemQuestionTime[] } {
  const stemQuestionTimes: StemQuestionTime[] = [];
  let stemTimeSeconds = 0;

  for (let index = startIndex; index <= endIndex; index++) {
    const question = questions[index];
    if (!question) continue;
    const seconds = getQuestionSeconds(question.id);
    stemTimeSeconds += seconds;
    stemQuestionTimes.push({
      questionId: question.id,
      label: `Q${index - startIndex + 1}`,
      seconds,
    });
  }

  return { stemTimeSeconds, stemQuestionTimes };
}
