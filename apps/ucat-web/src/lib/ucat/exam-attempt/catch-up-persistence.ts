import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import { buildFinalAnswersFromEngineSnapshot } from "@/lib/ucat/exam-attempt/build-final-answers";
import { isExamAttemptAtResults } from "@/lib/ucat/exam-attempt/finalize-attempt";
import { catchUpExpiredSegments } from "@/lib/ucat/exam-attempt/segment-catch-up";
import type {
  ExamAttemptKind,
  ExamEngineSnapshot,
} from "@/lib/ucat/exam-attempt/types";

/** Public catch-up persistence seam shared by active-attempt recovery and tests. */
export function buildCatchUpPersistence(
  exam: QuestionEngineExam,
  state: ExamEngineSnapshot,
  currentSegmentEndsAt: string,
  kind: ExamAttemptKind,
) {
  const caught = catchUpExpiredSegments(
    exam,
    state,
    currentSegmentEndsAt,
    { practice: kind === "practice" },
  );
  return {
    caught,
    finalAnswers: isExamAttemptAtResults(kind, caught.state.phase)
      ? buildFinalAnswersFromEngineSnapshot(exam, caught.state)
      : null,
  };
}
