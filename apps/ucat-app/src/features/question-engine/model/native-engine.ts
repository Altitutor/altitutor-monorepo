import type { QuestionEngineExam, QuestionItem } from "./types";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";
import { snapshotQuestionResponse } from "@/features/question-engine/lib/response-state";
export type Segment = {
  phase: "instructions" | "question";
  start: number;
  end: number;
  seconds: number | null;
  instructionsIndex: number;
  setIndex: number;
};
export function segmentsFor(exam: QuestionEngineExam): Segment[] {
  if (exam.mockTimingSegments)
    return exam.mockTimingSegments.map((s) =>
      s.type === "instructions"
        ? {
            phase: "instructions",
            start: 0,
            end: 0,
            seconds: s.timeLimitSeconds,
            instructionsIndex: s.instructionsIndex,
            setIndex: 0,
          }
        : {
            phase: "question",
            start: s.questionStartIndex,
            end: s.questionEndIndex,
            seconds: s.timeLimitSeconds,
            instructionsIndex: 0,
            setIndex: s.setIndex,
          },
    );
  return [
    ...exam.instructionsScreens.map(
      (_, i): Segment => ({
        phase: "instructions",
        start: 0,
        end: 0,
        seconds: exam.setModeTiming?.instructionsTimeLimitSeconds ?? null,
        instructionsIndex: i,
        setIndex: 0,
      }),
    ),
    {
      phase: "question" as const,
      start: 0,
      end: exam.questions.length,
      seconds:
        exam.setModeTiming?.setTimeLimitSeconds ??
        exam.practiceSessionTimeLimitSeconds ??
        null,
      instructionsIndex: 0,
      setIndex: 0,
    },
  ];
}
export function segmentIndex(segments: Segment[], state: ExamEngineSnapshot) {
  const i = segments.findIndex((s) =>
    state.phase === "instructions"
      ? s.phase === "instructions" &&
        s.instructionsIndex === state.instructionsIndex
      : s.phase === "question" &&
        state.currentIndex >= s.start &&
        state.currentIndex < s.end,
  );
  return Math.max(0, i);
}
export function enterSegment(
  state: ExamEngineSnapshot,
  segment: Segment,
): ExamEngineSnapshot {
  return {
    ...state,
    phase: segment.phase,
    currentIndex: segment.start,
    instructionsIndex: segment.instructionsIndex,
    mockCurrentSetIndex: segment.setIndex,
    showTimeExpiredDialog: false,
    reviewFilter: null,
  };
}
export function initialSnapshot(exam: QuestionEngineExam): ExamEngineSnapshot {
  const blank: ExamEngineSnapshot = {
    phase: "instructions",
    instructionsIndex: 0,
    showReadyDialog: false,
    showTimeExpiredDialog: false,
    nextSegmentTimerStartedAt: null,
    currentIndex: 0,
    visitedQuestionIds: [],
    flaggedIds: [],
    selectedAnswers: {},
    placementSnapshots: {},
    responseSnapshots: {},
    reviewFilter: null,
    reviewFilterIndex: 0,
    reviewFilterIndicesSnapshot: null,
    viewingQuestionIndex: null,
  };
  return enterSegment(blank, segmentsFor(exam)[0]);
}
export function finalAnswers(
  questions: QuestionItem[],
  state: ExamEngineSnapshot,
  timed: boolean,
  mode: "set" | "mock" | "question_stem",
) {
  return questions.map((q) => ({
    questionId: q.id,
    questionSetId: q.questionSetId,
    answerSnapshot:
      state.responseSnapshots?.[q.id] ??
      snapshotQuestionResponse(
        q,
        state.selectedAnswers[q.id],
        state.placementSnapshots?.[q.id],
      ),
    isFlagged: state.flaggedIds.includes(q.id),
    wasTimed: timed,
    mode,
  }));
}
export function remainingSeconds(
  deadline: string | null,
  now: number,
): number | null {
  return deadline
    ? Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000))
    : null;
}
