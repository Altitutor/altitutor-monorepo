"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Flag,
  LogOut,
  Navigation,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Skeleton,
  UcatExamActionButton,
  UcatExamShell,
  useToast,
} from "@altitutor/ui";
import { UCAT_COLORS } from "@altitutor/ui/components/ucat/ucat-theme";
import { useQuestionEngineData } from "@/features/question-engine/hooks/use-question-engine-data";
import { useQuestionEngineState } from "@/features/question-engine/hooks/use-question-engine-state";
import { useUcatLag } from "@/features/question-engine/context/ucat-lag-context";
import { CalculatorPanel } from "@/features/question-engine/components/calculator-panel";
import { useUcatCalculator } from "@/features/question-engine/hooks/use-ucat-calculator";
import {
  ConfirmFinishPracticeDialog,
  ConfirmNextStemDialog,
  ConfirmSubmitDialog,
} from "@/features/question-engine/components/confirm-practice-transition-dialog";
import {
  EndReviewDialog,
  SubmitSetDialog,
} from "@/features/question-engine/components/end-review-dialog";
import { ExitResultsDialog } from "@/features/question-engine/components/exit-results-dialog";
import { EngineIntroDialog } from "@/features/question-engine/components/engine-intro-dialog";
import { InstructionsContent } from "@/features/question-engine/components/instructions-content";
import { NavigatorPanel } from "@/features/question-engine/components/navigator-panel";
import { QuestionContent } from "@/features/question-engine/components/question-content";
import {
  computeMarkingResult,
  MarkingBody,
} from "@/features/question-engine/components/marking-body";
import { MockScoreBody } from "@/features/question-engine/components/mock-score-body";
import { ResultsQuestionViewer } from "@/features/question-engine/components/results-question-viewer";
import { ReviewBody } from "@/features/question-engine/components/review-body";
import { NoFlaggedDialog } from "@/features/question-engine/components/no-flagged-dialog";
import { ReviewInstructionsDialog } from "@/features/question-engine/components/review-instructions-dialog";
import { TimeExpiredDialog } from "@/features/question-engine/components/time-expired-dialog";
import { getIncompleteCount } from "@/features/question-engine/lib/review";
import {
  formatTimeRemaining,
  getCurrentMockSegment,
  getCurrentSegmentTimeLimitSeconds,
  getNextMockSegment,
  getNextSetSegmentFromReview,
  getRemainingSeconds,
} from "@/features/question-engine/lib/timing";
import { getTimedSegmentKey } from "@/features/question-engine/lib/timed-segment-key";
import type {
  QuestionEngineMode,
  QuestionEngineQuestion,
  QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
import {
  mapQuestionStemsToItems,
  mapQuestionsToItems,
} from "@/features/question-engine/model/types";
import { getStemBoundaries } from "@/features/question-engine/lib/practice";
import { QUESTION_ENGINE_SHORTCUT_MAP } from "@/features/question-engine/model/shortcuts";
import { useExamAttemptLifecycle } from "@/features/exam-attempts/hooks/use-exam-attempt-lifecycle";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { finalizeExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { useExamAttemptLaunchGate } from "@/features/exam-attempts/hooks/use-exam-attempt-launch-gate";
import { ExamAttemptConflictDialog } from "@/features/exam-attempts/components/exam-attempt-conflict-dialog";
import { useQuestionEnginePersistence } from "@/features/question-engine/hooks/use-question-engine-persistence";
import { useRefreshedContentCache } from "@/features/question-engine/hooks/use-refreshed-content-cache";
import { useHydratedQuestionStems } from "@/features/practice/hooks/use-hydrated-question-stems";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { PlanPickerDialogShell } from "@/features/subscription/components/plan-picker/plan-picker-dialog-shell";
import type { QuotaExceededPayload } from "@/features/ucat-access/types/quota";
import { SECTION_NAME_TO_NUMBER } from "@/features/sets/lib/section-labels";
import { cn } from "@/lib/utils";

/** App shell: main `pt-16` + vertical `p-6` — cap embedded practice so the engine scrolls inside the viewport. */
export const PRACTICE_EMBEDDED_VIEWPORT_CLASS =
  "mx-auto h-[calc(100dvh-7rem)] max-h-[calc(100dvh-7rem)] w-full min-h-0 overflow-hidden";

export const LEARN_LESSON_EMBEDDED_VIEWPORT_CLASS =
  "mx-auto h-[min(760px,calc(100dvh-8rem))] min-h-[520px] w-full overflow-hidden";

function QuestionEngineLoadingContentSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden bg-white px-1 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-6 w-32 bg-slate-200" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 bg-slate-200" />
          <Skeleton className="h-8 w-24 bg-slate-200" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-h-0 space-y-5 overflow-hidden">
          <div className="space-y-3">
            <Skeleton className="h-5 w-11/12 bg-slate-200" />
            <Skeleton className="h-5 w-4/5 bg-slate-200" />
            <Skeleton className="h-5 w-2/3 bg-slate-200" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex min-h-14 items-start gap-3 border border-slate-200 bg-white p-3"
              >
                <Skeleton className="h-5 w-5 shrink-0 rounded-full bg-slate-200" />
                <div className="w-full space-y-2">
                  <Skeleton className="h-4 w-full bg-slate-200" />
                  <Skeleton className="h-4 w-3/4 bg-slate-200" />
                </div>
              </div>
            ))}
          </div>

          <Skeleton className="h-32 w-full bg-slate-200" />
        </div>

        <div className="hidden min-h-0 border-l border-slate-200 pl-5 lg:block">
          <div className="space-y-3">
            <Skeleton className="h-5 w-24 bg-slate-200" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 15 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="aspect-square w-full rounded-sm bg-slate-200"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionEngineLoadingSkeleton({
  label,
  isPracticeMode,
  embeddedInLesson,
}: {
  label: string;
  isPracticeMode: boolean;
  embeddedInLesson: boolean;
}) {
  return (
    <div
      className={cn(
        isPracticeMode
          ? embeddedInLesson
            ? LEARN_LESSON_EMBEDDED_VIEWPORT_CLASS
            : PRACTICE_EMBEDDED_VIEWPORT_CLASS
          : "mx-auto h-[calc(100dvh-8rem)] min-h-[420px] w-full overflow-hidden",
      )}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <section
        className="relative h-full min-h-0 overflow-hidden bg-white text-black"
        data-ucat-shell-root="true"
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <header
            className="flex items-center justify-between border-b-2 px-3 pb-1.5 pt-3"
            style={{
              borderColor: UCAT_COLORS.primaryBlue,
              backgroundColor: UCAT_COLORS.primaryBlue,
            }}
          >
            <Skeleton className="h-7 w-52 bg-white/35" />
            <Skeleton className="h-5 w-28 bg-white/30" />
          </header>

          <div
            className="flex min-h-[30px] items-center justify-between border-b px-3"
            style={{
              borderColor: UCAT_COLORS.toolbarBorderBlue,
              backgroundColor: UCAT_COLORS.toolbarBlue,
            }}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-24 bg-white/30" />
              <Skeleton className="h-4 w-28 bg-white/30" />
            </div>
            <Skeleton className="h-4 w-32 bg-white/30" />
          </div>

          <div className="min-h-0 flex-1 bg-white px-4 py-0 sm:px-5">
            <QuestionEngineLoadingContentSkeleton />
          </div>

          <footer
            className="flex shrink-0 items-center justify-between px-3 py-2"
            style={{ backgroundColor: UCAT_COLORS.primaryBlue }}
          >
            <Skeleton className="h-8 w-24 bg-white/30" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 bg-white/30" />
              <Skeleton className="h-8 w-28 bg-white/30" />
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}

function QuestionEngineFinalizingOverlay({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-black/25 p-6"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="min-w-64 border-2 border-slate-900 bg-white px-6 py-5 text-center text-black shadow-lg">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
    </div>
  );
}

export type PracticeEngineLiveStats = {
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  totalAnsweredTimeSeconds: number;
  currentQuestionNumber: number;
  totalQuestionLabel: string;
};

type PracticeQuestionTimingResponse = {
  secondsByQuestionId: Record<string, number>;
  submittedQuestionIds: string[];
  totalSeconds: number;
};

async function fetchPracticeQuestionTiming(
  practiceSessionId: string,
): Promise<PracticeQuestionTimingResponse> {
  const response = await fetch(
    `/api/ucat/practice-sessions/${encodeURIComponent(practiceSessionId)}/question-timing`,
  );
  if (!response.ok) {
    throw new Error("Failed to load practice question timing");
  }
  return response.json() as Promise<PracticeQuestionTimingResponse>;
}

export function QuestionEnginePage({
  mode,
  sourceId,
  questionStems,
  standaloneQuestions,
  practice = false,
  practiceSessionId,
  onPracticeStatsChange,
  confirmPracticeTransitions = true,
  timePerQuestionSeconds = null,
  backHref,
  onBack,
  onNeedMoreStems,
  practiceQuotaReached,
  learningModuleBlockId,
  onLearnProgress,
  disableQuestionAttemptLogging = false,
  embeddedInLesson = false,
  onRegisterFinishPracticeDialog,
}: {
  mode: QuestionEngineMode;
  sourceId?: string;
  questionStems?: QuestionStemWithQuestions[];
  standaloneQuestions?: QuestionEngineQuestion[];
  /** When true (questions/questionStem mode only): submit after each question/stem, show answer immediately, no final review phase. */
  practice?: boolean;
  /** When provided (practice mode): links question attempts to this session for persistence. */
  practiceSessionId?: string | null;
  /** Practice session wrapper callback for rendering live stats outside the engine. */
  onPracticeStatsChange?: (stats: PracticeEngineLiveStats | null) => void;
  /** When true (default): show confirmation popup before submit→answer and before next question stem in answer mode. */
  confirmPracticeTransitions?: boolean;
  /** Questions/questionStem mode only. Seconds per question for timing. Omit or null = untimed. */
  timePerQuestionSeconds?: number | null;
  /** When provided, show a "Back" link in the toolbar that navigates here (e.g. /practice). */
  backHref?: string;
  /** When provided, used instead of router.back() for Done/Exit. Enables clearing session state before navigating. */
  onBack?: () => void;
  /** Unlimited mode: fetch next stems when we run out. Parent appends to questionStems and returns new stems. */
  onNeedMoreStems?: (
    excludeStemIds: string[],
  ) => Promise<QuestionStemWithQuestions[] | null>;
  /** Unlimited practice: quota was reached while trying to fetch the next stem. */
  practiceQuotaReached?: QuotaExceededPayload | null;
  /** Learn lesson block context. Only question/questionStem modes are supported. */
  learningModuleBlockId?: string;
  /** Called after a learn block is submitted or expires. */
  onLearnProgress?: () => void;
  /** Learn lesson blocks can use the practice UI without persisting question-attempt rows. */
  disableQuestionAttemptLogging?: boolean;
  /** Shorter viewport when practice engine is embedded inside a lesson block card. */
  embeddedInLesson?: boolean;
  /** Parent can call the registered opener to show the finish-practice confirmation dialog. */
  onRegisterFinishPracticeDialog?: (open: () => void) => void;
}) {
  const invalidLearningMode =
    learningModuleBlockId &&
    mode !== "questions" &&
    mode !== "questionStem";

  const queryClient = useQueryClient();
  const practiceTimingQueryKey = useMemo(
    () => ["ucat", "practice-question-timing", practiceSessionId] as const,
    [practiceSessionId],
  );
  const practiceTimingQuery = useQuery({
    queryKey: practiceTimingQueryKey,
    queryFn: () => fetchPracticeQuestionTiming(practiceSessionId!),
    enabled: practice && practiceSessionId != null && !embeddedInLesson,
    refetchInterval: practice && practiceSessionId != null ? 5000 : false,
  });
  const query = useQuestionEngineData({
    mode,
    setId: mode === "set" ? sourceId : undefined,
    mockId: mode === "mock" ? sourceId : undefined,
  });

  const launchGateKind =
    (mode === "set" || mode === "mock") && sourceId ? mode : null;
  const launchGate = useExamAttemptLaunchGate(launchGateKind, sourceId);

  const { stems: hydratedQuestionStems, isLoading: isHydratingQuestionStems } =
    useHydratedQuestionStems(
      mode === "questionStem" ? questionStems : undefined,
    );

  const questionStemsForExam =
    mode === "questionStem" ? hydratedQuestionStems : questionStems;

  const exam = useMemo(
    () =>
      mode === "questionStem"
        ? questionStemsForExam && {
            sourceType: mode,
            sourceId: sourceId ?? "question-stem",
            title: "Question Stems",
            questions: mapQuestionStemsToItems(questionStemsForExam),
            instructionsScreens: [],
            timePerQuestionSeconds: timePerQuestionSeconds ?? null,
          }
        : mode === "questions"
          ? standaloneQuestions && {
              sourceType: mode,
              sourceId: sourceId ?? "questions",
              title: "Questions",
              questions: mapQuestionsToItems(standaloneQuestions),
              instructionsScreens: [],
              timePerQuestionSeconds: timePerQuestionSeconds ?? null,
            }
          : query.data,
    [
      mode,
      sourceId,
      questionStemsForExam,
      standaloneQuestions,
      query.data,
      timePerQuestionSeconds,
    ],
  );

  const instructionsScreens =
    exam && "instructionsScreens" in exam ? exam.instructionsScreens : [];

  const {
    state,
    setState,
    currentQuestion,
    questions,
    isLastQuestion,
    isLastQuestionOfCurrentUnit,
    isPracticeMode,
    effectiveCurrentIndex,
    reviewFilterIndices,
    reviewListRows,
    goNext,
    goPrevious,
    handlePracticeSubmit,
    setQuestionByIndex,
    toggleFlagCurrent,
    toggleFlagById,
    setAnswer,
    goToReviewScreen,
    startReviewFilter,
    goToReviewQuestionByGlobalIndex,
    setSyllogismSnapshot,
  } = useQuestionEngineState(exam, { practice, onNeedMoreStems });
  const router = useRouter();
  const { toast } = useToast();
  const {
    active: activeExamAttempt,
    refresh: refreshActiveExamAttempt,
    clearLocal: clearActiveExamAttempt,
  } = useActiveExamAttempt();
  const { isLagging, runWithLag } = useUcatLag();
  const { display: calculatorDisplay, onKey: calculatorOnKey } =
    useUcatCalculator();
  const [, setTick] = useState(0);
  const [showConfirmSubmitDialog, setShowConfirmSubmitDialog] = useState(false);
  const [showConfirmNextStemDialog, setShowConfirmNextStemDialog] =
    useState(false);
  const [showConfirmFinishPracticeDialog, setShowConfirmFinishPracticeDialog] =
    useState(false);
  const [showSubmitSetDialog, setShowSubmitSetDialog] = useState(false);
  const [isFinalizingExam, setIsFinalizingExam] = useState(false);
  const [isFinishingPractice, setIsFinishingPractice] = useState(false);
  const [submittedPracticeQuestionIds, setSubmittedPracticeQuestionIds] =
    useState<Set<string>>(() => new Set());
  const timeExpiredFiredRef = useRef<string | null>(null);

  const openFinishPracticeDialog = useCallback(() => {
    setShowConfirmFinishPracticeDialog(true);
  }, []);

  useEffect(() => {
    onRegisterFinishPracticeDialog?.(openFinishPracticeDialog);
  }, [onRegisterFinishPracticeDialog, openFinishPracticeDialog]);

  useEffect(() => {
    setSubmittedPracticeQuestionIds(new Set());
  }, [exam?.sourceId, practiceSessionId]);

  const examAttemptManaged =
    !learningModuleBlockId &&
    (mode === "set" ||
      mode === "mock" ||
      (practice && practiceSessionId != null));

  const managedResourceId =
    practice && practiceSessionId != null ? practiceSessionId : exam?.sourceId;

  const managedExamAttempt = useMemo(() => {
    if (
      !examAttemptManaged ||
      !activeExamAttempt ||
      managedResourceId == null ||
      activeExamAttempt.resourceId !== managedResourceId
    ) {
      return null;
    }

    return {
      attemptId: activeExamAttempt.attemptId,
      kind: activeExamAttempt.kind,
      resourceId: activeExamAttempt.resourceId,
      resultsHref: activeExamAttempt.resultsHref,
      setAttemptIdsBySetId: activeExamAttempt.setAttemptIdsBySetId,
      mockAttemptId: activeExamAttempt.mockAttemptId,
    };
  }, [examAttemptManaged, activeExamAttempt, managedResourceId]);

  const {
    recordAnswer,
    recordAnswersForUnit,
    handleExamCompleted,
    completePracticeSession,
    attemptIds,
    attemptStateRef,
  } = useQuestionEnginePersistence({
    mode,
    exam,
    state,
    practiceSessionId,
    learningModuleBlockId,
    onLearnProgress,
    disableQuestionAttemptLogging,
    examAttemptManaged,
    managedExamAttempt,
  });

  const examAttemptLifecycleEnabled = examAttemptManaged;

  const { serverSegmentEndsAt, isHydrating: isHydratingExamAttempt } =
    useExamAttemptLifecycle({
      enabled: examAttemptLifecycleEnabled,
      exam,
      state,
      setState,
      practice: isPracticeMode,
      practiceSessionId,
      attemptStateRef,
    });

  useEffect(() => {
    const href =
      managedExamAttempt?.resultsHref ??
      (practiceSessionId
        ? `/progress/practice-sessions/${practiceSessionId}`
        : null);
    if (!href) return;
    router.prefetch(href);
  }, [managedExamAttempt?.resultsHref, practiceSessionId, router]);

  const markingOrQuestionIndex =
    state.phase === "question"
      ? state.currentIndex
      : (state.viewingQuestionIndex ?? 0);
  const getCachedContent = useRefreshedContentCache(
    questions,
    markingOrQuestionIndex,
  );

  const isResultsPhaseForActions =
    state.phase === "marking" || state.phase === "mockScore";
  const setMockResultsActions = useMemo(() => {
    if (
      !exam ||
      !isResultsPhaseForActions ||
      state.viewingQuestionIndex != null
    )
      return null;
    if (exam.sourceType === "set") {
      const sectionNumber = questions[0]?.sectionName
        ? SECTION_NAME_TO_NUMBER[questions[0].sectionName]
        : undefined;
      const viewAttemptHref =
        attemptIds.setAttemptId != null
          ? sectionNumber != null
            ? `/progress/sections/${sectionNumber}/set-attempts/${attemptIds.setAttemptId}`
            : `/progress/set-attempts/${attemptIds.setAttemptId}`
          : undefined;
      return { viewAttemptHref };
    }
    if (exam.sourceType === "mock") {
      const viewAttemptHref =
        attemptIds.mockAttemptId != null
          ? `/progress/mock-attempts/${attemptIds.mockAttemptId}`
          : undefined;
      return { viewAttemptHref };
    }
    return null;
  }, [
    exam,
    isResultsPhaseForActions,
    state.viewingQuestionIndex,
    questions,
    attemptIds,
  ]);

  const isSetOrMock =
    exam && (exam.sourceType === "set" || exam.sourceType === "mock");
  const isQuestionsOrStem =
    exam &&
    (exam.sourceType === "questions" || exam.sourceType === "questionStem");
  const currentSegmentTimeLimit =
    exam && (isSetOrMock || isQuestionsOrStem)
      ? getCurrentSegmentTimeLimitSeconds(exam, state)
      : null;
  const isTimed = currentSegmentTimeLimit != null && currentSegmentTimeLimit > 0;
  const activeServerSegmentEndsAt = isTimed ? serverSegmentEndsAt : null;
  const remainingSeconds =
    exam && isTimed
      ? examAttemptManaged && !activeServerSegmentEndsAt
        ? null
        : getRemainingSeconds(
            exam,
            state,
            state.timerStartedAt,
            activeServerSegmentEndsAt,
          )
      : null;
  const segmentKey = exam ? getTimedSegmentKey(exam, state) : "";
  const reviewTimedExpiryRef = useRef(false);
  const awaitingServerSegmentStartRef = useRef(false);
  const displayRemainingSeconds =
    exam && isTimed
      ? (examAttemptManaged &&
        (!activeServerSegmentEndsAt || awaitingServerSegmentStartRef.current)
          ? getRemainingSeconds(exam, state, state.timerStartedAt, null)
          : remainingSeconds)
      : null;

  useEffect(() => {
    awaitingServerSegmentStartRef.current = false;
  }, [activeServerSegmentEndsAt]);

  useEffect(() => {
    if (!isTimed) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isTimed]);

  useEffect(() => {
    if (!exam || remainingSeconds === null) return;
    if (remainingSeconds > 0) {
      timeExpiredFiredRef.current = null;
      return;
    }
    if (timeExpiredFiredRef.current === String(segmentKey)) return;
    timeExpiredFiredRef.current = String(segmentKey);

    if (state.phase === "instructions") {
      awaitingServerSegmentStartRef.current = examAttemptManaged;
      setState((prev) => {
        const next = { ...prev, phase: "question" as const };
        if (exam!.sourceType === "set") {
          next.currentIndex = 0;
          next.timerStartedAt =
            (exam!.setModeTiming?.setTimeLimitSeconds ?? 0) > 0
              ? Date.now()
              : null;
        } else if (exam!.sourceType === "mock") {
          const nextSeg = getNextMockSegment(exam!, prev);
          if (nextSeg?.type === "questions") {
            next.currentIndex = nextSeg.questionStartIndex;
            next.timerStartedAt =
              (nextSeg.timeLimitSeconds ?? 0) > 0 ? Date.now() : null;
          } else {
            next.currentIndex = prev.currentIndex;
          }
        } else if (
          (exam!.sourceType === "questions" ||
            exam!.sourceType === "questionStem") &&
          exam!.timePerQuestionSeconds != null &&
          exam!.timePerQuestionSeconds > 0
        ) {
          next.timerStartedAt = Date.now();
        }
        return next;
      });
      return;
    }

    if (examAttemptManaged && awaitingServerSegmentStartRef.current) {
      return;
    }

    if (state.phase === "question" && exam.sourceType === "set") {
      setState((prev) => ({
        ...prev,
        showTimeExpiredDialog: true,
        showNavigator: false,
      }));
      void handleExamCompleted().catch(() => {
        // The OK action retries completion before redirecting.
      });
      return;
    }

    const now = Date.now();
    setState((prev) => {
      const next = { ...prev, showTimeExpiredDialog: true };
      if (exam!.sourceType === "mock") {
        next.nextSegmentTimerStartedAt = now;
      }
      return next;
    });
  }, [
    exam,
    remainingSeconds,
    segmentKey,
    state.phase,
    examAttemptManaged,
    setState,
    handleExamCompleted,
  ]);

  // Warn before leaving the UCAT exam page (tab close, reload, or navigation)
  const skipBeforeUnloadRef = useRef(false);
  useEffect(() => {
    if (embeddedInLesson) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (skipBeforeUnloadRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor || !anchor.href) return;

      // Skip warning for intentional navigation (e.g. View attempt)
      if (anchor.hasAttribute("data-skip-leave-warning")) {
        skipBeforeUnloadRef.current = true;
        return;
      }

      // Ignore clicks that don't change location
      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.href === window.location.href) return;

      const confirmLeave = window.confirm(
        "Are you sure you want to leave this UCAT exam? Your current progress may be lost.",
      );
      if (!confirmLeave) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("click", handleClick, true);
    };
  }, [embeddedInLesson]);

  const redirectToManagedResults = useCallback(
    async (href: string) => {
      if (managedExamAttempt) {
        try {
          await finalizeExamAttempt({
            kind: managedExamAttempt.kind,
            attemptId: managedExamAttempt.attemptId,
          });
        } catch {
          // Server may have already finalized during active fetch.
        }
      }
      clearActiveExamAttempt();
      skipBeforeUnloadRef.current = true;
      router.push(href);
    },
    [managedExamAttempt, clearActiveExamAttempt, router],
  );

  const completeExamAndMaybeRedirect = useCallback(async () => {
    setIsFinalizingExam(true);
    try {
      const { earnedDiscount, discountCents, redirectHref } =
        await handleExamCompleted();
      if (examAttemptManaged) {
        clearActiveExamAttempt();
        await refreshActiveExamAttempt();
      }
      if (earnedDiscount && discountCents > 0) {
        toast({
          title: "Practice day discount earned!",
          description: `You earned $${(discountCents / 100).toFixed(0)} off your next bill.`,
        });
      }
      if (redirectHref) {
        skipBeforeUnloadRef.current = true;
        clearActiveExamAttempt();
        router.push(redirectHref);
        return true;
      }
      return false;
    } catch (error) {
      setIsFinalizingExam(false);
      throw error;
    }
  }, [
    handleExamCompleted,
    examAttemptManaged,
    clearActiveExamAttempt,
    refreshActiveExamAttempt,
    toast,
    router,
  ]);

  const handleEndReview = useCallback(async () => {
    if (isFinalizingExam) return;
    if (!exam) return;
    if (
      exam.sourceType === "mock" &&
      state.mockCurrentSetIndex != null &&
      exam.mockSetSummaries
    ) {
      const isLastSet =
        state.mockCurrentSetIndex >= exam.mockSetSummaries.length - 1;
      const nextSeg = getNextSetSegmentFromReview(
        exam,
        state.mockCurrentSetIndex,
      );
      if (!isLastSet && nextSeg) {
        setState((current) => {
          const next = {
            ...current,
            showEndReviewDialog: false,
            reviewFilter: null,
            reviewFilterIndex: 0,
            reviewFilterIndicesSnapshot: null,
            mockCurrentSetIndex: current.mockCurrentSetIndex! + 1,
          };
          if (nextSeg.type === "instructions") {
            next.phase = "instructions";
            next.instructionsIndex = nextSeg.instructionsIndex;
            const timeLimit = nextSeg.timeLimitSeconds ?? 0;
            next.timerStartedAt = timeLimit > 0 ? Date.now() : null;
          } else {
            next.phase = "question";
            next.currentIndex = nextSeg.questionStartIndex;
            next.timerStartedAt =
              (nextSeg.timeLimitSeconds ?? 0) > 0 ? Date.now() : null;
          }
          return next;
        });
        return;
      }
    }
    const redirected = await completeExamAndMaybeRedirect();
    if (redirected) return;

    if (examAttemptManaged && managedExamAttempt?.resultsHref) {
      await redirectToManagedResults(managedExamAttempt.resultsHref);
      return;
    }

    if (exam.sourceType === "set" || exam.sourceType === "mock") {
      const setAttemptId =
        attemptStateRef.current.setAttemptIdsBySetId.get(exam.sourceId) ??
        Array.from(attemptStateRef.current.setAttemptIdsBySetId.values())[0] ??
        null;
      let href: string | null = null;
      if (exam.sourceType === "set" && setAttemptId) {
        const sectionName = exam.questions[0]?.sectionName;
        const sectionNumber = sectionName
          ? SECTION_NAME_TO_NUMBER[sectionName]
          : undefined;
        href =
          sectionNumber != null
            ? `/progress/sections/${sectionNumber}/set-attempts/${setAttemptId}`
            : `/progress/set-attempts/${setAttemptId}`;
      } else if (
        exam.sourceType === "mock" &&
        attemptStateRef.current.mockAttemptId
      ) {
        href = `/progress/mock-attempts/${attemptStateRef.current.mockAttemptId}`;
      }
      if (href) {
        skipBeforeUnloadRef.current = true;
        router.push(href);
        return;
      }
    }

    setState((current) => ({
      ...current,
      phase: exam.sourceType === "mock" ? "mockScore" : "marking",
      showEndReviewDialog: false,
      reviewFilter: null,
      reviewFilterIndex: 0,
      reviewFilterIndicesSnapshot: null,
      viewingQuestionIndex: null,
    }));
    setShowSubmitSetDialog(false);
    setIsFinalizingExam(false);
  }, [
    isFinalizingExam,
    exam,
    state.mockCurrentSetIndex,
    completeExamAndMaybeRedirect,
    examAttemptManaged,
    managedExamAttempt,
    redirectToManagedResults,
    router,
    setState,
    attemptStateRef,
  ]);

  useEffect(() => {
    if (!exam || remainingSeconds !== 0) {
      reviewTimedExpiryRef.current = false;
      return;
    }
    if (state.phase !== "review" || state.reviewFilter) return;
    if (!isTimed) return;
    if (exam.sourceType !== "set" && exam.sourceType !== "mock") return;
    if (reviewTimedExpiryRef.current) return;
    reviewTimedExpiryRef.current = true;
    void handleEndReview();
  }, [
    exam,
    remainingSeconds,
    state.phase,
    state.reviewFilter,
    isTimed,
    handleEndReview,
  ]);

  const hasPreviousQuestion =
    state.phase === "question" &&
    (exam?.sourceType === "mock"
      ? (() => {
          const seg = getCurrentMockSegment(exam, state);
          if (seg?.type === "questions") {
            return state.currentIndex > seg.questionStartIndex;
          }
          return state.currentIndex > 0;
        })()
      : isPracticeMode
        ? (() => {
            const { startIndex } = getStemBoundaries(
              questions,
              state.currentIndex,
              mode as "questions" | "questionStem",
            );
            return state.currentIndex > startIndex;
          })()
        : state.currentIndex > 0);
  const hasPreviousReviewQuestion =
    state.phase === "review" &&
    Boolean(state.reviewFilter) &&
    state.reviewFilterIndex > 0;
  const hasPreviousPracticeAnswerQuestion =
    state.phase === "practiceAnswer" &&
    (state.viewingQuestionIndex ?? 0) >
      (state.practiceAnswerUnitStartIndex ?? 0);

  const practiceMarkingResult = useMemo(
    () =>
      isPracticeMode && (exam?.questions?.length ?? 0) > 0
        ? computeMarkingResult(
            exam!.questions,
            state.selectedAnswers,
            state.syllogismSnapshots,
          )
        : null,
    [isPracticeMode, exam, state.selectedAnswers, state.syllogismSnapshots],
  );
  const practiceCorrectCount =
    practiceMarkingResult?.rows.filter((r) => r.points > 0).length ?? 0;

  const handleFinishPractice = useCallback(async () => {
    if (isFinishingPractice) return;
    if (!isPracticeMode || !exam) return;
    setIsFinishingPractice(true);
    const qs = exam.questions;
    try {
      if (state.phase === "question") {
        const { startIndex, endIndex } = getStemBoundaries(
          qs,
          state.currentIndex,
          mode as "questions" | "questionStem",
        );
        await recordAnswersForUnit(startIndex, endIndex);
        if (learningModuleBlockId && disableQuestionAttemptLogging) {
          onLearnProgress?.();
        }
        setSubmittedPracticeQuestionIds((current) => {
          const next = new Set(current);
          for (let index = startIndex; index <= endIndex; index++) {
            const questionId = qs[index]?.id;
            if (questionId) next.add(questionId);
          }
          return next;
        });
      }

      if (practiceSessionId && practiceMarkingResult) {
        const questionScores = practiceMarkingResult.rows.map((r) => ({
          questionId: r.question.id,
          score: r.points,
        }));
        try {
          const res = await completePracticeSession.mutateAsync({
            sessionId: practiceSessionId,
            scorePoints: practiceMarkingResult.totalRawScore,
            totalPoints: practiceMarkingResult.maxRawScore,
            questionCount: qs.length,
            stemsSnapshot: questionStemsForExam ?? questionStems ?? [],
            questionScores,
          });
          if (res?.earnedDiscount && (res?.discountCents ?? 0) > 0) {
            toast({
              title: "Practice day discount earned!",
              description: `You earned $${((res.discountCents ?? 0) / 100).toFixed(0)} off your next bill.`,
            });
          }
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: ["ucat-quota-usage"] }),
            queryClient.invalidateQueries({ queryKey: practiceTimingQueryKey }),
          ]);
        } catch {
          // Session complete may fail; still navigate to session when we have an id.
        }
        await refreshActiveExamAttempt();
      }

      if (practiceSessionId) {
        clearActiveExamAttempt();
        skipBeforeUnloadRef.current = true;
        router.push(`/progress/practice-sessions/${practiceSessionId}`);
        return;
      }

      setState((current) => ({
        ...current,
        phase: "practiceComplete",
        viewingQuestionIndex: null,
        practiceAnswerUnitStartIndex: undefined,
        practiceAnswerUnitEndIndex: undefined,
      }));
      setIsFinishingPractice(false);
    } catch (error) {
      setIsFinishingPractice(false);
      throw error;
    }
  }, [
    isFinishingPractice,
    isPracticeMode,
    exam,
    state.phase,
    state.currentIndex,
    mode,
    recordAnswersForUnit,
    learningModuleBlockId,
    disableQuestionAttemptLogging,
    onLearnProgress,
    practiceSessionId,
    practiceMarkingResult,
    completePracticeSession,
    questionStems,
    questionStemsForExam,
    setState,
    toast,
    queryClient,
    practiceTimingQueryKey,
    router,
    refreshActiveExamAttempt,
    clearActiveExamAttempt,
  ]);

  const submitCurrentPracticeUnit = useCallback(async () => {
    if (!exam) return;
    const { startIndex, endIndex } = getStemBoundaries(
      questions,
      state.currentIndex,
      mode as "questions" | "questionStem",
    );
    await recordAnswersForUnit(startIndex, endIndex);
    if (learningModuleBlockId && disableQuestionAttemptLogging) {
      onLearnProgress?.();
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ucat-quota-usage"] }),
      queryClient.invalidateQueries({ queryKey: practiceTimingQueryKey }),
    ]);
    setSubmittedPracticeQuestionIds((current) => {
      const next = new Set(current);
      for (let index = startIndex; index <= endIndex; index++) {
        const questionId = questions[index]?.id;
        if (questionId) next.add(questionId);
      }
      return next;
    });
    handlePracticeSubmit();
  }, [
    exam,
    questions,
    state.currentIndex,
    mode,
    recordAnswersForUnit,
    learningModuleBlockId,
    disableQuestionAttemptLogging,
    onLearnProgress,
    queryClient,
    practiceTimingQueryKey,
    handlePracticeSubmit,
  ]);

  // Disable copy, cut, paste, and enable UCAT keyboard shortcuts while the UCAT engine is open
  useEffect(() => {
    const preventDefault = (event: Event) => {
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const inputType = target instanceof HTMLInputElement ? target.type : null;
      const isTextInput =
        tagName === "INPUT" &&
        inputType !== "button" &&
        inputType !== "checkbox" &&
        inputType !== "radio" &&
        inputType !== "reset" &&
        inputType !== "submit";
      const isEditable =
        target?.isContentEditable ||
        isTextInput ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT";

      const key = event.key.toLowerCase();

      // Block common clipboard shortcuts
      if (
        (event.ctrlKey || event.metaKey) &&
        ["c", "x", "v", "a"].includes(key)
      ) {
        event.preventDefault();
        return;
      }

      if (isEditable) {
        return;
      }

      // Answer selection: a/b/c/d/e/f select option A/B/C/D/E/F when viewing a question (no modifiers)
      const overlayActive =
        state.phase === "intro" ||
        state.showReadyDialog ||
        state.showTimeExpiredDialog ||
        state.showEndReviewDialog ||
        state.showExitResultsDialog ||
        state.showNoFlaggedDialog ||
        state.showReviewInstructionsDialog ||
        showConfirmSubmitDialog ||
        showConfirmNextStemDialog ||
        showConfirmFinishPracticeDialog ||
        showSubmitSetDialog;
      const isQuestionView =
        (state.phase === "question" ||
          (state.phase === "review" && state.reviewFilter)) &&
        currentQuestion &&
        !overlayActive;
      if (isQuestionView && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const answerKeys = ["a", "b", "c", "d", "e", "f"];
        const keyIndex = answerKeys.indexOf(key);
        if (keyIndex >= 0 && currentQuestion.options[keyIndex]) {
          const optionId = currentQuestion.options[keyIndex].id;
          const flaggedCurrent = state.flaggedIds.includes(currentQuestion.id);
          event.preventDefault();
          void runWithLag(() => {
            setAnswer(optionId);
            recordAnswer(currentQuestion.id, optionId, flaggedCurrent);
          });
          return;
        }
      }

      // Handle UCAT engine shortcuts (Alt/Option + key).
      // On macOS, Option+letter yields a composed character in event.key (e.g. Option+C → "ç").
      // Use event.code (physical key, e.g. "KeyC") so shortcuts work regardless of keyboard layout.
      const parts: string[] = [];
      if (event.altKey) {
        parts.push("alt");
      }
      const letterForShortcut =
        event.altKey && event.code.startsWith("Key") && event.code.length === 4
          ? event.code.slice(3).toLowerCase()
          : key;
      parts.push(letterForShortcut);
      const shortcutKey = parts.join("+");

      // When confirm practice transition dialogs are open, Alt+Y / Alt+N = Yes / No
      if (
        showConfirmSubmitDialog ||
        showConfirmNextStemDialog ||
        showConfirmFinishPracticeDialog ||
        showSubmitSetDialog
      ) {
        if (shortcutKey === "alt+y") {
          event.preventDefault();
          if (showConfirmSubmitDialog) {
            void (async () => {
              await submitCurrentPracticeUnit();
              setShowConfirmSubmitDialog(false);
            })();
          } else if (showConfirmFinishPracticeDialog) {
            setShowConfirmFinishPracticeDialog(false);
            void handleFinishPractice();
          } else if (showSubmitSetDialog) {
            setShowSubmitSetDialog(false);
            void handleEndReview();
          } else {
            goNext();
            setShowConfirmNextStemDialog(false);
          }
          return;
        }
        if (shortcutKey === "alt+n") {
          event.preventDefault();
          setShowConfirmSubmitDialog(false);
          setShowConfirmNextStemDialog(false);
          setShowConfirmFinishPracticeDialog(false);
          setShowSubmitSetDialog(false);
          return;
        }
      }

      // When Ready to Begin dialog is open (on instructions or intro), Alt+Y / Alt+N = Yes / No
      const readyOverlay = state.phase === "intro" || state.showReadyDialog;
      if (
        readyOverlay &&
        (shortcutKey === "alt+y" || shortcutKey === "alt+n")
      ) {
        event.preventDefault();
        if (shortcutKey === "alt+y") {
          if (state.phase === "intro" || state.showReadyDialog) {
            setState((current) => ({
              ...current,
              phase: "question",
              showReadyDialog: false,
            }));
          }
        } else {
          if (state.showReadyDialog) {
            setState((current) => ({ ...current, showReadyDialog: false }));
          } else if (state.phase === "intro") {
            if (instructionsScreens.length > 0) {
              setState((current) => ({
                ...current,
                phase: "instructions",
                instructionsIndex: instructionsScreens.length - 1,
              }));
            } else {
              if (onBack) onBack();
              else router.back();
            }
          }
        }
        return;
      }

      // When in instructions phase (and no Ready dialog), only Next applies (no Previous)
      if (state.phase === "instructions") {
        if (shortcutKey === "alt+n") {
          event.preventDefault();
          goNext();
        }
        return;
      }

      // When the navigator is open, Alt+C closes it instead of toggling the calculator
      if (state.showNavigator && shortcutKey === "alt+c") {
        event.preventDefault();
        setState((current) => ({ ...current, showNavigator: false }));
        return;
      }

      // In practice mode (question phase), Alt+S = Submit
      if (
        isPracticeMode &&
        state.phase === "question" &&
        isLastQuestionOfCurrentUnit &&
        shortcutKey === "alt+s"
      ) {
        event.preventDefault();
        if (confirmPracticeTransitions) {
          setShowConfirmSubmitDialog(true);
        } else {
          submitCurrentPracticeUnit();
        }
        return;
      }

      // In review mode, Alt+S returns to review screen
      if (
        state.phase === "review" &&
        state.reviewFilter &&
        shortcutKey === "alt+s"
      ) {
        event.preventDefault();
        goToReviewScreen();
        return;
      }

      // On review screen, Alt+A / Alt+I / Alt+V = Review All / Incomplete / Flagged
      if (state.phase === "review" && !state.reviewFilter) {
        if (shortcutKey === "alt+a") {
          event.preventDefault();
          void runWithLag(() => startReviewFilter("all"));
          return;
        }
        if (shortcutKey === "alt+i") {
          event.preventDefault();
          void runWithLag(() => startReviewFilter("incomplete"));
          return;
        }
        if (shortcutKey === "alt+v") {
          event.preventDefault();
          void runWithLag(() => startReviewFilter("flagged"));
          return;
        }
      }

      const action = QUESTION_ENGINE_SHORTCUT_MAP[shortcutKey];

      if (!action) {
        return;
      }

      event.preventDefault();

      switch (action) {
        case "toggleCalculator": {
          // Only allow when calculator button is visible (not on review screen)
          const isReviewScreen =
            state.phase === "review" && !state.reviewFilter;
          if (!isReviewScreen) {
            void runWithLag(() =>
              setState((current) => ({
                ...current,
                showCalculator: !current.showCalculator,
              })),
            );
          }
          break;
        }
        case "toggleFlagForReview":
          void runWithLag(() => {
            toggleFlagCurrent();
          });
          break;
        case "previousQuestion":
          if (
            hasPreviousQuestion ||
            hasPreviousReviewQuestion ||
            hasPreviousPracticeAnswerQuestion
          ) {
            void runWithLag(() => {
              goPrevious();
            });
          }
          break;
        case "openNavigator": {
          // Only allow when navigator button is visible (question or intro phase)
          const showNavigatorButton =
            state.phase === "question" || state.phase === "intro";
          if (showNavigatorButton) {
            void runWithLag(() =>
              setState((current) => ({
                ...current,
                showNavigator: !current.showNavigator,
              })),
            );
          }
          break;
        }
        case "nextQuestion":
          void runWithLag(() => {
            if (
              isPracticeMode &&
              state.phase === "question" &&
              isLastQuestionOfCurrentUnit
            ) {
              if (confirmPracticeTransitions) {
                setShowConfirmSubmitDialog(true);
              } else {
                submitCurrentPracticeUnit();
              }
            } else if (isPracticeMode && state.phase === "practiceAnswer") {
              const unitEnd = state.practiceAnswerUnitEndIndex ?? 0;
              const viewing = state.viewingQuestionIndex ?? 0;
              if (viewing >= unitEnd && confirmPracticeTransitions) {
                setShowConfirmNextStemDialog(true);
              } else {
                goNext();
              }
            } else {
              goNext();
            }
          });
          break;
        case "reviewScreen":
          if (state.phase === "review" && state.reviewFilter) {
            void runWithLag(() => goToReviewScreen());
          }
          break;
      }
    };

    document.addEventListener("copy", preventDefault);
    document.addEventListener("cut", preventDefault);
    document.addEventListener("paste", preventDefault);
    document.addEventListener("contextmenu", preventDefault);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("copy", preventDefault);
      document.removeEventListener("cut", preventDefault);
      document.removeEventListener("paste", preventDefault);
      document.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    state.phase,
    state.instructionsIndex,
    state.showReadyDialog,
    state.showNavigator,
    state.reviewFilter,
    state.showTimeExpiredDialog,
    state.showEndReviewDialog,
    state.showExitResultsDialog,
    state.showNoFlaggedDialog,
    state.showReviewInstructionsDialog,
    state.flaggedIds,
    state.currentIndex,
    state.viewingQuestionIndex,
    state.practiceAnswerUnitEndIndex,
    state.practiceAnswerUnitStartIndex,
    currentQuestion,
    setState,
    setAnswer,
    recordAnswer,
    recordAnswersForUnit,
    goNext,
    goPrevious,
    toggleFlagCurrent,
    goToReviewScreen,
    startReviewFilter,
    handlePracticeSubmit,
    submitCurrentPracticeUnit,
    isPracticeMode,
    isLastQuestionOfCurrentUnit,
    confirmPracticeTransitions,
    showConfirmSubmitDialog,
    showConfirmNextStemDialog,
    showConfirmFinishPracticeDialog,
    showSubmitSetDialog,
    handleFinishPractice,
    handleEndReview,
    hasPreviousQuestion,
    hasPreviousReviewQuestion,
    hasPreviousPracticeAnswerQuestion,
    questions,
    mode,
    runWithLag,
    router,
    instructionsScreens.length,
    onBack,
  ]);

  useEffect(() => {
    if (!onPracticeStatsChange) return;
    if (!isPracticeMode || embeddedInLesson || !exam) {
      onPracticeStatsChange(null);
      return;
    }

    const submittedIds = new Set([
      ...submittedPracticeQuestionIds,
      ...(practiceTimingQuery.data?.submittedQuestionIds ?? []),
    ]);
    const submittedRows = questions.filter((question) =>
      submittedIds.has(question.id),
    );
    const markingResult = computeMarkingResult(
      questions,
      state.selectedAnswers,
      state.syllogismSnapshots,
    );
    const correctCount = markingResult.rows.filter(
      (row) => submittedIds.has(row.question.id) && row.points > 0,
    ).length;
    const answeredCount = submittedRows.length;
    const progressIndex =
      state.phase === "practiceAnswer" && state.viewingQuestionIndex != null
        ? state.viewingQuestionIndex
        : effectiveCurrentIndex;
    const currentQuestionNumber = Math.min(
      Math.max(progressIndex + 1, 1),
      Math.max(questions.length, 1),
    );
    const totalAnsweredTimeSeconds = Array.from(submittedIds).reduce(
      (total, questionId) =>
        total +
        (practiceTimingQuery.data?.secondsByQuestionId[questionId] ?? 0),
      0,
    );

    onPracticeStatsChange({
      answeredCount,
      correctCount,
      incorrectCount: Math.max(0, answeredCount - correctCount),
      totalAnsweredTimeSeconds,
      currentQuestionNumber,
      totalQuestionLabel: onNeedMoreStems
        ? "Unlimited"
        : String(questions.length),
    });
  }, [
    onPracticeStatsChange,
    isPracticeMode,
    embeddedInLesson,
    exam,
    questions,
    state.visitedQuestionIds,
    state.selectedAnswers,
    state.syllogismSnapshots,
    state.phase,
    state.viewingQuestionIndex,
    effectiveCurrentIndex,
    onNeedMoreStems,
    practiceTimingQuery.data,
    submittedPracticeQuestionIds,
  ]);

  if (invalidLearningMode) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Learning module questions must use question or question stem mode.
      </div>
    );
  }

  if (launchGateKind && launchGate.isCheckingLaunch) {
    return (
      <QuestionEngineLoadingSkeleton
        label="Checking for in-progress attempts"
        isPracticeMode={isPracticeMode}
        embeddedInLesson={embeddedInLesson}
      />
    );
  }

  if (launchGateKind && !launchGate.launchAllowed) {
    return (
      <ExamAttemptConflictDialog
        open={Boolean(launchGate.conflictActive)}
        active={launchGate.conflictActive}
        pendingLabel={mode === "mock" ? "this mock exam" : "this question set"}
        isFinalizing={launchGate.isFinalizingConflict}
        onFinalizeAndContinue={() =>
          void launchGate.finalizeConflictAndContinue()
        }
        onCancel={() => router.back()}
      />
    );
  }

  if ((mode === "set" || mode === "mock") && query.isLoading) {
    return (
      <QuestionEngineLoadingSkeleton
        label="Loading exam"
        isPracticeMode={isPracticeMode}
        embeddedInLesson={embeddedInLesson}
      />
    );
  }

  if (isHydratingExamAttempt) {
    return (
      <QuestionEngineLoadingSkeleton
        label="Resuming attempt"
        isPracticeMode={isPracticeMode}
        embeddedInLesson={embeddedInLesson}
      />
    );
  }

  if (mode === "questionStem" && isHydratingQuestionStems) {
    return (
      <QuestionEngineLoadingSkeleton
        label="Loading questions"
        isPracticeMode={isPracticeMode}
        embeddedInLesson={embeddedInLesson}
      />
    );
  }

  if (
    ((mode === "set" || mode === "mock") && query.error) ||
    !exam ||
    exam.questions.length === 0
  ) {
    return (
      <div className="rounded-ucatShell bg-card p-4 text-sm text-card-foreground text-red-600 shadow-sm dark:text-red-400">
        Unable to load questions for this {mode}. Ensure student has access via
        UCAT views and the selected source contains questions.
      </div>
    );
  }

  const flaggedCurrent = currentQuestion
    ? state.flaggedIds.includes(currentQuestion.id)
    : false;
  const currentInstructionsScreen =
    state.phase === "instructions" &&
    instructionsScreens[state.instructionsIndex];
  const isInstructionsPhase = state.phase === "instructions";
  const isReviewPhase = state.phase === "review";
  const isMarkingPhase = state.phase === "marking";
  const isMockScorePhase = state.phase === "mockScore";
  const isResultsPhase = isMarkingPhase || isMockScorePhase;
  const isPracticeAnswerPhase = state.phase === "practiceAnswer";
  const isPracticeCompletePhase = state.phase === "practiceComplete";
  const isLastSetPracticeAnswerScreen =
    isPracticeAnswerPhase &&
    !onNeedMoreStems &&
    (state.viewingQuestionIndex ?? 0) === questions.length - 1;
  const isLoadingMorePhase = state.phase === "loadingMore";
  const isReviewScreen = isReviewPhase && !state.reviewFilter;
  const isReviewMode = isReviewPhase && state.reviewFilter;
  const questionLabel = (() => {
    if (
      (isResultsPhase || isPracticeAnswerPhase) &&
      state.viewingQuestionIndex != null
    ) {
      const viewing = state.viewingQuestionIndex;
      if (isPracticeAnswerPhase) {
        return `${viewing + 1} of ${questions.length}`;
      }
      const q = questions[viewing];
      const displayIndex = q ? q.index + 1 : viewing + 1;
      return `${displayIndex} of ${questions.length}`;
    }
    if (isReviewMode && reviewFilterIndices.length > 0) {
      if (
        exam?.sourceType === "mock" &&
        state.mockCurrentSetIndex != null &&
        exam.mockSetSummaries
      ) {
        const summary = exam.mockSetSummaries[state.mockCurrentSetIndex];
        if (summary) {
          const posInSet =
            effectiveCurrentIndex - summary.questionStartIndex + 1;
          const setSize = summary.questionEndIndex - summary.questionStartIndex;
          return `${posInSet} of ${setSize}`;
        }
      }
      return `${effectiveCurrentIndex + 1} of ${questions.length}`;
    }
    if (
      exam?.sourceType === "questionStem" &&
      state.phase === "question" &&
      onNeedMoreStems
    ) {
      const { startIndex, endIndex } = getStemBoundaries(
        questions,
        state.currentIndex,
        "questionStem",
      );
      const posInStem = state.currentIndex - startIndex + 1;
      const stemSize = endIndex - startIndex + 1;
      return `${posInStem} of ${stemSize}`;
    }
    if (exam?.sourceType === "mock" && state.phase === "question") {
      const seg = getCurrentMockSegment(exam, state);
      if (seg?.type === "questions") {
        const posInSet = state.currentIndex - seg.questionStartIndex + 1;
        const setSize = seg.questionEndIndex - seg.questionStartIndex;
        return `${posInSet} of ${setSize}`;
      }
    }
    return `${Math.min(effectiveCurrentIndex + 1, questions.length)} of ${questions.length}`;
  })();
  const hasPreviousInstructions = false;
  const showReadyToBeginDialog =
    state.phase === "intro" || state.showReadyDialog;
  const showFinishPracticeControls = isPracticeMode && !embeddedInLesson;

  const overlayActive =
    showReadyToBeginDialog ||
    state.showTimeExpiredDialog ||
    state.showEndReviewDialog ||
    state.showExitResultsDialog ||
    state.showNoFlaggedDialog ||
    state.showReviewInstructionsDialog ||
    showConfirmSubmitDialog ||
    showConfirmNextStemDialog ||
    showConfirmFinishPracticeDialog ||
    showSubmitSetDialog;

  const incompleteCount = (() => {
    const count = getIncompleteCount(
      questions,
      state.visitedQuestionIds,
      state.selectedAnswers,
      state.syllogismSnapshots,
    );
    if (
      exam?.sourceType === "mock" &&
      state.phase === "review" &&
      state.mockCurrentSetIndex != null &&
      exam.mockSetSummaries
    ) {
      const summary = exam.mockSetSummaries[state.mockCurrentSetIndex];
      if (summary) {
        const setQuestions = questions.slice(
          summary.questionStartIndex,
          summary.questionEndIndex,
        );
        return getIncompleteCount(
          setQuestions,
          state.visitedQuestionIds,
          state.selectedAnswers,
          state.syllogismSnapshots,
        );
      }
    }
    return count;
  })();

  function handleTimeExpiredOk() {
    if (!exam) return;

    // Practice mode (questions/questionStem): transition to answer view
    if (exam.sourceType === "questions" || exam.sourceType === "questionStem") {
      void runWithLag(async () => {
        const { startIndex, endIndex } = getStemBoundaries(
          questions,
          state.currentIndex,
          exam.sourceType as "questions" | "questionStem",
        );
        await recordAnswersForUnit(startIndex, endIndex);
        if (learningModuleBlockId && disableQuestionAttemptLogging) {
          onLearnProgress?.();
        }
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["ucat-quota-usage"] }),
          queryClient.invalidateQueries({ queryKey: practiceTimingQueryKey }),
        ]);
        setSubmittedPracticeQuestionIds((current) => {
          const next = new Set(current);
          for (let index = startIndex; index <= endIndex; index++) {
            const questionId = questions[index]?.id;
            if (questionId) next.add(questionId);
          }
          return next;
        });
        setState((current) => ({
          ...current,
          showTimeExpiredDialog: false,
          phase: "practiceAnswer",
          practiceAnswerUnitStartIndex: startIndex,
          practiceAnswerUnitEndIndex: endIndex,
          viewingQuestionIndex: startIndex,
          showNavigator: false,
        }));
      });
      return;
    }

    if (exam.sourceType === "set") {
      void runWithLag(async () => {
        const redirected = await completeExamAndMaybeRedirect();
        if (redirected) return;
        if (examAttemptManaged && managedExamAttempt?.resultsHref) {
          await redirectToManagedResults(managedExamAttempt.resultsHref);
          return;
        }
        setState((current) => ({
          ...current,
          showTimeExpiredDialog: false,
          phase: "marking",
          reviewFilter: null,
          reviewFilterIndex: 0,
          reviewFilterIndicesSnapshot: null,
          viewingQuestionIndex: null,
          showExitResultsDialog: false,
        }));
        setIsFinalizingExam(false);
      });
      return;
    }
    const nextSeg = getNextMockSegment(exam, state);
    if (!nextSeg) {
      void runWithLag(async () => {
        const redirected = await completeExamAndMaybeRedirect();
        if (redirected) return;
        if (examAttemptManaged && managedExamAttempt?.resultsHref) {
          await redirectToManagedResults(managedExamAttempt.resultsHref);
          return;
        }
        setState((current) => ({
          ...current,
          showTimeExpiredDialog: false,
          phase: "mockScore",
          reviewFilter: null,
          reviewFilterIndex: 0,
          reviewFilterIndicesSnapshot: null,
          viewingQuestionIndex: null,
          showExitResultsDialog: false,
        }));
        setIsFinalizingExam(false);
      });
      return;
    }
    void runWithLag(() => {
      setState((current) => {
        const isNextSegmentTimed = (nextSeg.timeLimitSeconds ?? 0) > 0;
        const next: typeof current = {
          ...current,
          showTimeExpiredDialog: false,
          nextSegmentTimerStartedAt: null,
          timerStartedAt: isNextSegmentTimed
            ? (current.nextSegmentTimerStartedAt ?? Date.now())
            : null,
        };
        if (nextSeg.type === "instructions") {
          next.phase = "instructions";
          next.instructionsIndex = nextSeg.instructionsIndex;
        } else {
          next.phase = "question";
          next.currentIndex = nextSeg.questionStartIndex;
        }
        return next;
      });
    });
  }

  const overlay =
    overlayActive || isLagging ? (
      <>
        {showReadyToBeginDialog ? (
          <div className="absolute inset-0 z-30 grid place-items-center p-6">
            <EngineIntroDialog
              title={
                mode === "mock"
                  ? "Ready to Begin Exam"
                  : "Ready to Begin Practice Set"
              }
              description="If you are ready to begin the exam, select the Yes button. Otherwise, select the No button to return to the previous screen."
              onStart={() =>
                void runWithLag(() => {
                  const nextSeg =
                    exam?.sourceType === "mock"
                      ? getNextMockSegment(exam, state)
                      : null;
                  const questionsSegmentTimed =
                    exam &&
                    (exam.sourceType === "set"
                      ? (exam.setModeTiming?.setTimeLimitSeconds ?? 0) > 0
                      : (nextSeg?.timeLimitSeconds ?? 0) > 0);
                  setState((current) => {
                    const next = {
                      ...current,
                      phase: "question" as const,
                      showReadyDialog: false,
                      timerStartedAt: questionsSegmentTimed ? Date.now() : null,
                    };
                    if (exam?.sourceType === "set") {
                      next.currentIndex = 0;
                    } else if (nextSeg?.type === "questions") {
                      next.currentIndex = nextSeg.questionStartIndex;
                      next.mockCurrentSetIndex = nextSeg.setIndex;
                    }
                    return next;
                  });
                })
              }
              onCancel={() =>
                void runWithLag(() =>
                  setState((current) =>
                    current.showReadyDialog
                      ? { ...current, showReadyDialog: false }
                      : instructionsScreens.length > 0
                        ? {
                            ...current,
                            phase: "instructions",
                            instructionsIndex: instructionsScreens.length - 1,
                          }
                        : { ...current, phase: "intro" },
                  ),
                )
              }
            />
          </div>
        ) : null}

        {showConfirmSubmitDialog ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/20 p-6">
            <ConfirmSubmitDialog
              onConfirm={() =>
                void runWithLag(async () => {
                  await submitCurrentPracticeUnit();
                  setShowConfirmSubmitDialog(false);
                })
              }
              onCancel={() => setShowConfirmSubmitDialog(false)}
            />
          </div>
        ) : null}

        {showConfirmNextStemDialog ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/20 p-6">
            <ConfirmNextStemDialog
              onConfirm={() =>
                void runWithLag(() => {
                  goNext();
                  setShowConfirmNextStemDialog(false);
                })
              }
              onCancel={() => setShowConfirmNextStemDialog(false)}
            />
          </div>
        ) : null}

        {showConfirmFinishPracticeDialog ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/20 p-6">
            <ConfirmFinishPracticeDialog
              submitsCurrentStem={state.phase === "question"}
              isSubmitting={isFinishingPractice}
              onConfirm={() =>
                void runWithLag(() => {
                  setShowConfirmFinishPracticeDialog(false);
                  void handleFinishPractice();
                })
              }
              onCancel={() => setShowConfirmFinishPracticeDialog(false)}
            />
          </div>
        ) : null}

        {state.showTimeExpiredDialog ? (
          <div className="absolute inset-0 z-[35] grid place-items-center bg-black/20 p-6">
            <TimeExpiredDialog
              isSetMode={exam?.sourceType === "set"}
              isPracticeMode={
                exam?.sourceType === "questions" ||
                exam?.sourceType === "questionStem"
              }
              onOk={() => void runWithLag(handleTimeExpiredOk)}
            />
          </div>
        ) : null}

        {state.showExitResultsDialog ? (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/20 p-6">
            <ExitResultsDialog
              onConfirm={() =>
                void runWithLag(() => {
                  setState((current) => ({
                    ...current,
                    phase: "intro",
                    currentIndex: 0,
                    showExitResultsDialog: false,
                  }));
                  if (onBack) onBack();
                  else router.back();
                })
              }
              onCancel={() =>
                void runWithLag(() =>
                  setState((current) => ({
                    ...current,
                    showExitResultsDialog: false,
                  })),
                )
              }
            />
          </div>
        ) : null}

        {state.showEndReviewDialog ? (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/20 p-6">
            <EndReviewDialog
              incompleteCount={incompleteCount}
              isSubmitting={isFinalizingExam}
              onConfirm={() => void runWithLag(handleEndReview)}
              onCancel={() =>
                void runWithLag(() =>
                  setState((current) => ({
                    ...current,
                    showEndReviewDialog: false,
                  })),
                )
              }
            />
          </div>
        ) : null}

        {showSubmitSetDialog ? (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/20 p-6">
            <SubmitSetDialog
              isSubmitting={isFinalizingExam}
              onConfirm={() =>
                void runWithLag(() => {
                  setShowSubmitSetDialog(false);
                  void handleEndReview();
                })
              }
              onCancel={() =>
                void runWithLag(() => setShowSubmitSetDialog(false))
              }
            />
          </div>
        ) : null}

        {isFinalizingExam ? (
          <QuestionEngineFinalizingOverlay label="Submitting attempt..." />
        ) : null}

        {isFinishingPractice ? (
          <QuestionEngineFinalizingOverlay label="Finishing practice..." />
        ) : null}

        {state.showNoFlaggedDialog ? (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/20 p-6">
            <NoFlaggedDialog
              onClose={() =>
                void runWithLag(() =>
                  setState((current) => ({
                    ...current,
                    showNoFlaggedDialog: false,
                  })),
                )
              }
            />
          </div>
        ) : null}

        {state.showReviewInstructionsDialog ? (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/20 p-6">
            <ReviewInstructionsDialog
              onClose={() =>
                void runWithLag(() =>
                  setState((current) => ({
                    ...current,
                    showReviewInstructionsDialog: false,
                  })),
                )
              }
            />
          </div>
        ) : null}

        {isLagging ? (
          <div
            className="absolute inset-0 z-50 cursor-wait bg-transparent"
            aria-hidden="true"
          />
        ) : null}
      </>
    ) : null;

  const headerRight = (
    <div className="flex flex-col items-end gap-0.5">
      {isTimed && displayRemainingSeconds !== null ? (
        <div
          className="text-[12pt] font-normal"
          role="timer"
          aria-label={`Time remaining ${formatTimeRemaining(displayRemainingSeconds)}`}
        >
          <span className="mr-1">Time Remaining</span>
          <span>{formatTimeRemaining(displayRemainingSeconds)}</span>
        </div>
      ) : null}
      {!isInstructionsPhase && !isReviewScreen ? (
        <span className="text-[12pt] font-normal">{questionLabel}</span>
      ) : null}
    </div>
  );

  return (
    <>
      <div
        className={cn(
          isPracticeMode
            ? embeddedInLesson
              ? LEARN_LESSON_EMBEDDED_VIEWPORT_CLASS
              : PRACTICE_EMBEDDED_VIEWPORT_CLASS
            : "contents",
        )}
      >
        <UcatExamShell
          sectionTitle={
            isLoadingMorePhase
              ? `${exam.title} – Loading…`
              : isPracticeCompletePhase
                ? `${exam.title} – Complete`
                : isResultsPhase
                  ? `${exam.title} – Results`
                  : isReviewScreen
                    ? exam.title
                    : (currentQuestion?.sectionName ?? exam.title)
          }
          sectionTitleRight={
            isReviewScreen
              ? isTimed && displayRemainingSeconds !== null
                ? headerRight
                : null
              : !isInstructionsPhase || isTimed
                ? headerRight
                : null
          }
          toolLeft={
            isResultsPhase ? null : isReviewScreen ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
                onClick={() =>
                  void runWithLag(() =>
                    setState((current) => ({
                      ...current,
                      showReviewInstructionsDialog: true,
                    })),
                  )
                }
              >
                <span className="text-[13pt]">Instructions</span>
              </button>
            ) : isInstructionsPhase ? null : (
              <>
                {backHref && !isPracticeMode ? (
                  <Link
                    href={backHref}
                    className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
                    onClick={(e) => {
                      if (onBack) {
                        e.preventDefault();
                        onBack();
                      }
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-[13pt]">Back</span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
                  onClick={() =>
                    void runWithLag(() =>
                      setState((current) => ({
                        ...current,
                        showCalculator: !current.showCalculator,
                      })),
                    )
                  }
                >
                  <Calculator className="h-4 w-4" />
                  <span className="text-[13pt]">
                    <span className="underline">C</span>alculator
                  </span>
                </button>
              </>
            )
          }
          toolRight={
            isResultsPhase ||
            isReviewScreen ||
            isInstructionsPhase ||
            isPracticeAnswerPhase ||
            isPracticeCompletePhase ||
            isLoadingMorePhase ? null : (
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
                onClick={() =>
                  void runWithLag(() => {
                    toggleFlagCurrent();
                  })
                }
              >
                {flaggedCurrent ? (
                  <span
                    className="inline-flex items-center rounded-sm px-0.5 py-0.5"
                    style={{
                      backgroundColor: UCAT_COLORS.highlightYellow,
                      color: UCAT_COLORS.primaryBlueDark,
                    }}
                  >
                    <Flag className="h-4 w-4" />
                  </span>
                ) : (
                  <Flag className="h-4 w-4" />
                )}
                <span className="text-[13pt]">
                  <span className="underline">F</span>lag for Review
                </span>
              </button>
            )
          }
          footerLeft={
            isResultsPhase && state.viewingQuestionIndex != null ? (
              <UcatExamActionButton
                onClick={() =>
                  void runWithLag(() =>
                    setState((current) => ({
                      ...current,
                      viewingQuestionIndex: null,
                    })),
                  )
                }
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                <span className="text-[14pt]">Back to results</span>
              </UcatExamActionButton>
            ) : showFinishPracticeControls &&
              (state.phase === "question" ||
                (state.phase === "practiceAnswer" &&
                  !isLastSetPracticeAnswerScreen)) ? (
              <UcatExamActionButton
                onClick={() =>
                  void runWithLag(() => openFinishPracticeDialog())
                }
                icon={<LogOut className="h-4 w-4" />}
              >
                <span className="text-[14pt]">
                  <span className="underline">F</span>inish practice
                </span>
              </UcatExamActionButton>
            ) : isResultsPhase ? null : isReviewScreen ? (
              <UcatExamActionButton
                onClick={() =>
                  void runWithLag(() => {
                    if (incompleteCount > 0) {
                      setState((current) => ({
                        ...current,
                        showEndReviewDialog: true,
                      }));
                    } else if (exam?.sourceType === "set") {
                      setShowSubmitSetDialog(true);
                    } else {
                      void runWithLag(handleEndReview);
                    }
                  })
                }
                icon={<LogOut className="h-4 w-4" />}
              >
                <span className="text-[14pt]">
                  <span className="underline">E</span>nd Review
                </span>
              </UcatExamActionButton>
            ) : isReviewMode ? (
              <UcatExamActionButton
                onClick={() => void runWithLag(() => goToReviewScreen())}
                icon={<Navigation className="h-4 w-4" />}
              >
                <span className="text-[14pt]">
                  Review <span className="underline">S</span>creen
                </span>
              </UcatExamActionButton>
            ) : isInstructionsPhase ? null : null
          }
          footerRight={
            isPracticeAnswerPhase ? (
              <>
                {(state.viewingQuestionIndex ?? 0) >
                (state.practiceAnswerUnitStartIndex ?? 0) ? (
                  <UcatExamActionButton
                    onClick={() => void runWithLag(() => goPrevious())}
                    icon={<ArrowLeft className="h-4 w-4" />}
                  >
                    <span className="text-[14pt]">
                      <span className="underline">P</span>revious
                    </span>
                  </UcatExamActionButton>
                ) : null}
                {isLastSetPracticeAnswerScreen && showFinishPracticeControls ? (
                  <UcatExamActionButton
                    onClick={() =>
                      void runWithLag(() => openFinishPracticeDialog())
                    }
                    variant="highlight"
                    icon={<LogOut className="h-4 w-4" />}
                  >
                    <span className="text-[14pt]">
                      <span className="underline">F</span>inish practice
                    </span>
                  </UcatExamActionButton>
                ) : !(
                    state.viewingQuestionIndex === questions.length - 1 &&
                    !onNeedMoreStems
                  ) ? (
                  <UcatExamActionButton
                    onClick={() =>
                      void runWithLag(() => {
                        const unitEnd = state.practiceAnswerUnitEndIndex ?? 0;
                        const viewing = state.viewingQuestionIndex ?? 0;
                        const isGoingToNextStem = viewing >= unitEnd;
                        if (isGoingToNextStem && confirmPracticeTransitions) {
                          setShowConfirmNextStemDialog(true);
                        } else {
                          goNext();
                        }
                      })
                    }
                    variant="highlight"
                    icon={<ArrowRight className="h-4 w-4" />}
                    iconRight
                  >
                    <span className="text-[14pt]">
                      {(state.viewingQuestionIndex ?? 0) >=
                      (state.practiceAnswerUnitEndIndex ?? 0) ? (
                        <>
                          <span className="underline">N</span>ext question
                        </>
                      ) : (
                        <>
                          <span className="underline">N</span>ext
                        </>
                      )}
                    </span>
                  </UcatExamActionButton>
                ) : null}
              </>
            ) : isResultsPhase ? (
              state.viewingQuestionIndex != null ? (
                <>
                  {state.viewingQuestionIndex > 0 ? (
                    <UcatExamActionButton
                      onClick={() =>
                        void runWithLag(() =>
                          setState((current) => ({
                            ...current,
                            viewingQuestionIndex: Math.max(
                              0,
                              (current.viewingQuestionIndex ?? 0) - 1,
                            ),
                          })),
                        )
                      }
                      icon={<ArrowLeft className="h-4 w-4" />}
                    >
                      <span className="text-[14pt]">
                        <span className="underline">P</span>revious
                      </span>
                    </UcatExamActionButton>
                  ) : null}
                  <UcatExamActionButton
                    onClick={() =>
                      void runWithLag(() => {
                        const idx = state.viewingQuestionIndex ?? 0;
                        if (idx < questions.length - 1) {
                          setState((current) => ({
                            ...current,
                            viewingQuestionIndex: idx + 1,
                          }));
                        } else {
                          setState((current) => ({
                            ...current,
                            viewingQuestionIndex: null,
                          }));
                        }
                      })
                    }
                    variant="highlight"
                    icon={<ArrowRight className="h-4 w-4" />}
                    iconRight
                  >
                    <span className="text-[14pt]">
                      {(state.viewingQuestionIndex ?? 0) < questions.length - 1
                        ? "Next"
                        : "Done"}
                    </span>
                  </UcatExamActionButton>
                </>
              ) : exam?.sourceType === "set" ||
                exam?.sourceType === "mock" ? null : (
                <UcatExamActionButton
                  onClick={() =>
                    void runWithLag(() =>
                      setState((current) => ({
                        ...current,
                        showExitResultsDialog: true,
                      })),
                    )
                  }
                  variant="highlight"
                  icon={<ArrowRight className="h-4 w-4" />}
                  iconRight
                >
                  <span className="text-[14pt]">Exit</span>
                </UcatExamActionButton>
              )
            ) : isReviewScreen ? (
              <>
                <UcatExamActionButton
                  onClick={() =>
                    void runWithLag(() => startReviewFilter("all"))
                  }
                  icon={<Search className="h-4 w-4" />}
                >
                  <span className="text-[14pt]">
                    Review <span className="underline">A</span>ll
                  </span>
                </UcatExamActionButton>
                <UcatExamActionButton
                  onClick={() =>
                    void runWithLag(() => startReviewFilter("incomplete"))
                  }
                  icon={<X className="h-4 w-4" />}
                >
                  <span className="text-[14pt]">
                    Review <span className="underline">I</span>ncomplete
                  </span>
                </UcatExamActionButton>
                <UcatExamActionButton
                  onClick={() =>
                    void runWithLag(() => startReviewFilter("flagged"))
                  }
                  icon={<Flag className="h-4 w-4" />}
                >
                  <span className="text-[14pt]">
                    Re<span className="underline">v</span>iew Flagged
                  </span>
                </UcatExamActionButton>
              </>
            ) : isReviewMode ? (
              <>
                {state.reviewFilterIndex > 0 ? (
                  <UcatExamActionButton
                    onClick={() => void runWithLag(() => goPrevious())}
                    icon={<ArrowLeft className="h-4 w-4" />}
                  >
                    <span className="text-[14pt]">
                      <span className="underline">P</span>revious
                    </span>
                  </UcatExamActionButton>
                ) : null}
                <UcatExamActionButton
                  onClick={() => void runWithLag(() => goNext())}
                  variant="highlight"
                  icon={<ArrowRight className="h-4 w-4" />}
                  iconRight
                >
                  <span className="text-[14pt]">
                    <span className="underline">N</span>ext
                  </span>
                </UcatExamActionButton>
              </>
            ) : isInstructionsPhase ? (
              <>
                {hasPreviousInstructions ? (
                  <UcatExamActionButton
                    onClick={() => void runWithLag(() => goPrevious())}
                    icon={<ArrowLeft className="h-4 w-4" />}
                  >
                    <span className="text-[14pt]">
                      <span className="underline">P</span>revious
                    </span>
                  </UcatExamActionButton>
                ) : null}
                <UcatExamActionButton
                  onClick={() => void runWithLag(() => goNext())}
                  variant="highlight"
                  icon={<ArrowRight className="h-4 w-4" />}
                  iconRight
                >
                  <span className="text-[14pt]">
                    <span className="underline">N</span>ext
                  </span>
                </UcatExamActionButton>
              </>
            ) : isPracticeCompletePhase ? null : (
              <>
                {hasPreviousQuestion ? (
                  <UcatExamActionButton
                    onClick={() =>
                      void runWithLag(() => {
                        goPrevious();
                      })
                    }
                    icon={<ArrowLeft className="h-4 w-4" />}
                  >
                    <span className="text-[14pt]">
                      <span className="underline">P</span>revious
                    </span>
                  </UcatExamActionButton>
                ) : null}
                {!isPracticeMode ? (
                  <UcatExamActionButton
                    onClick={() =>
                      void runWithLag(() =>
                        setState((current) => ({
                          ...current,
                          showNavigator: !current.showNavigator,
                        })),
                      )
                    }
                    icon={<Navigation className="h-4 w-4" />}
                  >
                    <span className="text-[14pt]">
                      Na<span className="underline">v</span>igator
                    </span>
                  </UcatExamActionButton>
                ) : null}
                <UcatExamActionButton
                  onClick={() =>
                    void runWithLag(() => {
                      if (isPracticeMode && isLastQuestionOfCurrentUnit) {
                        if (confirmPracticeTransitions) {
                          setShowConfirmSubmitDialog(true);
                        } else {
                          submitCurrentPracticeUnit();
                        }
                      } else {
                        goNext();
                      }
                    })
                  }
                  variant="highlight"
                  icon={<ArrowRight className="h-4 w-4" />}
                  iconRight
                >
                  {isPracticeMode && isLastQuestionOfCurrentUnit ? (
                    <span className="text-[14pt]">
                      <span className="underline">S</span>ubmit
                    </span>
                  ) : isLastQuestion && !isPracticeMode ? (
                    <span className="text-[14pt]">Review</span>
                  ) : (
                    <span className="text-[14pt]">
                      <span className="underline">N</span>ext
                    </span>
                  )}
                </UcatExamActionButton>
              </>
            )
          }
          overlay={overlay}
        >
          {isInstructionsPhase && currentInstructionsScreen ? (
            <InstructionsContent screen={currentInstructionsScreen} />
          ) : isPracticeCompletePhase ? (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-[14pt]">Practice complete.</p>
              <p className="text-[12pt] text-muted-foreground">
                {practiceMarkingResult
                  ? `${practiceCorrectCount} correct / ${questions.length} total`
                  : "You have reviewed all questions."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => (onBack ? onBack() : router.back())}
                  className="h-10 px-4"
                >
                  Back to practice
                </Button>
                {practiceSessionId ? (
                  <Link
                    href={`/progress/practice-sessions/${practiceSessionId}`}
                    data-skip-leave-warning
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground hover:bg-sidebar/90"
                  >
                    View attempt
                  </Link>
                ) : null}
              </div>
            </div>
          ) : isLoadingMorePhase ? (
            <QuestionEngineLoadingContentSkeleton />
          ) : isPracticeAnswerPhase || isResultsPhase ? (
            state.viewingQuestionIndex != null &&
            questions[state.viewingQuestionIndex] ? (
              <ResultsQuestionViewer
                question={questions[state.viewingQuestionIndex]!}
                selectedOptionId={
                  state.selectedAnswers[
                    questions[state.viewingQuestionIndex]!.id
                  ]
                }
                correctOptionId={
                  questions[state.viewingQuestionIndex]!.correctOptionId
                }
                preloadedContent={getCachedContent(
                  questions[state.viewingQuestionIndex]!.id,
                )}
                points={(() => {
                  const idx = state.viewingQuestionIndex!;
                  if (
                    isMockScorePhase &&
                    exam &&
                    exam.sourceType === "mock" &&
                    exam.mockSetSummaries
                  ) {
                    const summary = exam.mockSetSummaries.find(
                      (s: {
                        questionStartIndex: number;
                        questionEndIndex: number;
                      }) =>
                        idx >= s.questionStartIndex && idx < s.questionEndIndex,
                    );
                    if (summary) {
                      const setQuestions = questions.slice(
                        summary.questionStartIndex,
                        summary.questionEndIndex,
                      );
                      const result = computeMarkingResult(
                        setQuestions,
                        state.selectedAnswers,
                        state.syllogismSnapshots,
                      );
                      return result.rows[idx - summary.questionStartIndex]
                        ?.points;
                    }
                  }
                  return computeMarkingResult(
                    questions,
                    state.selectedAnswers,
                    state.syllogismSnapshots,
                  ).rows[idx]?.points;
                })()}
                syllogismSnapshot={
                  state.syllogismSnapshots?.[
                    questions[state.viewingQuestionIndex]!.id
                  ]
                }
              />
            ) : isMockScorePhase &&
              exam?.sourceType === "mock" &&
              exam.mockSetSummaries?.length ? (
              <MockScoreBody
                exam={exam}
                questions={questions}
                selectedAnswers={state.selectedAnswers}
                syllogismSnapshots={state.syllogismSnapshots}
                onViewQuestion={(index) =>
                  void runWithLag(() =>
                    setState((current) => ({
                      ...current,
                      viewingQuestionIndex: index,
                    })),
                  )
                }
                viewAttemptHref={setMockResultsActions?.viewAttemptHref}
              />
            ) : (
              <MarkingBody
                result={computeMarkingResult(
                  questions,
                  state.selectedAnswers,
                  state.syllogismSnapshots,
                )}
                syllogismSnapshots={state.syllogismSnapshots}
                onViewQuestion={(index) =>
                  void runWithLag(() =>
                    setState((current) => ({
                      ...current,
                      viewingQuestionIndex: index,
                    })),
                  )
                }
                viewAttemptHref={setMockResultsActions?.viewAttemptHref}
              />
            )
          ) : isReviewScreen ? (
            <ReviewBody
              sectionTitle={exam.title}
              incompleteCount={incompleteCount}
              rows={reviewListRows}
              flaggedIds={state.flaggedIds}
              onToggleFlag={toggleFlagById}
              onSelectQuestion={goToReviewQuestionByGlobalIndex}
            />
          ) : currentQuestion ? (
            <QuestionContent
              question={currentQuestion}
              selectedOptionId={state.selectedAnswers[currentQuestion.id]}
              syllogismSnapshot={state.syllogismSnapshots?.[currentQuestion.id]}
              onChangeSyllogismSnapshot={(snapshot) =>
                setSyllogismSnapshot(currentQuestion.id, snapshot)
              }
              onSelectOption={(optionId) => {
                setAnswer(optionId);
                recordAnswer(currentQuestion.id, optionId, flaggedCurrent);
              }}
              preloadedContent={getCachedContent(currentQuestion.id)}
              showAnswerExplanations={Boolean(
                isReviewMode &&
                  (exam?.sourceType === "questions" ||
                    exam?.sourceType === "questionStem"),
              )}
            />
          ) : null}
        </UcatExamShell>
      </div>

      {state.showCalculator ? (
        <CalculatorPanel
          display={calculatorDisplay}
          onKey={calculatorOnKey}
          onClose={() =>
            void runWithLag(() =>
              setState((current) => ({ ...current, showCalculator: false })),
            )
          }
        />
      ) : null}

      {state.showNavigator ? (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute left-1/2 top-24 -translate-x-1/2 pointer-events-auto">
            <NavigatorPanel
              questions={
                exam?.sourceType === "mock" && state.phase === "question"
                  ? (() => {
                      const seg = getCurrentMockSegment(exam, state);
                      if (seg?.type === "questions") {
                        return questions.slice(
                          seg.questionStartIndex,
                          seg.questionEndIndex,
                        );
                      }
                      return questions;
                    })()
                  : questions
              }
              currentIndex={
                exam?.sourceType === "mock" && state.phase === "question"
                  ? (() => {
                      const seg = getCurrentMockSegment(exam, state);
                      if (seg?.type === "questions") {
                        return state.currentIndex - seg.questionStartIndex;
                      }
                      return state.currentIndex;
                    })()
                  : state.currentIndex
              }
              flaggedIds={state.flaggedIds}
              selectedAnswers={state.selectedAnswers}
              visitedQuestionIds={state.visitedQuestionIds}
              syllogismSnapshots={state.syllogismSnapshots}
              onSelect={(index: number) =>
                void runWithLag(() => {
                  const globalIndex =
                    exam?.sourceType === "mock" && state.phase === "question"
                      ? (() => {
                          const seg = getCurrentMockSegment(exam, state);
                          if (seg?.type === "questions") {
                            return seg.questionStartIndex + index;
                          }
                          return index;
                        })()
                      : index;
                  setQuestionByIndex(globalIndex);
                })
              }
              onClose={() =>
                void runWithLag(() =>
                  setState((current) => ({ ...current, showNavigator: false })),
                )
              }
            />
          </div>
        </div>
      ) : null}

      <PlanPickerDialogShell
        open={Boolean(practiceQuotaReached)}
        onOpenChange={() => {}}
        dismissible={false}
        hideCloseButton
        title="Practice limit reached"
        description="You've used your UCAT Free practice questions for this period. Upgrade to continue this session, or finish it and review what you've completed."
        footer={
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void handleFinishPractice()}
            disabled={completePracticeSession.isPending}
          >
            {completePracticeSession.isPending
              ? "Finishing..."
              : "Finish session"}
          </Button>
        }
      >
        <PlanPicker
          variant="dialog"
          surfaceTheme="app"
          checkoutReturnContext="practice_session"
          visibleTiers={["unlimited", "pro"]}
          layout="horizontal"
        />
      </PlanPickerDialogShell>
    </>
  );
}
