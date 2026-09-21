import { Copy } from "@/components/ui";
import { QuestionGrid } from "@/features/question-engine/components/question-grid";
import type { AttemptQuestion } from "./api";
import { formatDuration } from "./metrics";
export const resultLabel = {
  correct: "Correct",
  partial: "Partly correct",
  incorrect: "Incorrect",
  not_attempted: "Unanswered",
};
export function AttemptQuestions({
  questions,
  onSelect,
}: {
  questions: AttemptQuestion[];
  onSelect: (index: number) => void;
}) {
  return (
    <>
      <Copy large>Questions</Copy>
      <QuestionGrid
        questions={questions.map((q, index) => ({
          index,
          number: q.questionNumber,
          stemId: `${q.setIndex ?? 0}:${q.stemIndex}`,
          label: `Question ${q.questionNumber}`,
          answered: q.result !== "not_attempted",
          flagged: q.isFlagged,
          current: false,
          result: q.result,
          timing: formatDuration(q.timeSpentSeconds),
        }))}
        onSelect={onSelect}
      />
    </>
  );
}
