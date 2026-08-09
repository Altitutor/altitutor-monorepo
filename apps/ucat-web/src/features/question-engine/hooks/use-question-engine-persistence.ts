"use client";

import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  QuestionEngineExam,
  QuestionEngineMode,
  QuestionEngineState,
  QuestionItem,
} from "@/features/question-engine/model/types";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { finalizeExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { SECTION_NAME_TO_NUMBER } from "@/features/sets/lib/section-labels";
import {
  QuotaExceededError,
  assertOkOrQuotaExceeded,
} from "@/lib/ucat/quota/parse-quota-error";
import type { FinalExamQuestionAttemptInput } from "@/lib/ucat/exam-attempt/finalize-attempt";
import {
  buildPersistedQuestionResponse,
  isBinaryPlacementResponse,
} from "@/features/question-engine/lib/response-state";

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
  timeSpentMilliseconds?: number;
};

type FinalizeAttemptResponse = {
  success?: boolean;
  earnedDiscount?: boolean;
  discountCents?: number;
};

type CompletePracticeSessionInput = {
  sessionId: string;
  answers: UpsertQuestionAttemptInput[];
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
        questionIndex < s.questionEndIndex,
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

export function buildFinalExamQuestionAttempts(
  mode: Extract<QuestionEngineMode, "set" | "mock">,
  exam: QuestionEngineExam,
  state: Pick<
    QuestionEngineState,
    "selectedAnswers" | "syllogismSnapshots" | "flaggedIds"
  >,
): FinalExamQuestionAttemptInput[] {
  return exam.questions.map((question) => {
    const selectedOptionId = state.selectedAnswers[question.id];
    const syllogismSnapshot = state.syllogismSnapshots?.[question.id];
    const response = buildPersistedQuestionResponse(
      question,
      selectedOptionId,
      syllogismSnapshot,
    );
    const answer: FinalExamQuestionAttemptInput = {
      questionSetId: question.questionSetId,
      questionId: question.id,
      ...response,
      isFlagged: state.flaggedIds.includes(question.id),
      wasTimed: getWasTimedForSet(mode, exam, question),
      mode: toDbMode(mode),
    };
    return answer;
  });
}

export function shouldPersistAnswerImmediately(params: {
  examAttemptManaged: boolean;
  mode: QuestionEngineMode;
  practiceSessionId?: string | null;
}): boolean {
  // Managed attempts already persist the complete engine snapshot (including
  // selected answers) on a short debounce. Practice stems are additionally
  // committed as a batch when submitted, while sets and mocks send a complete
  // authoritative ledger at finalization. Avoiding a second per-click request
  // stream prevents final submission from waiting behind stale autosaves.
  return !(
    params.examAttemptManaged &&
    (params.mode === "set" ||
      params.mode === "mock" ||
      params.practiceSessionId != null)
  );
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
  const { openQuotaLimit } = useQuotaLimitDialog();
  const queryClient = useQueryClient();
  const activityRefreshRequestedRef = useRef(false);

  const refreshPracticeStreak = useCallback(() => {
    if (activityRefreshRequestedRef.current) return;
    activityRefreshRequestedRef.current = true;
    void queryClient.invalidateQueries({ queryKey: ["ucat", "activity"] });
  }, [queryClient]);

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
    // Preserve the order of rapid syllogism snapshot updates. Final submission
    // is queued behind them, so an older response cannot overwrite newer state.
    scope: { id: "question-attempt-upserts" },
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

  const finalizeAttempt = useMutation<
    FinalizeAttemptResponse,
    Error,
    {
      kind: "set" | "mock";
      attemptId: string;
      answers: FinalExamQuestionAttemptInput[];
    }
  >({
    scope: { id: "question-attempt-upserts" },
    mutationFn: async (input) =>
      (await finalizeExamAttempt(input)) as FinalizeAttemptResponse,
    onSuccess: refreshPracticeStreak,
  });

  const upsertQuestionAttemptBatch = useMutation<
    unknown,
    Error,
    UpsertQuestionAttemptInput[]
  >({
    // Share the autosave scope so completion cannot be overtaken by an older
    // queued snapshot, while still using one HTTP/database batch.
    scope: { id: "question-attempt-upserts" },
    mutationFn: async (attempts) => {
      if (attempts.length === 0) return { success: true, count: 0 };
      const first = attempts[0];
      const response = await fetch("/api/ucat/question-attempts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentQuestionSetAttemptId:
            first.studentQuestionSetAttemptId ?? null,
          studentPracticeSessionId: first.studentPracticeSessionId ?? null,
          learningModuleBlockId: first.learningModuleBlockId ?? null,
          attempts: attempts.map(
            ({
              studentQuestionSetAttemptId: _setAttemptId,
              studentPracticeSessionId: _practiceSessionId,
              learningModuleBlockId: _learningModuleBlockId,
              ...attempt
            }) => attempt,
          ),
        }),
      });
      if (!response.ok) {
        await assertOkOrQuotaExceeded(response);
        throw new Error("Failed to save question attempts");
      }
      return response.json();
    },
    onSuccess: refreshPracticeStreak,
    onError: handleQuotaError,
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
    // Completion includes the final answer batch and must run behind any
    // already queued autosaves for the same engine.
    scope: { id: "question-attempt-upserts" },
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
            answers: input.answers.map(
              ({
                studentQuestionSetAttemptId: _setAttemptId,
                studentPracticeSessionId: _practiceSessionId,
                learningModuleBlockId: _learningModuleBlockId,
                ...answer
              }) => answer,
            ),
          }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to complete practice session");
      }
      return response.json() as Promise<PracticeSessionResponse>;
    },
    onSuccess: refreshPracticeStreak,
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
    if (disableQuestionAttemptLogging) return;
    if (!exam) return;
    if (
      !shouldPersistAnswerImmediately({
        examAttemptManaged,
        mode,
        practiceSessionId,
      })
    ) {
      return;
    }

    const question = findQuestion(exam, questionId);
    if (!question) return;
    const persistedResponse = buildPersistedQuestionResponse(
      question,
      questionAnswerOptionId || undefined,
      state.syllogismSnapshots?.[questionId],
    );

    const inputBase: UpsertQuestionAttemptInput = withLearnContext({
      studentQuestionSetAttemptId: practiceSessionId ? null : null,
      studentPracticeSessionId: practiceSessionId ?? undefined,
      questionId,
      ...persistedResponse,
      isFlagged,
    });

    if (mode === "questionStem" || mode === "questions") {
      upsertQuestionAttempt.mutate({
        ...inputBase,
        wasTimed: false,
        mode: toDbMode(mode),
      });
      return;
    }

    const setAttemptId =
      attemptStateRef.current.setAttemptIdsBySetId.get(
        question.questionSetId,
      ) ?? null;
    if (!setAttemptId) return;

    const wasTimed = getWasTimedForSet(mode, exam, question);
    upsertQuestionAttempt.mutate({
      ...inputBase,
      studentQuestionSetAttemptId: setAttemptId,
      wasTimed,
      mode: toDbMode(mode),
    });
  }

  function recordSyllogismSnapshot(
    questionId: string,
    snapshot: Record<string, boolean>,
    isFlagged: boolean,
  ) {
    if (disableQuestionAttemptLogging || !exam) return;
    if (
      !shouldPersistAnswerImmediately({
        examAttemptManaged,
        mode,
        practiceSessionId,
      })
    ) {
      return;
    }
    const question = findQuestion(exam, questionId);
    if (!question || !isBinaryPlacementResponse(question)) return;

    const input: UpsertQuestionAttemptInput = withLearnContext({
      studentQuestionSetAttemptId: practiceSessionId ? null : null,
      studentPracticeSessionId: practiceSessionId ?? undefined,
      questionId,
      ...buildPersistedQuestionResponse(question, undefined, snapshot),
      isFlagged,
    });

    if (mode === "questionStem" || mode === "questions") {
      upsertQuestionAttempt.mutate({
        ...input,
        wasTimed: false,
        mode: toDbMode(mode),
      });
      return;
    }

    const setAttemptId =
      attemptStateRef.current.setAttemptIdsBySetId.get(
        question.questionSetId,
      ) ?? null;
    if (!setAttemptId) return;
    upsertQuestionAttempt.mutate({
      ...input,
      studentQuestionSetAttemptId: setAttemptId,
      wasTimed: getWasTimedForSet(mode, exam, question),
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
    if (!exam) return empty;

    if (mode === "questionStem" || mode === "questions") {
      return empty;
    }

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

    const finalAnswers = buildFinalExamQuestionAttempts(mode, exam, state);

    let finalizeResult: FinalizeAttemptResponse | null = null;
    if (mode === "set") {
      const setAttemptId =
        attemptStateRef.current.setAttemptIdsBySetId.get(exam.sourceId) ?? null;
      if (setAttemptId) {
        finalizeResult = await finalizeAttempt.mutateAsync({
          kind: "set",
          attemptId: setAttemptId,
          answers: finalAnswers,
        });
      }
    } else if (mode === "mock" && attemptStateRef.current.mockAttemptId) {
      finalizeResult = await finalizeAttempt.mutateAsync({
        kind: "mock",
        attemptId: attemptStateRef.current.mockAttemptId,
        answers: finalAnswers,
      });
    }

    let redirectHref: string | null = null;
    if (mode === "set") {
      const setAttemptId =
        attemptStateRef.current.setAttemptIdsBySetId.get(exam.sourceId) ?? null;
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
      redirectHref = `/progress/mocks/mock-attempts/${attemptStateRef.current.mockAttemptId}`;
    } else if (
      practiceSessionId &&
      examAttemptManaged &&
      managedExamAttempt?.kind === "practice"
    ) {
      redirectHref = managedExamAttempt.resultsHref;
    }

    return {
      earnedDiscount: finalizeResult?.earnedDiscount ?? false,
      discountCents: finalizeResult?.discountCents ?? 0,
      redirectHref,
    };
  }

  async function recordAnswersForUnit(
    startIndex: number,
    endIndex: number,
  ): Promise<void> {
    if (disableQuestionAttemptLogging) return;
    if (!exam) return;
    const questions = exam.questions;
    const inputs: UpsertQuestionAttemptInput[] = [];
    for (let i = startIndex; i <= endIndex; i += 1) {
      const q = questions[i];
      if (!q) continue;
      const isFlagged = state.flaggedIds.includes(q.id);

      const base: UpsertQuestionAttemptInput = withLearnContext({
        studentQuestionSetAttemptId: null,
        studentPracticeSessionId: practiceSessionId ?? undefined,
        questionId: q.id,
        ...buildPersistedQuestionResponse(
          q,
          state.selectedAnswers[q.id],
          state.syllogismSnapshots?.[q.id],
        ),
        isFlagged,
        wasTimed: false,
        mode: toDbMode(mode),
        submittedByStem: true,
      });

      inputs.push(base);
    }

    await upsertQuestionAttemptBatch.mutateAsync(inputs);
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
    recordSyllogismSnapshot,
    recordAnswersForUnit,
    handleExamCompleted,
    completePracticeSession,
    attemptIds,
    attemptStateRef,
  };
}
