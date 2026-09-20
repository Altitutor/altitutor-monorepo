import { api } from "@/lib/api";
import { getQuestionEngineExam } from "./question-engine-api";
import {
  mapQuestionStemsToItems,
  type QuestionEngineExam,
  type QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
import type {
  ActiveExamAttempt,
  ExamAttemptKind,
  ExamEngineSnapshot,
} from "@/lib/ucat/exam-attempt/types";
import {
  finalAnswers,
  initialSnapshot,
  segmentsFor,
} from "@/features/question-engine/model/native-engine";
export class WebPracticeRequiredError extends Error {
  constructor() {
    super(
      "This saved attempt uses unlimited practice or feedback after each passage. Continue it on UCAT web.",
    );
  }
}
export async function loadExam(
  kind: ExamAttemptKind,
  id: string,
): Promise<QuestionEngineExam> {
  if (kind !== "practice")
    return getQuestionEngineExam({ mode: kind, setId: id, mockId: id });
  const session = await api<{
    stemsSnapshot: QuestionStemWithQuestions[];
    completedAt: string | null;
    unlimited: boolean;
    filtersSnapshot: {
      timePerQuestionSeconds?: number | null;
      reviewTiming?: string;
    };
  }>(`/practice-sessions/${id}`);
  if (session.completedAt)
    throw new Error(
      "This session is complete. Open it from Progress to review it.",
    );
  if (session.unlimited || session.filtersSnapshot?.reviewTiming !== "atEnd")
    throw new WebPracticeRequiredError();
  const questions = mapQuestionStemsToItems(session.stemsSnapshot ?? []);
  if (!questions.length)
    throw new Error("No questions are available for this session.");
  return {
    sourceType: "questionStem",
    sourceId: id,
    title: questions[0].sectionName,
    questions,
    instructionsScreens: [],
    practiceSessionTimeLimitSeconds: session.filtersSnapshot
      ?.timePerQuestionSeconds
      ? session.filtersSnapshot.timePerQuestionSeconds * questions.length
      : null,
  };
}
export async function beginNativeExam(
  kind: ExamAttemptKind,
  exam: QuestionEngineExam,
  resumeOnly = false,
  taskId?: string,
) {
  const state = initialSnapshot(exam);
  const segments = segmentsFor(exam);
  return api<{ attempt: ActiveExamAttempt; resumed: boolean }>(
    "/exam-attempts/begin",
    {
      method: "POST",
      body: {
        kind,
        resourceId: exam.sourceId,
        practiceSessionId: kind === "practice" ? exam.sourceId : undefined,
        wasTimed: segments.some((s) => Boolean(s.seconds)),
        engineSnapshot: state,
        segmentTimeLimitSeconds: segments[0].seconds,
        questionSetIdForMockSet:
          kind === "mock" ? exam.questions[0]?.questionSetId : undefined,
        studyPlanTaskId: taskId,
        resumeOnly,
        examMeta: {
          sourceType: exam.sourceType,
          sourceId: exam.sourceId,
          practice: kind === "practice",
          label: exam.title,
        },
        examTiming: {
          setModeTiming: exam.setModeTiming,
          mockTimingSegments: exam.mockTimingSegments,
          mockSetSummaries: exam.mockSetSummaries,
          practiceSessionTimeLimitSeconds: exam.practiceSessionTimeLimitSeconds,
        },
      },
    },
  );
}
export async function syncNativeExam(
  attempt: ActiveExamAttempt,
  state: ExamEngineSnapshot,
  exam: QuestionEngineExam,
  startSeconds?: number | null,
  paused = false,
) {
  const question =
    !paused && state.phase === "question"
      ? exam.questions[state.currentIndex]
      : null;
  return api<{
    currentSegmentEndsAt: string | null;
    setAttemptIdsBySetId?: Record<string, string>;
  }>("/exam-attempts/sync", {
    method: "PATCH",
    body: {
      kind: attempt.kind,
      attemptId: attempt.attemptId,
      engineSnapshot: state,
      currentSegmentEndsAt: attempt.currentSegmentEndsAt,
      ...(startSeconds !== undefined
        ? { startSegmentTimeLimitSeconds: startSeconds }
        : {}),
      setAttemptIdsBySetId: attempt.setAttemptIdsBySetId,
      questionActiveTiming: question
        ? {
            questionId: question.id,
            questionSetId: question.questionSetId,
            mode: exam.sourceType,
            wasTimed: attempt.wasTimed,
          }
        : null,
    },
  });
}
export async function finishNativeExam(
  attempt: ActiveExamAttempt,
  exam: QuestionEngineExam,
  state: ExamEngineSnapshot,
) {
  return api("/exam-attempts/finalize", {
    method: "POST",
    body: {
      kind: attempt.kind,
      attemptId: attempt.attemptId,
      complete: true,
      answers: finalAnswers(
        exam.questions,
        state,
        attempt.wasTimed,
        attempt.kind === "practice" ? "question_stem" : attempt.kind,
      ),
    },
  });
}
