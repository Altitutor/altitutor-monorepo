import type { QuestionItem } from "@/features/question-engine/model/types";

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
