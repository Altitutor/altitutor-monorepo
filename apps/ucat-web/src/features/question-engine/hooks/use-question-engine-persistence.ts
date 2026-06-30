"use client";

import { useCallback, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import type {
  QuestionEngineExam,
  QuestionEngineMode,
  QuestionEngineState,
  QuestionItem,
} from "@/features/question-engine/model/types";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { SECTION_NAME_TO_NUMBER } from "@/features/sets/lib/section-labels";
import {
  QuotaExceededError,
  assertOkOrQuotaExceeded,
} from "@/lib/ucat/quota/parse-quota-error";

type QuestionAttemptMode =
  | "question"
  | "question_stem"
  | "set"
  | "mock"
  | "learn";

type UpsertQuestionAttemptInput = {
  studentQuestionSetAttemptId: string | null;
  studentPracticeSessionId?: string | null;
  learningModuleBlockId?: string | null;
  questionId: string;
  questionAnswerOptionId: string | null;
  answerSnapshot?: unknown;
  isFlagged?: boolean;
  wasTimed?: boolean;
  mode?: QuestionAttemptMode;
  submittedByStem?: boolean;
};

type CompleteSetAttemptInput = {
  studentQuestionSetAttemptId: string;
};

type CompleteMockAttemptInput = {
  studentMockAttemptId: string;
};

type CompletePracticeSessionInput = {
  sessionId: string;
  scorePoints: number;
  totalPoints: number;
  questionCount: number;
  stemsSnapshot: unknown;
  questionScores: Array<{ questionId: string; score: number }>;
};

type SetAttemptState = {
  mockAttemptId: string | null;
  setAttemptIdsBySetId: Map<string, string>;
};

function findQuestion(
  exam: QuestionEngineExam | undefined,
  questionId: string,
): QuestionItem | undefined {
  if (!exam) return undefined;
  return exam.questions.find((q) => q.id === questionId);
}

function getWasTimedForSet(
  mode: QuestionEngineMode,
  exam: QuestionEngineExam | undefined,
  question: QuestionItem | undefined,
): boolean {
  if (!exam) return false;
  if (mode === "set") {
    const limit = exam.setModeTiming?.setTimeLimitSeconds ?? 0;
    return limit > 0;
  }
  if (mode === "mock" && exam.mockTimingSegments && question) {
    const segments = exam.mockTimingSegments;
    const questionIndex = exam.questions.findIndex((q) => q.id === question.id);
    if (questionIndex < 0) return false;
    const segment = segments.find(
      (s) =>
        s.type === "questions" &&
        questionIndex >= s.questionStartIndex &&
        questionIndex <= s.questionEndIndex,
    );
    if (!segment || segment.type !== "questions") return false;
    return (segment.timeLimitSeconds ?? 0) > 0;
  }
  return false;
}

function toDbMode(mode: QuestionEngineMode): QuestionAttemptMode {
  switch (mode) {
    case "questionStem":
      return "question_stem";
    case "questions":
      return "question";
    case "set":
      return "set";
    case "mock":
      return "mock";
    default:
      return "question";
  }
}

export function useQuestionEnginePersistence({
  mode,
  exam,
  state,
  practiceSessionId,
  learningModuleBlockId,
  onLearnProgress,
  disableQuestionAttemptLogging = false,
  examAttemptManaged = false,
  managedExamAttempt = null,
}: {
  mode: QuestionEngineMode;
  exam: QuestionEngineExam | undefined;
  state: QuestionEngineState;
  practiceSessionId?: string | null;
  learningModuleBlockId?: string | null;
  onLearnProgress?: () => void;
  disableQuestionAttemptLogging?: boolean;
  /** When true, set/mock attempts are created by exam-attempt lifecycle only. */
  examAttemptManaged?: boolean;
  managedExamAttempt?: {
    attemptId: string;
    kind: "set" | "mock" | "practice";
    resourceId: string;
    resultsHref: string;
    setAttemptIdsBySetId: Record<string, string>;
    mockAttemptId: string | null;
  } | null;
}) {
  const isStudentEngine = true;
  const { openQuotaLimit } = useQuotaLimitModal();

  const handleQuotaError = useCallback(
    (error: unknown) => {
      if (error instanceof QuotaExceededError) {
        openQuotaLimit(error.payload);
      }
    },
    [openQuotaLimit],
  );

  const attemptStateRef = useRef<SetAttemptState>({
    mockAttemptId: null,
    setAttemptIdsBySetId: new Map(),
  });

  const upsertQuestionAttempt = useMutation<
    unknown,
    Error,
    UpsertQuestionAttemptInput
  >({
    mutationFn: async (input) => {
      const response = await fetch("/api/ucat/question-attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        await assertOkOrQuotaExceeded(response);
        throw new Error("Failed to upsert question attempt");
      }
      return response.json();
    },
    onSuccess: () => {
      if (learningModuleBlockId) {
        onLearnProgress?.();
      }
    },
    onError: handleQuotaError,
  });

  type SetAttemptResponse = {
    success?: boolean;
    earnedDiscount?: boolean;
    discountCents?: number;
  };
  const completeSetAttempt = useMutation<
    SetAttemptResponse,
    Error,
    CompleteSetAttemptInput
  >({
    mutationFn: async ({ studentQuestionSetAttemptId }) => {
      const response = await fetch(
        `/api/ucat/set-attempts/${studentQuestionSetAttemptId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ complete: true }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to complete set attempt");
      }
      return response.json() as Promise<SetAttemptResponse>;
    },
  });

  const completeMockAttempt = useMutation<
    unknown,
    Error,
    CompleteMockAttemptInput
  >({
    mutationFn: async ({ studentMockAttemptId }) => {
      const response = await fetch(
        `/api/ucat/mock-attempts/${studentMockAttemptId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ complete: true }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to complete mock attempt");
      }
      return response.json();
    },
  });

  type PracticeSessionResponse = {
    success?: boolean;
    earnedDiscount?: boolean;
    discountCents?: number;
  };
  const completePracticeSession = useMutation<
    PracticeSessionResponse,
    Error,
    CompletePracticeSessionInput
  >({
    mutationFn: async (input) => {
      const response = await fetch(
        `/api/ucat/practice-sessions/${input.sessionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            complete: true,
            scorePoints: input.scorePoints,
            totalPoints: input.totalPoints,
            questionCount: input.questionCount,
            stemsSnapshot: input.stemsSnapshot,
            questionScores: input.questionScores,
          }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to complete practice session");
      }
      return response.json() as Promise<PracticeSessionResponse>;
    },
  });

  const withLearnContext = useCallback(
    (input: UpsertQuestionAttemptInput): UpsertQuestionAttemptInput => {
      if (!learningModuleBlockId) return input;
      return {
        ...input,
        studentQuestionSetAttemptId: null,
        studentPracticeSessionId: undefined,
        learningModuleBlockId,
        mode: "learn",
        wasTimed: false,
      };
    },
    [learningModuleBlockId],
  );

  function recordAnswer(
    questionId: string,
    questionAnswerOptionId: string,
    isFlagged: boolean,
  ) {
    if (!isStudentEngine) return;
    if (disableQuestionAttemptLogging) return;
    if (!exam) return;

    const question = findQuestion(exam, questionId);
    const isSyllogism = question?.questionType === "syllogism";

    const inputBase: UpsertQuestionAttemptInput = withLearnContext({
      studentQuestionSetAttemptId: practiceSessionId ? null : null,
      studentPracticeSessionId: practiceSessionId ?? undefined,
      questionId,
      questionAnswerOptionId: isSyllogism
        ? null
        : questionAnswerOptionId
          ? questionAnswerOptionId
          : null,
      answerSnapshot: undefined,
      isFlagged,
    });

    if (isSyllogism) {
      const snapshot = (
        state as QuestionEngineState & {
          syllogismSnapshots?: Record<string, Record<string, boolean>>;
        }
      ).syllogismSnapshots?.[questionId];

      if (snapshot) {
        inputBase.answerSnapshot = {
          type: "syllogism_v1",
          answers: Object.entries(snapshot).map(([optionId, value]) => ({
            question_answer_option_id: optionId,
            answer: value,
          })),
        };
      }
    }

    if (mode === "questionStem" || mode === "questions") {
      upsertQuestionAttempt.mutate({
        ...inputBase,
        wasTimed: false,
        mode: toDbMode(mode),
      });
      return;
    }

    if (!question) return;

    const setAttemptId =
      attemptStateRef.current.setAttemptIdsBySetId.get(question.questionSetId) ??
      null;
    if (!setAttemptId) return;

    const wasTimed = getWasTimedForSet(mode, exam, question);
    upsertQuestionAttempt.mutate({
      ...inputBase,
      studentQuestionSetAttemptId: setAttemptId,
      wasTimed,
      mode: toDbMode(mode),
    });
  }

  async function handleExamCompleted(): Promise<{
    earnedDiscount: boolean;
    discountCents: number;
    /** Navigate here after submit instead of showing in-engine results. */
    redirectHref: string | null;
  }> {
    const empty = {
      earnedDiscount: false,
      discountCents: 0,
      redirectHref: null as string | null,
    };
    if (!isStudentEngine) return empty;
    if (!exam) return empty;

    if (mode === "questionStem" || mode === "questions") {
      return empty;
    }

    const setIds = new Set<string>();
    exam.questions.forEach((q) => setIds.add(q.questionSetId));

    if (examAttemptManaged && managedExamAttempt) {
      if (
        mode === "set" &&
        managedExamAttempt.kind === "set" &&
        managedExamAttempt.resourceId === exam.sourceId
      ) {
        attemptStateRef.current.setAttemptIdsBySetId.set(
          exam.sourceId,
          managedExamAttempt.attemptId,
        );
      }
      for (const [setId, attemptId] of Object.entries(
        managedExamAttempt.setAttemptIdsBySetId,
      )) {
        if (!attemptStateRef.current.setAttemptIdsBySetId.has(setId)) {
          attemptStateRef.current.setAttemptIdsBySetId.set(setId, attemptId);
        }
      }
      if (
        mode === "mock" &&
        managedExamAttempt.mockAttemptId &&
        !attemptStateRef.current.mockAttemptId
      ) {
        attemptStateRef.current.mockAttemptId =
          managedExamAttempt.mockAttemptId;
      }
    }

    if (mode === "set" || mode === "mock") {
      for (const question of exam.questions) {
        const setAttemptId =
          attemptStateRef.current.setAttemptIdsBySetId.get(
            question.questionSetId,
          ) ?? null;
        if (!setAttemptId) continue;

        const selectedOptionId = state.selectedAnswers[question.id];
        const syllogismSnapshot = state.syllogismSnapshots?.[question.id];
        const isSyllogism = question.questionType === "syllogism";
        const hasSyllogismAnswer =
          isSyllogism &&
          syllogismSnapshot &&
          Object.keys(syllogismSnapshot).length > 0;
        if (!selectedOptionId && !hasSyllogismAnswer) continue;

        const isFlagged = state.flaggedIds.includes(question.id);
        const wasTimed = getWasTimedForSet(mode, exam, question);
        const base: UpsertQuestionAttemptInput = {
          studentQuestionSetAttemptId: setAttemptId,
          questionId: question.id,
          questionAnswerOptionId: isSyllogism
            ? null
            : (selectedOptionId ?? null),
          isFlagged,
          wasTimed,
          mode: toDbMode(mode),
        };
        if (isSyllogism && syllogismSnapshot) {
          base.answerSnapshot = {
            type: "syllogism_v1",
            answers: Object.entries(syllogismSnapshot).map(
              ([optionId, value]) => ({
                question_answer_option_id: optionId,
                answer: value,
              }),
            ),
          };
        }
        await upsertQuestionAttempt.mutateAsync(base);
      }
    }

    const setAttemptIds = Array.from(setIds)
      .map((setId) => attemptStateRef.current.setAttemptIdsBySetId.get(setId))
      .filter((id): id is string => id != null);

    const setResults = await Promise.all(
      setAttemptIds.map((id) =>
        completeSetAttempt.mutateAsync({ studentQuestionSetAttemptId: id }),
      ),
    );

    if (mode === "mock" && attemptStateRef.current.mockAttemptId) {
      await completeMockAttempt.mutateAsync({
        studentMockAttemptId: attemptStateRef.current.mockAttemptId,
      });
    }

    const earned = setResults.find((r) => r?.earnedDiscount);

    let redirectHref: string | null = null;
    if (mode === "set") {
      let setAttemptId =
        attemptStateRef.current.setAttemptIdsBySetId.get(exam.sourceId) ?? null;
      if (!setAttemptId && examAttemptManaged) {
        setAttemptId =
          Array.from(
            attemptStateRef.current.setAttemptIdsBySetId.values(),
          )[0] ?? null;
      }
      if (setAttemptId) {
        const sectionName = exam.questions[0]?.sectionName;
        const sectionNumber = sectionName
          ? SECTION_NAME_TO_NUMBER[sectionName]
          : undefined;
        redirectHref =
          sectionNumber != null
            ? `/progress/sections/${sectionNumber}/set-attempts/${setAttemptId}`
            : `/progress/set-attempts/${setAttemptId}`;
      }
    } else if (mode === "mock" && attemptStateRef.current.mockAttemptId) {
      redirectHref = `/progress/mock-attempts/${attemptStateRef.current.mockAttemptId}`;
    } else if (
      practiceSessionId &&
      examAttemptManaged &&
      managedExamAttempt?.kind === "practice"
    ) {
      redirectHref = managedExamAttempt.resultsHref;
    }

    return {
      earnedDiscount: earned?.earnedDiscount ?? false,
      discountCents: earned?.discountCents ?? 0,
      redirectHref,
    };
  }

  async function recordAnswersForUnit(
    startIndex: number,
    endIndex: number,
  ): Promise<void> {
    if (disableQuestionAttemptLogging) return;
    if (!exam || !isStudentEngine) return;
    const questions = exam.questions;
    const inputs: UpsertQuestionAttemptInput[] = [];
    for (let i = startIndex; i <= endIndex; i += 1) {
      const q = questions[i];
      if (!q) continue;
      const isFlagged = state.flaggedIds.includes(q.id);

      const base: UpsertQuestionAttemptInput = withLearnContext({
        studentQuestionSetAttemptId: practiceSessionId ? null : null,
        studentPracticeSessionId: practiceSessionId ?? undefined,
        questionId: q.id,
        questionAnswerOptionId:
          q.questionType === "syllogism"
            ? null
            : (state.selectedAnswers[q.id] ?? null),
        answerSnapshot: undefined,
        isFlagged,
        wasTimed: false,
        mode: toDbMode(mode),
        submittedByStem: true,
      });

      if (q.questionType === "syllogism") {
        const snapshot = (
          state as QuestionEngineState & {
            syllogismSnapshots?: Record<string, Record<string, boolean>>;
          }
        ).syllogismSnapshots?.[q.id];

        if (snapshot) {
          base.answerSnapshot = {
            type: "syllogism_v1",
            answers: Object.entries(snapshot).map(([optionId, value]) => ({
              question_answer_option_id: optionId,
              answer: value,
            })),
          };
        }
      }

      inputs.push(base);
    }

    await Promise.all(
      inputs.map((input) => upsertQuestionAttempt.mutateAsync(input)),
    );
  }

  const attemptIds = useMemo(() => {
    if (!exam)
      return {
        setAttemptId: null as string | null,
        mockAttemptId: null as string | null,
      };
    if (examAttemptManaged && managedExamAttempt) {
      if (mode === "set" && managedExamAttempt.kind === "set") {
        return {
          setAttemptId:
            managedExamAttempt.setAttemptIdsBySetId[exam.sourceId] ??
            managedExamAttempt.attemptId,
          mockAttemptId: null,
        };
      }
      if (mode === "mock" && managedExamAttempt.kind === "mock") {
        return {
          setAttemptId: null,
          mockAttemptId:
            managedExamAttempt.mockAttemptId ?? managedExamAttempt.attemptId,
        };
      }
    }
    if (mode === "set") {
      const id =
        attemptStateRef.current.setAttemptIdsBySetId.get(exam.sourceId) ?? null;
      return { setAttemptId: id, mockAttemptId: null };
    }
    if (mode === "mock") {
      return {
        setAttemptId: null,
        mockAttemptId: attemptStateRef.current.mockAttemptId,
      };
    }
    return { setAttemptId: null, mockAttemptId: null };
  }, [exam, mode, examAttemptManaged, managedExamAttempt]);

  return {
    recordAnswer,
    recordAnswersForUnit,
    handleExamCompleted,
    completePracticeSession,
    attemptIds,
    attemptStateRef,
  };
}
