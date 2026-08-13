"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { beginExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { getQuestionEngineExam } from "@/features/question-engine/api/question-engine-api";
import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import { toStoredExamTiming } from "@/lib/ucat/exam-attempt/load-exam-for-catch-up";
import type {
  ExamEngineSnapshot,
  ExamAttemptKind,
} from "@/lib/ucat/exam-attempt/types";

const INITIAL_ENGINE_SNAPSHOT: ExamEngineSnapshot = {
  phase: "intro",
  instructionsIndex: 0,
  showReadyDialog: false,
  showTimeExpiredDialog: false,
  nextSegmentTimerStartedAt: null,
  currentIndex: 0,
  visitedQuestionIds: [],
  flaggedIds: [],
  selectedAnswers: {},
  placementSnapshots: {},
  reviewFilter: null,
  reviewFilterIndex: 0,
  reviewFilterIndicesSnapshot: null,
  viewingQuestionIndex: null,
};

function isTimedExam(exam: QuestionEngineExam): boolean {
  if (exam.sourceType === "set") {
    return (exam.setModeTiming?.setTimeLimitSeconds ?? 0) > 0;
  }
  if (exam.sourceType === "mock") {
    return (exam.mockTimingSegments ?? []).some(
      (segment) => (segment.timeLimitSeconds ?? 0) > 0,
    );
  }
  return false;
}

export function useBeginExamRoute({
  kind,
  resourceId,
  title,
  exitHref,
}: {
  kind: Exclude<ExamAttemptKind, "practice">;
  resourceId: string;
  title: string;
  exitHref: string;
}) {
  const router = useRouter();
  const { setLocal } = useActiveExamAttempt();

  return useCallback(async () => {
    const exam = await getQuestionEngineExam(
      kind === "set"
        ? { mode: "set", setId: resourceId }
        : { mode: "mock", mockId: resourceId },
    );
    const firstMockQuestionSetId =
      kind === "mock" ? exam.questions[0]?.questionSetId : undefined;
    const { attempt } = await beginExamAttempt({
      kind,
      resourceId,
      wasTimed: isTimedExam(exam),
      engineSnapshot: INITIAL_ENGINE_SNAPSHOT,
      segmentTimeLimitSeconds: null,
      questionSetIdForMockSet: firstMockQuestionSetId,
      examMeta: {
        sourceType: exam.sourceType,
        sourceId: exam.sourceId,
        practice: false,
        label: title,
        exitHref,
      },
      examTiming: toStoredExamTiming(exam),
    });
    setLocal(attempt);
    router.push("/exam");
  }, [exitHref, kind, resourceId, router, setLocal, title]);
}
