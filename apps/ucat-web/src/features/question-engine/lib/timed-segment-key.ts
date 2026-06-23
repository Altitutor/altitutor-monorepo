import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";
import { getCurrentMockSegment } from "@/features/question-engine/lib/timing";

/** Stable key for a timed exam segment (review shares the questions segment clock). */
export function getTimedSegmentKey(
  exam: QuestionEngineExam,
  state: Pick<
    QuestionEngineState,
    | "phase"
    | "instructionsIndex"
    | "currentIndex"
    | "mockCurrentSetIndex"
    | "reviewFilter"
  >,
): string {
  if (exam.sourceType === "set") {
    if (state.phase === "instructions") {
      return `set-instructions-${state.instructionsIndex}`;
    }
    if (state.phase === "question" || state.phase === "review") {
      return "set-questions";
    }
    return `set-${state.phase}`;
  }

  if (exam.sourceType === "mock") {
    if (state.phase === "instructions") {
      return `mock-instructions-${state.instructionsIndex}`;
    }
    if (state.phase === "question" || state.phase === "review") {
      const setIndex = state.mockCurrentSetIndex ?? 0;
      return `mock-set-${setIndex}-questions`;
    }
    const seg = getCurrentMockSegment(exam, state as QuestionEngineState);
    if (seg) return `mock-seg-${seg.segmentIndex}`;
    return `mock-${state.phase}-${state.instructionsIndex}-${state.currentIndex}`;
  }

  if (exam.sourceType === "questions" || exam.sourceType === "questionStem") {
    if (state.phase === "question") {
      return `practice-question-${state.currentIndex}`;
    }
    return `practice-${state.phase}-${state.currentIndex}`;
  }

  return `${exam.sourceType}-${state.phase}-${state.instructionsIndex}-${state.currentIndex}`;
}
