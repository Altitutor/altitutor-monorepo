import { formatBlockLabel } from "@/features/learning/lib/format-block-label";
import type { LearningModuleBlockRow } from "@/features/learning/types";

// Published lessons use these headings for worked feedback on the immediately preceding question.
const workedSolutionHeading = /^(?:worked solution(?:$|:)|feedback(?:$|:| and )|review the reasoning$|what to notice(?: from | and quick summary$))/i;

export function isWorkedSolutionAfterQuestion(
  block: LearningModuleBlockRow,
  previous: LearningModuleBlockRow | undefined,
): boolean {
  return (
    block.block_type === "text" &&
    (previous?.block_type === "question" || previous?.block_type === "question_stem") &&
    workedSolutionHeading.test(formatBlockLabel(block))
  );
}

export function hasSubmittedLessonQuestion(block: LearningModuleBlockRow): boolean {
  const state = block.interaction_state;
  return (
    state != null &&
    typeof state === "object" &&
    !Array.isArray(state) &&
    state.completedFromQuestionEngine === true
  );
}
