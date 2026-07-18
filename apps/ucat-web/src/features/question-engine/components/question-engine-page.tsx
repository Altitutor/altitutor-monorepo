"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Flag,
  Loader2,
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
import {
  useQuestionEngineState,
  type OnNeedMoreStems,
} from "@/features/question-engine/hooks/use-question-engine-state";
import { useUcatLag } from "@/features/question-engine/context/ucat-lag-context";
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
  QuestionEngineState,
  QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
import {
  mapQuestionStemsToItems,
  mapQuestionsToItems,
} from "@/features/question-engine/model/types";
import {
  computeClientStemQuestionTimes,
  computeReconciledStemQuestionTimes,
  getStemBoundaries,
} from "@/features/question-engine/lib/practice";
import {
  EMPTY_CLIENT_PRACTICE_QUESTION_TIMING,
  flushActiveClientPracticeQuestionTiming,
  getClientPracticeQuestionElapsedMilliseconds,
  switchClientPracticeQuestionTiming,
  type ClientPracticeQuestionTiming,
  type PracticeQuestionTimingData,
} from "@/features/question-engine/lib/practice-question-timing";
import { QUESTION_ENGINE_SHORTCUT_MAP } from "@/features/question-engine/model/shortcuts";
import { useExamAttemptLifecycle } from "@/features/exam-attempts/hooks/use-exam-attempt-lifecycle";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { finalizeExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { useExamAttemptLaunchGate } from "@/features/exam-attempts/hooks/use-exam-attempt-launch-gate";
import { ExamAttemptConflictDialog } from "@/features/exam-attempts/components/exam-attempt-conflict-dialog";
import { useQuestionEnginePersistence } from "@/features/question-engine/hooks/use-question-engine-persistence";
import {
  fetchPracticeAttemptDetail,
  practiceAttemptDetailQueryKey,
} from "@/features/progress/hooks/use-practice-attempt-detail";
import {
  fetchSetAttemptDetail,
  setAttemptDetailQueryKey,
} from "@/features/progress/hooks/use-set-attempt-detail";
import {
  fetchMockAttemptDetail,
  mockAttemptDetailQueryKey,
} from "@/features/progress/hooks/use-mock-attempt-detail";
import { useRefreshedContentCache } from "@/features/question-engine/hooks/use-refreshed-content-cache";
import type { QuotaExceededPayload } from "@/features/ucat-access/types/quota";
import type { PracticeReviewTiming } from "@/features/practice/lib/session-storage";
import { SECTION_NAME_TO_NUMBER } from "@/features/sets/lib/section-labels";
import { cn } from "@/lib/utils";
import { useNextStep } from "nextstepjs";
import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-steps";

const CalculatorPanel = dynamic(() =>
  import("@/features/question-engine/components/calculator-panel").then(
    (module) => module.CalculatorPanel,
  ),
);
const MockScoreBody = dynamic(() =>
  import("@/features/question-engine/components/mock-score-body").then(
    (module) => module.MockScoreBody,
  ),
);
const ResultsQuestionViewer = dynamic(() =>
  import("@/features/question-engine/components/results-question-viewer").then(
    (module) => module.ResultsQuestionViewer,
  ),
);
const ReviewBody = dynamic(() =>
  import("@/features/question-engine/components/review-body").then(
    (module) => module.ReviewBody,
  ),
);
const PlanPicker = dynamic(() =>
  import("@/features/subscription/components/plan-picker/plan-picker").then(
    (module) => module.PlanPicker,
  ),
);
const PlanPickerDialogShell = dynamic(() =>
  import(
    "@/features/subscription/components/plan-picker/plan-picker-dialog-shell"
  ).then((module) => module.PlanPickerDialogShell),
);

/**
 * Standalone practice (e.g. `/practice/stem/[id]`): fill the padded app-shell
 * viewport (`pt-28` + bottom `p-6` = 8.5rem).
 */
export const PRACTICE_EMBEDDED_VIEWPORT_CLASS =
  "mx-auto h-[calc(100dvh-8.5rem)] max-h-[calc(100dvh-8.5rem)] w-full min-h-0 overflow-hidden";

/** Parent supplies a definite height (practice session layout). */
export const PRACTICE_FILL_PARENT_CLASS =
  "mx-auto h-full min-h-0 w-full overflow-hidden";

export const LEARN_LESSON_EMBEDDED_VIEWPORT_CLASS =
  "mx-auto h-[min(760px,calc(100dvh-8rem))] min-h-[520px] w-full overflow-hidden";

function practiceEngineShellClassName({
  embeddedInLesson,
  fillAvailableHeight,
}: {
  embeddedInLesson: boolean;
  fillAvailableHeight: boolean;
}): string {
  if (embeddedInLesson) return LEARN_LESSON_EMBEDDED_VIEWPORT_CLASS;
  if (fillAvailableHeight) return PRACTICE_FILL_PARENT_CLASS;
  return PRACTICE_EMBEDDED_VIEWPORT_CLASS;
}

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
  fillAvailableHeight,
}: {
  label: string;
  isPracticeMode: boolean;
  embeddedInLesson: boolean;
  fillAvailableHeight: boolean;
}) {
  return (
    <div
      className={cn(
        isPracticeMode
          ? practiceEngineShellClassName({
              embeddedInLesson,
              fillAvailableHeight,
            })
          : "h-full min-h-0 w-full overflow-hidden",
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
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      className="absolute inset-0 z-50 grid cursor-wait place-items-center bg-black/25 p-6 outline-none"
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
  revealAccuracy: boolean;
  totalAnsweredTimeSeconds: number;
  currentQuestionNumber: number;
  totalQuestionLabel: string;
  timingPhase: "question" | "practiceAnswer";
  stemTimeSeconds: number;
  stemQuestionTimes: Array<{
    questionId: string;
    label: string;
    seconds: number;
  }>;
};

type PracticeQuestionTimingResponse = PracticeQuestionTimingData;

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

export type QuestionEngineTutorialSnapshot = {
  questionId: string | null;
  questionIndex: number;
  selectedOptionId: string | null;
  syllogismSnapshot: Record<string, boolean>;
  flagged: boolean;
  showCalculator: boolean;
  showNavigator: boolean;
  calculatorDisplay: string;
};

export type QuestionEngineTutorialControl =
  | "calculator"
  | "flag"
  | "navigator"
  | "previous"
  | "syllogismChoice";

export function QuestionEnginePage({
  mode,
  sourceId,
  questionStems,
  standaloneQuestions,
  practice = false,
  practiceSessionId,
  reviewTiming = "afterEachStem",
  onPracticeStatsChange,
  confirmPracticeTransitions = true,
  timePerQuestionSeconds = null,
  backHref,
  onBack,
  onPracticeSessionCompleted,
  onNeedMoreStems,
  practiceQuotaReached,
  learningModuleBlockId,
  onLearnProgress,
  disableQuestionAttemptLogging = false,
  embeddedInLesson = false,
  fillAvailableHeight = false,
  onRegisterFinishPracticeDialog,
  tutorialMode = false,
  tutorialCalculatorDraggable = false,
  tutorialSequential = false,
  tutorialLockedQuestionIds = [],
  tutorialLockedSyllogismOptionIds = {},
  tutorialCorrectSyllogismOptionIds = {},
  tutorialHighlightText,
  tutorialSyllogismDragOnly = false,
  tutorialHidePrevious = false,
  tutorialHidePrimaryAction = false,
  tutorialPrimaryActionLabel,
  onTutorialStateChange,
  onTutorialRequestNext,
  onTutorialControl,
  onRegisterTutorialAdvance,
  onTutorialComplete,
  tutorialFinishLabel = "Finish tutorial",
}: {
  mode: QuestionEngineMode;
  sourceId?: string;
  questionStems?: QuestionStemWithQuestions[];
  standaloneQuestions?: QuestionEngineQuestion[];
  /** When true (questions/questionStem mode only): submit after each question/stem, show answer immediately, no final review phase. */
  practice?: boolean;
  /** When provided (practice mode): links question attempts to this session for persistence. */
  practiceSessionId?: string | null;
  /** Practice sessions only: reveal feedback per stem or after the session boundary. */
  reviewTiming?: PracticeReviewTiming;
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
  /** Lets the practice page own cleanup and navigation after durable completion. */
  onPracticeSessionCompleted?: (attemptHref: string) => void;
  /** Unlimited mode: fetch another stem or report why the session cannot continue. */
  onNeedMoreStems?: OnNeedMoreStems;
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
  /**
   * When true, fill the parent height instead of using a viewport calc.
   * Used by practice session where the parent owns the remaining-height layout.
   */
  fillAvailableHeight?: boolean;
  /** Parent can call the registered opener to show the finish-practice confirmation dialog. */
  onRegisterFinishPracticeDialog?: (open: () => void) => void;
  /** Runs the real engine with local tutorial data and no persistence or leave warning. */
  tutorialMode?: boolean;
  /** Keep the calculator movable while a local tutorial is active. */
  tutorialCalculatorDraggable?: boolean;
  /** Advance straight through local tutorial questions instead of showing review. */
  tutorialSequential?: boolean;
  /** Keep already-correct tutorial answers visible and immutable. */
  tutorialLockedQuestionIds?: readonly string[];
  /** Lock individual correct syllogism rows while the student retries the rest. */
  tutorialLockedSyllogismOptionIds?: Record<string, readonly string[]>;
  /** Visually mark correctly assigned syllogism rows. */
  tutorialCorrectSyllogismOptionIds?: Record<string, readonly string[]>;
  /** Emphasise exact plain text referenced by sampler coaching. */
  tutorialHighlightText?: string;
  /** Require drag-and-drop for tutorial syllogism tokens. */
  tutorialSyllogismDragOnly?: boolean;
  /** Hide Previous while preserving the normal engine default. */
  tutorialHidePrevious?: boolean;
  /** Let an external feedback card own progression after a correct answer. */
  tutorialHidePrimaryAction?: boolean;
  /** Override the tutorial question action label. */
  tutorialPrimaryActionLabel?: string;
  /** A small read-only snapshot for locally orchestrated tutorial coaching. */
  onTutorialStateChange?: (snapshot: QuestionEngineTutorialSnapshot) => void;
  /** Return false to keep the tutorial on the current question. */
  onTutorialRequestNext?: (snapshot: QuestionEngineTutorialSnapshot) => boolean;
  /** Observe or block sampler-only control interactions. */
  onTutorialControl?: (
    control: QuestionEngineTutorialControl,
    snapshot: QuestionEngineTutorialSnapshot,
  ) => boolean | void;
  /** Registers the sampler's external Next action. */
  onRegisterTutorialAdvance?: (advance: () => void) => void;
  /** Completes a locally orchestrated tutorial segment. The legacy tour handles this when omitted. */
  onTutorialComplete?: () => void;
  /** Label for a locally orchestrated tutorial segment's completion action. */
  tutorialFinishLabel?: string;
}) {
  const { currentTour, currentStep } = useNextStep();
  const invalidLearningMode =
    learningModuleBlockId && mode !== "questions" && mode !== "questionStem";

  const queryClient = useQueryClient();
  const practiceTimingQueryKey = useMemo(
    () => ["ucat", "practice-question-timing", practiceSessionId] as const,
    [practiceSessionId],
  );
  const query = useQuestionEngineData({
    mode,
    setId: mode === "set" ? sourceId : undefined,
    mockId: mode === "mock" ? sourceId : undefined,
  });

  const launchGateKind =
    (mode === "set" || mode === "mock") && sourceId ? mode : null;
  const launchGate = useExamAttemptLaunchGate(launchGateKind, sourceId);

  // Practice-session creation already returns complete stem/question payloads.
  // Re-fetching each stem here added an avoidable loading waterfall.
  const questionStemsForExam = questionStems;

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

  const immediatePracticeReview = practice && reviewTiming === "afterEachStem";
  const isPracticeSession = practice && practiceSessionId != null;

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
    setQuestionByIndex,
    toggleFlagCurrent,
    toggleFlagById,
    setAnswer,
    goToReviewScreen,
    startReviewFilter,
    goToReviewQuestionByGlobalIndex,
    setSyllogismSnapshot,
  } = useQuestionEngineState(exam, {
    practice: immediatePracticeReview,
    reviewAtEnd: practice && reviewTiming === "atEnd",
    onNeedMoreStems,
  });

  const practiceTimingQuery = useQuery({
    queryKey: practiceTimingQueryKey,
    queryFn: () => fetchPracticeQuestionTiming(practiceSessionId!),
    enabled:
      practice &&
      practiceSessionId != null &&
      !embeddedInLesson &&
      state.phase === "practiceAnswer",
  });

  const [stemTimingTick, setStemTimingTick] = useState(0);
  const clientPracticeTimingRef = useRef<ClientPracticeQuestionTiming>(
    EMPTY_CLIENT_PRACTICE_QUESTION_TIMING,
  );

  const refreshPracticeStemTimingFromServer = useCallback(async () => {
    if (!practiceSessionId) return;
    await queryClient.fetchQuery({
      queryKey: practiceTimingQueryKey,
      queryFn: () => fetchPracticeQuestionTiming(practiceSessionId),
    });
  }, [practiceSessionId, queryClient, practiceTimingQueryKey]);

  const prevPracticeSessionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const sessionKey = `${exam?.sourceId ?? "none"}:${practiceSessionId ?? "none"}`;
    if (prevPracticeSessionKeyRef.current === sessionKey) return;
    prevPracticeSessionKeyRef.current = sessionKey;
    clientPracticeTimingRef.current = EMPTY_CLIENT_PRACTICE_QUESTION_TIMING;
  }, [exam?.sourceId, practiceSessionId]);

  useEffect(() => {
    if (state.phase !== "question") return;
    const question = questions[effectiveCurrentIndex];
    if (!question) return;
    clientPracticeTimingRef.current = switchClientPracticeQuestionTiming(
      clientPracticeTimingRef.current,
      question.id,
    );
  }, [state.phase, effectiveCurrentIndex, questions]);

  useEffect(() => {
    if (state.phase !== "question" || !practiceSessionId) return;
    const id = setInterval(() => {
      setStemTimingTick((tick) => tick + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [state.phase, practiceSessionId]);

  useEffect(() => {
    if (!tutorialMode || !exam || state.phase !== "intro") return;
    setState((current) => ({
      ...current,
      phase: "question",
      currentIndex: 0,
    }));
  }, [tutorialMode, exam, state.phase, setState]);

  useEffect(() => {
    if (
      !tutorialMode ||
      currentTour !== UCAT_QUESTION_ENGINE_TOUR ||
      currentStep !== 12 ||
      !exam
    )
      return;
    setState((current) => ({
      ...current,
      phase: "question",
      currentIndex: exam.questions.length - 1,
      showNavigator: false,
      showCalculator: false,
    }));
  }, [tutorialMode, currentTour, currentStep, exam, setState]);
  const router = useRouter();
  const { toast } = useToast();
  const { active: activeExamAttempt, clearLocal: clearActiveExamAttempt } =
    useActiveExamAttempt();
  const { isLagging, runWithLag } = useUcatLag();
  const {
    display: calculatorDisplay,
    onKey: calculatorOnKey,
    reset: resetCalculator,
  } = useUcatCalculator();
  const [, setTick] = useState(0);
  const [showConfirmSubmitDialog, setShowConfirmSubmitDialog] = useState(false);
  const [showConfirmNextStemDialog, setShowConfirmNextStemDialog] =
    useState(false);
  const [showConfirmFinishPracticeDialog, setShowConfirmFinishPracticeDialog] =
    useState(false);
  const [showSubmitSetDialog, setShowSubmitSetDialog] = useState(false);
  const [isFinalizingExam, setIsFinalizingExam] = useState(false);
  const [isFinishingPractice, setIsFinishingPractice] = useState(false);
  const [isSavingPracticeUnit, setIsSavingPracticeUnit] = useState(false);
  const [submittedPracticeQuestionIds, setSubmittedPracticeQuestionIds] =
    useState<Set<string>>(() => new Set());
  const timeExpiredFiredRef = useRef<string | null>(null);
  const suppressQuestionTimingSyncRef = useRef(false);
  const practiceUnitSavePromiseRef = useRef<Promise<void> | null>(null);

  const tutorialSnapshot = useMemo<QuestionEngineTutorialSnapshot>(
    () => ({
      questionId: currentQuestion?.id ?? null,
      questionIndex: effectiveCurrentIndex,
      selectedOptionId: currentQuestion
        ? (state.selectedAnswers[currentQuestion.id] ?? null)
        : null,
      syllogismSnapshot: currentQuestion
        ? (state.syllogismSnapshots?.[currentQuestion.id] ?? {})
        : {},
      flagged: currentQuestion
        ? state.flaggedIds.includes(currentQuestion.id)
        : false,
      showCalculator: state.showCalculator,
      showNavigator: state.showNavigator,
      calculatorDisplay,
    }),
    [
      calculatorDisplay,
      currentQuestion,
      effectiveCurrentIndex,
      state.flaggedIds,
      state.selectedAnswers,
      state.showCalculator,
      state.showNavigator,
      state.syllogismSnapshots,
    ],
  );
  const tutorialQuestionLocked =
    tutorialMode &&
    tutorialSnapshot.questionId != null &&
    tutorialLockedQuestionIds.includes(tutorialSnapshot.questionId);

  useEffect(() => {
    if (!tutorialMode || !onTutorialStateChange) return;
    onTutorialStateChange(tutorialSnapshot);
  }, [onTutorialStateChange, tutorialMode, tutorialSnapshot]);

  const allowTutorialControl = useCallback(
    (control: QuestionEngineTutorialControl) =>
      !tutorialMode ||
      !onTutorialControl ||
      onTutorialControl(control, tutorialSnapshot) !== false,
    [onTutorialControl, tutorialMode, tutorialSnapshot],
  );

  const advanceTutorialQuestion = useCallback(() => {
    if (
      tutorialMode &&
      onTutorialRequestNext &&
      !onTutorialRequestNext(tutorialSnapshot)
    ) {
      return;
    }
    if (tutorialMode && tutorialSequential && isLastQuestion) {
      onTutorialComplete?.();
      return;
    }
    goNext();
  }, [
    goNext,
    isLastQuestion,
    onTutorialComplete,
    onTutorialRequestNext,
    tutorialMode,
    tutorialSequential,
    tutorialSnapshot,
  ]);
  useEffect(() => {
    if (!tutorialMode || !onRegisterTutorialAdvance) return;
    onRegisterTutorialAdvance(advanceTutorialQuestion);
    return () => onRegisterTutorialAdvance(() => undefined);
  }, [advanceTutorialQuestion, onRegisterTutorialAdvance, tutorialMode]);
  const engineStateRef = useRef(state);
  engineStateRef.current = state;
  const expiredMockNextSegmentRef = useRef<{
    segment: ReturnType<typeof getNextMockSegment>;
    startedAt: number;
  } | null>(null);

  const openFinishPracticeDialog = useCallback(() => {
    setShowConfirmFinishPracticeDialog(true);
  }, []);

  useEffect(() => {
    onRegisterFinishPracticeDialog?.(openFinishPracticeDialog);
  }, [onRegisterFinishPracticeDialog, openFinishPracticeDialog]);

  // Real UCAT: calculator closes and clears (including memory) when changing question.
  useEffect(() => {
    resetCalculator();
    setState((current) =>
      current.showCalculator ? { ...current, showCalculator: false } : current,
    );
  }, [state.currentIndex, resetCalculator, setState]);

  useEffect(() => {
    setSubmittedPracticeQuestionIds(new Set());
  }, [exam?.sourceId, practiceSessionId]);

  const examAttemptManaged =
    !learningModuleBlockId &&
    (mode === "set" || mode === "mock" || isPracticeSession);

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
    recordSyllogismSnapshot,
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

  const finalPracticeAnswers = useMemo(() => {
    if (!exam || !practiceSessionId) return [];
    const dbMode =
      mode === "questionStem"
        ? ("question_stem" as const)
        : ("question" as const);
    return exam.questions.map((question) => {
      const syllogismSnapshot = state.syllogismSnapshots?.[question.id];
      return {
        studentQuestionSetAttemptId: null,
        studentPracticeSessionId: practiceSessionId,
        questionId: question.id,
        questionAnswerOptionId:
          question.questionType === "syllogism"
            ? null
            : (state.selectedAnswers[question.id] ?? null),
        answerSnapshot:
          question.questionType === "syllogism" && syllogismSnapshot
            ? {
                type: "syllogism_v1",
                answers: Object.entries(syllogismSnapshot).map(
                  ([optionId, value]) => ({
                    question_answer_option_id: optionId,
                    answer: value,
                  }),
                ),
              }
            : undefined,
        isFlagged: state.flaggedIds.includes(question.id),
        wasTimed: false,
        mode: dbMode,
        submittedByStem: true,
      };
    });
  }, [
    exam,
    mode,
    practiceSessionId,
    state.flaggedIds,
    state.selectedAnswers,
    state.syllogismSnapshots,
  ]);

  const getFinalPracticeAnswers = useCallback(() => {
    const nowMs = Date.now();
    return finalPracticeAnswers.map((answer) => ({
      ...answer,
      timeSpentMilliseconds: getClientPracticeQuestionElapsedMilliseconds(
        answer.questionId,
        clientPracticeTimingRef.current,
        nowMs,
      ),
    }));
  }, [finalPracticeAnswers]);

  const prefetchAttemptResults = useCallback(() => {
    if (practiceSessionId) {
      return queryClient.prefetchQuery({
        queryKey: practiceAttemptDetailQueryKey(practiceSessionId),
        queryFn: () => fetchPracticeAttemptDetail(practiceSessionId),
      });
    }
    if (attemptIds.setAttemptId) {
      const attemptId = attemptIds.setAttemptId;
      return queryClient.prefetchQuery({
        queryKey: setAttemptDetailQueryKey(attemptId),
        queryFn: () => fetchSetAttemptDetail(attemptId),
      });
    }
    if (attemptIds.mockAttemptId) {
      const attemptId = attemptIds.mockAttemptId;
      return queryClient.prefetchQuery({
        queryKey: mockAttemptDetailQueryKey(attemptId),
        queryFn: () => fetchMockAttemptDetail(attemptId),
      });
    }
    return Promise.resolve();
  }, [
    attemptIds.mockAttemptId,
    attemptIds.setAttemptId,
    practiceSessionId,
    queryClient,
  ]);

  const examAttemptLifecycleEnabled = examAttemptManaged;

  const {
    serverSegmentEndsAt,
    isHydrating: isHydratingExamAttempt,
    flushQuestionTiming,
  } = useExamAttemptLifecycle({
    enabled: examAttemptLifecycleEnabled,
    exam,
    state,
    setState,
    practice,
    practiceSessionId,
    attemptStateRef,
    suppressQuestionTimingSyncRef,
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
          ? `/progress/mocks/mock-attempts/${attemptIds.mockAttemptId}`
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
  const isTimed =
    currentSegmentTimeLimit != null && currentSegmentTimeLimit > 0;
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
      ? examAttemptManaged &&
        (!activeServerSegmentEndsAt || awaitingServerSegmentStartRef.current)
        ? getRemainingSeconds(exam, state, state.timerStartedAt, null)
        : remainingSeconds
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

    expiredMockNextSegmentRef.current =
      exam.sourceType === "mock"
        ? {
            segment: getNextMockSegment(exam, engineStateRef.current),
            startedAt: Date.now(),
          }
        : null;

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
    if (embeddedInLesson || tutorialMode) return;

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
        "Are you sure you want to leave this UCAT exam? Your progress is saved, and you can resume later.",
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
  }, [embeddedInLesson, tutorialMode]);

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
      void prefetchAttemptResults();
      router.push(href);
    },
    [
      managedExamAttempt,
      clearActiveExamAttempt,
      prefetchAttemptResults,
      router,
    ],
  );

  const completeExamAndMaybeRedirect = useCallback(async () => {
    setIsFinalizingExam(true);
    try {
      let completion: {
        earnedDiscount: boolean;
        discountCents: number;
        redirectHref: string | null;
      };
      if (practice && practiceSessionId && exam) {
        clientPracticeTimingRef.current =
          flushActiveClientPracticeQuestionTiming(
            clientPracticeTimingRef.current,
          );
        await flushQuestionTiming();
        const result = computeMarkingResult(
          exam.questions,
          state.selectedAnswers,
          state.syllogismSnapshots,
        );
        const response = await completePracticeSession.mutateAsync({
          sessionId: practiceSessionId,
          scorePoints: result.totalRawScore,
          totalPoints: result.maxRawScore,
          questionCount: exam.questions.length,
          stemsSnapshot: questionStemsForExam ?? questionStems ?? [],
          questionScores: result.rows.map((row) => ({
            questionId: row.question.id,
            score: row.points,
          })),
          answers: getFinalPracticeAnswers(),
        });
        completion = {
          earnedDiscount: response.earnedDiscount ?? false,
          discountCents: response.discountCents ?? 0,
          redirectHref: `/progress/practice-sessions/${practiceSessionId}`,
        };
      } else {
        completion = await handleExamCompleted();
      }
      const { earnedDiscount, discountCents, redirectHref } = completion;
      void queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
      if (redirectHref && practice && practiceSessionId) {
        onPracticeSessionCompleted?.(redirectHref);
      }
      if (examAttemptManaged) {
        clearActiveExamAttempt();
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
        void prefetchAttemptResults();
        if (!(practice && practiceSessionId && onPracticeSessionCompleted)) {
          router.replace(redirectHref);
        }
        return true;
      }
      return false;
    } catch (error) {
      setIsFinalizingExam(false);
      throw error;
    }
  }, [
    handleExamCompleted,
    practice,
    practiceSessionId,
    onPracticeSessionCompleted,
    exam,
    state.selectedAnswers,
    state.syllogismSnapshots,
    completePracticeSession,
    getFinalPracticeAnswers,
    questionStemsForExam,
    questionStems,
    flushQuestionTiming,
    examAttemptManaged,
    clearActiveExamAttempt,
    queryClient,
    prefetchAttemptResults,
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
        href = `/progress/mocks/mock-attempts/${attemptStateRef.current.mockAttemptId}`;
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
      : immediatePracticeReview
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
      practice && (exam?.questions?.length ?? 0) > 0
        ? computeMarkingResult(
            exam!.questions,
            state.selectedAnswers,
            state.syllogismSnapshots,
          )
        : null,
    [practice, exam, state.selectedAnswers, state.syllogismSnapshots],
  );
  const practiceCorrectCount =
    practiceMarkingResult?.rows.filter((r) => r.points > 0).length ?? 0;

  const handleFinishPractice = useCallback(async () => {
    if (isFinishingPractice) return;
    if (!practice || !exam) return;

    setIsFinishingPractice(true);
    const qs = exam.questions;
    try {
      await practiceUnitSavePromiseRef.current;
      clientPracticeTimingRef.current = flushActiveClientPracticeQuestionTiming(
        clientPracticeTimingRef.current,
      );

      if (state.phase === "question") {
        const { startIndex, endIndex } = getStemBoundaries(
          qs,
          state.currentIndex,
          mode as "questions" | "questionStem",
        );
        // Session completion writes every final answer in one server batch.
        // Non-session practice retains the normal stem submission path.
        if (!practiceSessionId) {
          await recordAnswersForUnit(startIndex, endIndex);
        }
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
        await flushQuestionTiming();
        const questionScores = practiceMarkingResult.rows.map((r) => ({
          questionId: r.question.id,
          score: r.points,
        }));
        const res = await completePracticeSession.mutateAsync({
          sessionId: practiceSessionId,
          scorePoints: practiceMarkingResult.totalRawScore,
          totalPoints: practiceMarkingResult.maxRawScore,
          questionCount: qs.length,
          stemsSnapshot: questionStemsForExam ?? questionStems ?? [],
          questionScores,
          answers: getFinalPracticeAnswers(),
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
          queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] }),
        ]);
      }

      if (practiceSessionId) {
        const attemptHref = `/progress/practice-sessions/${practiceSessionId}`;
        onPracticeSessionCompleted?.(attemptHref);
        clearActiveExamAttempt();
        skipBeforeUnloadRef.current = true;
        void prefetchAttemptResults();
        if (!onPracticeSessionCompleted) {
          router.replace(attemptHref);
        }
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
    practice,
    exam,
    state.phase,
    state.currentIndex,
    mode,
    recordAnswersForUnit,
    getFinalPracticeAnswers,
    learningModuleBlockId,
    disableQuestionAttemptLogging,
    onLearnProgress,
    practiceSessionId,
    onPracticeSessionCompleted,
    practiceMarkingResult,
    completePracticeSession,
    questionStems,
    questionStemsForExam,
    setState,
    toast,
    queryClient,
    prefetchAttemptResults,
    practiceTimingQueryKey,
    router,
    clearActiveExamAttempt,
    flushQuestionTiming,
  ]);

  useEffect(() => {
    if (
      practice &&
      reviewTiming === "atEnd" &&
      state.phase === "practiceComplete" &&
      !isFinishingPractice
    ) {
      void handleFinishPractice();
    }
  }, [
    handleFinishPractice,
    isFinishingPractice,
    practice,
    reviewTiming,
    state.phase,
  ]);

  const submitCurrentPracticeUnit = useCallback(
    (options?: { dismissTimeExpiredDialog?: boolean }) => {
      if (!exam || isSavingPracticeUnit) return;
      const { startIndex, endIndex } = getStemBoundaries(
        questions,
        state.currentIndex,
        mode as "questions" | "questionStem",
      );

      const practiceAnswerState: QuestionEngineState = {
        ...state,
        phase: "practiceAnswer",
        practiceAnswerUnitStartIndex: startIndex,
        practiceAnswerUnitEndIndex: endIndex,
        viewingQuestionIndex: startIndex,
        showNavigator: false,
        showTimeExpiredDialog: options?.dismissTimeExpiredDialog
          ? false
          : state.showTimeExpiredDialog,
      };

      // Reveal marking immediately. Persistence remains ordered in the
      // background, and navigation stays disabled until the durable writes
      // finish so a late timing snapshot cannot overwrite the next stem.
      suppressQuestionTimingSyncRef.current = true;
      setIsSavingPracticeUnit(true);
      clientPracticeTimingRef.current = flushActiveClientPracticeQuestionTiming(
        clientPracticeTimingRef.current,
      );
      setSubmittedPracticeQuestionIds((current) => {
        const next = new Set(current);
        for (let index = startIndex; index <= endIndex; index++) {
          const questionId = questions[index]?.id;
          if (questionId) next.add(questionId);
        }
        return next;
      });
      setState(practiceAnswerState);

      if (learningModuleBlockId && disableQuestionAttemptLogging) {
        onLearnProgress?.();
      }

      const savePromise = (async () => {
        try {
          // Keep this ordering: the timing flush updates the attempt row that
          // the answer batch creates when an autosave has not reached the
          // server yet.
          await recordAnswersForUnit(startIndex, endIndex);
          await flushQuestionTiming(practiceAnswerState);
          void Promise.all([
            refreshPracticeStemTimingFromServer(),
            queryClient.invalidateQueries({ queryKey: ["ucat-quota-usage"] }),
          ]).catch(() => {
            // Answer persistence is already durable. Timing/quota display can
            // reconcile on the next normal refresh.
          });
        } catch {
          void flushQuestionTiming(practiceAnswerState);
          toast({
            title: "Unable to save this stem",
            description:
              "Your answers are still shown here. You can continue reviewing them.",
            variant: "destructive",
          });
        } finally {
          suppressQuestionTimingSyncRef.current = false;
          setIsSavingPracticeUnit(false);
        }
      })();
      practiceUnitSavePromiseRef.current = savePromise;
      void savePromise.finally(() => {
        if (practiceUnitSavePromiseRef.current === savePromise) {
          practiceUnitSavePromiseRef.current = null;
        }
      });
    },
    [
      exam,
      isSavingPracticeUnit,
      questions,
      state,
      mode,
      learningModuleBlockId,
      disableQuestionAttemptLogging,
      onLearnProgress,
      setState,
      recordAnswersForUnit,
      flushQuestionTiming,
      refreshPracticeStemTimingFromServer,
      queryClient,
      toast,
    ],
  );

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
        showSubmitSetDialog ||
        isFinalizingExam ||
        isFinishingPractice;
      const isQuestionView =
        (state.phase === "question" ||
          (state.phase === "review" && state.reviewFilter)) &&
        currentQuestion &&
        !overlayActive;
      if (isQuestionView && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const answerKeys = ["a", "b", "c", "d", "e", "f"];
        const keyIndex = answerKeys.indexOf(key);
        if (keyIndex >= 0 && currentQuestion.options[keyIndex]) {
          if (tutorialQuestionLocked) {
            event.preventDefault();
            return;
          }
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

      if (isSavingPracticeUnit) {
        const viewing = state.viewingQuestionIndex ?? 0;
        const unitStart = state.practiceAnswerUnitStartIndex ?? 0;
        const unitEnd = state.practiceAnswerUnitEndIndex ?? 0;
        const canMoveWithinRenderedStem =
          state.phase === "practiceAnswer" &&
          ((shortcutKey === "alt+p" && viewing > unitStart) ||
            (shortcutKey === "alt+n" && viewing < unitEnd));
        if (!canMoveWithinRenderedStem) {
          event.preventDefault();
          return;
        }
      }

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
          if (!isReviewScreen && allowTutorialControl("calculator")) {
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
          if (!allowTutorialControl("flag")) break;
          void runWithLag(() => {
            toggleFlagCurrent();
          });
          break;
        case "previousQuestion":
          if (tutorialMode && tutorialHidePrevious) break;
          if (
            hasPreviousQuestion ||
            hasPreviousReviewQuestion ||
            hasPreviousPracticeAnswerQuestion
          ) {
            if (!allowTutorialControl("previous")) break;
            void runWithLag(() => {
              goPrevious();
            });
          }
          break;
        case "openNavigator": {
          // Only allow when navigator button is visible (question or intro phase)
          const showNavigatorButton =
            !practice &&
            (state.phase === "question" || state.phase === "intro");
          if (showNavigatorButton && allowTutorialControl("navigator")) {
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
          if (tutorialMode && tutorialHidePrimaryAction) break;
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
              if (
                viewing >= unitEnd &&
                viewing === questions.length - 1 &&
                !onNeedMoreStems
              ) {
                setShowConfirmFinishPracticeDialog(true);
              } else if (viewing >= unitEnd && confirmPracticeTransitions) {
                setShowConfirmNextStemDialog(true);
              } else {
                goNext();
              }
            } else if (
              practice &&
              reviewTiming === "atEnd" &&
              state.phase === "question" &&
              isLastQuestion &&
              !onNeedMoreStems
            ) {
              setShowConfirmFinishPracticeDialog(true);
            } else if (tutorialMode) {
              advanceTutorialQuestion();
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
    submitCurrentPracticeUnit,
    isPracticeMode,
    practice,
    reviewTiming,
    isLastQuestion,
    onNeedMoreStems,
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
    advanceTutorialQuestion,
    allowTutorialControl,
    tutorialHidePrevious,
    tutorialHidePrimaryAction,
    tutorialMode,
    tutorialQuestionLocked,
    isSavingPracticeUnit,
    isFinalizingExam,
    isFinishingPractice,
  ]);

  useEffect(() => {
    if (!onPracticeStatsChange) return;
    if (!practice || embeddedInLesson || !exam) {
      onPracticeStatsChange(null);
      return;
    }

    const submittedIds =
      reviewTiming === "atEnd"
        ? new Set([
            ...Object.keys(state.selectedAnswers),
            ...Object.keys(state.syllogismSnapshots ?? {}),
          ])
        : new Set([
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
    const persistedSecondsByQuestionId =
      practiceTimingQuery.data?.persistedSecondsByQuestionId ?? {};
    const totalAnsweredTimeSeconds = Array.from(submittedIds).reduce(
      (total, questionId) => {
        const clientSeconds = Math.floor(
          getClientPracticeQuestionElapsedMilliseconds(
            questionId,
            clientPracticeTimingRef.current,
          ) / 1000,
        );
        return (
          total +
          Math.max(
            0,
            persistedSecondsByQuestionId[questionId] ?? 0,
            clientSeconds,
          )
        );
      },
      0,
    );

    const timingPhase =
      state.phase === "practiceAnswer" ? "practiceAnswer" : "question";
    const stemBounds =
      timingPhase === "practiceAnswer" &&
      state.practiceAnswerUnitStartIndex != null &&
      state.practiceAnswerUnitEndIndex != null
        ? {
            startIndex: state.practiceAnswerUnitStartIndex,
            endIndex: state.practiceAnswerUnitEndIndex,
          }
        : getStemBoundaries(
            questions,
            effectiveCurrentIndex,
            mode as "questions" | "questionStem",
          );

    const nowMs = Date.now();
    const { stemTimeSeconds, stemQuestionTimes } =
      timingPhase === "practiceAnswer"
        ? computeReconciledStemQuestionTimes(
            questions,
            stemBounds.startIndex,
            stemBounds.endIndex,
            persistedSecondsByQuestionId,
            clientPracticeTimingRef.current,
            nowMs,
          )
        : computeClientStemQuestionTimes(
            questions,
            stemBounds.startIndex,
            stemBounds.endIndex,
            clientPracticeTimingRef.current,
            nowMs,
          );

    onPracticeStatsChange({
      answeredCount,
      correctCount,
      incorrectCount: Math.max(0, answeredCount - correctCount),
      revealAccuracy: reviewTiming === "afterEachStem",
      totalAnsweredTimeSeconds,
      currentQuestionNumber,
      totalQuestionLabel: onNeedMoreStems
        ? "Unlimited"
        : String(questions.length),
      timingPhase,
      stemTimeSeconds,
      stemQuestionTimes,
    });
  }, [
    onPracticeStatsChange,
    practice,
    reviewTiming,
    embeddedInLesson,
    exam,
    questions,
    state.visitedQuestionIds,
    state.selectedAnswers,
    state.syllogismSnapshots,
    state.phase,
    state.viewingQuestionIndex,
    state.practiceAnswerUnitStartIndex,
    state.practiceAnswerUnitEndIndex,
    effectiveCurrentIndex,
    mode,
    onNeedMoreStems,
    practiceTimingQuery.data,
    submittedPracticeQuestionIds,
    stemTimingTick,
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
        fillAvailableHeight={fillAvailableHeight}
      />
    );
  }

  if (launchGateKind && !launchGate.launchAllowed) {
    return (
      <ExamAttemptConflictDialog
        open={Boolean(launchGate.conflictActive)}
        active={launchGate.conflictActive}
        pendingLabel={mode === "mock" ? "this mock exam" : "this question set"}
        isDiscarding={launchGate.isDiscardingConflict}
        onDiscardAndContinue={() =>
          void launchGate.discardConflictAndContinue()
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
        fillAvailableHeight={fillAvailableHeight}
      />
    );
  }

  if (isHydratingExamAttempt) {
    return (
      <QuestionEngineLoadingSkeleton
        label="Resuming attempt"
        isPracticeMode={isPracticeMode}
        embeddedInLesson={embeddedInLesson}
        fillAvailableHeight={fillAvailableHeight}
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
  const practiceAnswerViewingIndex = state.viewingQuestionIndex ?? 0;
  const practiceAnswerUnitEndIndex =
    state.practiceAnswerUnitEndIndex ?? practiceAnswerViewingIndex;
  const isLeavingPracticeAnswerUnit =
    practiceAnswerViewingIndex >= practiceAnswerUnitEndIndex;
  const isSavingPracticeTransition =
    isSavingPracticeUnit && isLeavingPracticeAnswerUnit;
  const isPracticeCompletePhase = state.phase === "practiceComplete";
  const isLoadingMorePhase = state.phase === "loadingMore";
  const hasRetainedLoadingContent = immediatePracticeReview
    ? state.viewingQuestionIndex != null &&
      questions[state.viewingQuestionIndex] != null
    : currentQuestion != null;
  const isReviewScreen = isReviewPhase && !state.reviewFilter;
  const isReviewMode = isReviewPhase && state.reviewFilter;
  const questionLabel = (() => {
    if (
      onNeedMoreStems &&
      (state.phase === "question" ||
        state.phase === "practiceAnswer" ||
        state.phase === "loadingMore")
    ) {
      const index =
        state.phase !== "question" && state.viewingQuestionIndex != null
          ? state.viewingQuestionIndex
          : effectiveCurrentIndex;
      return `${Math.max(0, index) + 1} of Unlimited`;
    }
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
    showSubmitSetDialog ||
    isFinalizingExam ||
    isFinishingPractice;

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

    if (
      practice &&
      reviewTiming === "atEnd" &&
      (exam.sourceType === "questions" || exam.sourceType === "questionStem")
    ) {
      void runWithLag(async () => {
        const { startIndex, endIndex } = getStemBoundaries(
          questions,
          state.currentIndex,
          exam.sourceType as "questions" | "questionStem",
        );
        await recordAnswersForUnit(startIndex, endIndex);
        await flushQuestionTiming();
        const nextQuestionIndex = endIndex + 1;
        if (nextQuestionIndex >= questions.length && onNeedMoreStems) {
          const seenStemIds = [
            ...new Set(
              questions
                .map((question) => question.stemId)
                .filter((id): id is string => id != null),
            ),
          ];
          setState((current) => ({
            ...current,
            showTimeExpiredDialog: false,
            phase: "loadingMore",
            currentIndex: endIndex,
            loadingMoreTargetIndex: nextQuestionIndex,
            loadingMoreExcludeStemIds: seenStemIds,
          }));
          return;
        }
        if (nextQuestionIndex >= questions.length) {
          setState((current) => ({
            ...current,
            showTimeExpiredDialog: false,
          }));
          await handleFinishPractice();
          return;
        }
        setState((current) => ({
          ...current,
          showTimeExpiredDialog: false,
          phase: "question",
          currentIndex: Math.min(nextQuestionIndex, questions.length - 1),
          timerStartedAt:
            nextQuestionIndex < questions.length &&
            exam.timePerQuestionSeconds != null &&
            exam.timePerQuestionSeconds > 0
              ? Date.now()
              : current.timerStartedAt,
        }));
      });
      return;
    }

    // Practice mode (questions/questionStem): transition to answer view
    if (exam.sourceType === "questions" || exam.sourceType === "questionStem") {
      void runWithLag(() =>
        submitCurrentPracticeUnit({ dismissTimeExpiredDialog: true }),
      );
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
    const capturedNextSegment = expiredMockNextSegmentRef.current;
    const nextSeg =
      capturedNextSegment != null
        ? capturedNextSegment.segment
        : getNextMockSegment(exam, state);
    expiredMockNextSegmentRef.current = null;
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
        const next: typeof current = {
          ...current,
          showTimeExpiredDialog: false,
          nextSegmentTimerStartedAt: null,
        };

        let activeSeg = nextSeg;
        let segmentStartedAt =
          capturedNextSegment?.startedAt ??
          current.nextSegmentTimerStartedAt ??
          Date.now();

        while (activeSeg) {
          if (activeSeg.type === "instructions") {
            next.phase = "instructions";
            next.instructionsIndex = activeSeg.instructionsIndex;
          } else {
            next.phase = "question";
            next.currentIndex = activeSeg.questionStartIndex;
            next.mockCurrentSetIndex = activeSeg.setIndex;
          }

          const limit = activeSeg.timeLimitSeconds ?? 0;
          if (limit <= 0) {
            next.timerStartedAt = null;
            break;
          }

          const segmentEndsAt = segmentStartedAt + limit * 1000;
          if (segmentEndsAt > Date.now()) {
            next.timerStartedAt = segmentStartedAt;
            break;
          }

          const followingSeg = getNextMockSegment(exam, next);
          if (!followingSeg) {
            next.phase = "mockScore";
            next.timerStartedAt = null;
            break;
          }

          activeSeg = followingSeg;
          segmentStartedAt = segmentEndsAt;
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
        data-tour="question-engine-shell"
        className={cn(
          isPracticeMode
            ? practiceEngineShellClassName({
                embeddedInLesson,
                fillAvailableHeight,
              })
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
                  data-tour="question-engine-calculator"
                  className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
                  onClick={() => {
                    if (!allowTutorialControl("calculator")) return;
                    void runWithLag(() =>
                      setState((current) => ({
                        ...current,
                        showCalculator: !current.showCalculator,
                      })),
                    );
                  }}
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
                data-tour="question-engine-flag"
                className="inline-flex items-center gap-1 hover:text-[#fffd6f]"
                onClick={() => {
                  if (!allowTutorialControl("flag")) return;
                  void runWithLag(() => {
                    toggleFlagCurrent();
                  });
                }}
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
            ) : isResultsPhase ? null : isReviewScreen && tutorialMode ? (
              <UcatExamActionButton
                data-tour="question-engine-finish-tutorial"
                onClick={() => onTutorialComplete?.()}
                icon={<LogOut className="h-4 w-4" />}
              >
                <span className="text-[14pt]">{tutorialFinishLabel}</span>
              </UcatExamActionButton>
            ) : isReviewScreen ? (
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
            isLoadingMorePhase ? (
              <UcatExamActionButton
                disabled
                variant="highlight"
                icon={<Loader2 className="h-4 w-4 animate-spin" />}
              >
                <span className="text-[14pt]">Loading next stem…</span>
              </UcatExamActionButton>
            ) : isPracticeAnswerPhase ? (
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
                {(state.viewingQuestionIndex ?? 0) === questions.length - 1 &&
                !onNeedMoreStems ? (
                  <UcatExamActionButton
                    disabled={isSavingPracticeTransition}
                    data-tour="question-engine-finish-practice"
                    onClick={() =>
                      void runWithLag(() => {
                        setShowConfirmFinishPracticeDialog(true);
                      })
                    }
                    variant="highlight"
                    icon={
                      isSavingPracticeTransition ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )
                    }
                    iconRight
                  >
                    <span className="text-[14pt]">
                      {isSavingPracticeTransition ? "Saving..." : "Finish"}
                    </span>
                  </UcatExamActionButton>
                ) : (
                  <UcatExamActionButton
                    disabled={isSavingPracticeTransition}
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
                    icon={
                      isSavingPracticeTransition ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )
                    }
                    iconRight
                  >
                    <span className="text-[14pt]">
                      {isSavingPracticeTransition ? (
                        "Saving..."
                      ) : (state.viewingQuestionIndex ?? 0) >=
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
                )}
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
                  data-tour="question-engine-next"
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
                {hasPreviousQuestion &&
                !(tutorialMode && tutorialHidePrevious) ? (
                  <UcatExamActionButton
                    data-tour="question-engine-previous"
                    onClick={() => {
                      if (!allowTutorialControl("previous")) return;
                      void runWithLag(() => {
                        goPrevious();
                      });
                    }}
                    icon={<ArrowLeft className="h-4 w-4" />}
                  >
                    <span className="text-[14pt]">
                      <span className="underline">P</span>revious
                    </span>
                  </UcatExamActionButton>
                ) : null}
                {!practice ? (
                  <UcatExamActionButton
                    data-tour="question-engine-navigator"
                    onClick={() => {
                      if (!allowTutorialControl("navigator")) return;
                      void runWithLag(() =>
                        setState((current) => ({
                          ...current,
                          showNavigator: !current.showNavigator,
                        })),
                      );
                    }}
                    icon={<Navigation className="h-4 w-4" />}
                  >
                    <span className="text-[14pt]">
                      Na<span className="underline">v</span>igator
                    </span>
                  </UcatExamActionButton>
                ) : null}
                {tutorialMode && tutorialHidePrimaryAction ? null : (
                  <UcatExamActionButton
                    data-tour="question-engine-next"
                    onClick={() =>
                      void runWithLag(() => {
                        if (isPracticeMode && isLastQuestionOfCurrentUnit) {
                          if (confirmPracticeTransitions) {
                            setShowConfirmSubmitDialog(true);
                          } else {
                            submitCurrentPracticeUnit();
                          }
                        } else if (
                          practice &&
                          reviewTiming === "atEnd" &&
                          isLastQuestion &&
                          !onNeedMoreStems
                        ) {
                          setShowConfirmFinishPracticeDialog(true);
                        } else if (tutorialMode) {
                          advanceTutorialQuestion();
                        } else {
                          goNext();
                        }
                      })
                    }
                    variant="highlight"
                    icon={<ArrowRight className="h-4 w-4" />}
                    iconRight
                  >
                    {tutorialMode && tutorialPrimaryActionLabel ? (
                      <span className="text-[14pt]">
                        {tutorialPrimaryActionLabel}
                      </span>
                    ) : isPracticeMode && isLastQuestionOfCurrentUnit ? (
                      <span className="text-[14pt]">
                        <span className="underline">S</span>ubmit
                      </span>
                    ) : practice &&
                      reviewTiming === "atEnd" &&
                      isLastQuestion &&
                      !onNeedMoreStems ? (
                      <span className="text-[14pt]">Finish</span>
                    ) : isLastQuestion &&
                      !isPracticeMode &&
                      !onNeedMoreStems &&
                      !tutorialSequential ? (
                      <span className="text-[14pt]">Submit</span>
                    ) : (
                      <span className="text-[14pt]">
                        <span className="underline">N</span>ext
                      </span>
                    )}
                  </UcatExamActionButton>
                )}
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
          ) : isLoadingMorePhase && !hasRetainedLoadingContent ? (
            <QuestionEngineLoadingContentSkeleton />
          ) : isPracticeAnswerPhase ||
            isResultsPhase ||
            (isLoadingMorePhase && immediatePracticeReview) ? (
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
              readOnly={tutorialQuestionLocked}
              highlightText={tutorialHighlightText}
              syllogismDragOnly={tutorialMode && tutorialSyllogismDragOnly}
              syllogismLockedOptionIds={
                currentQuestion
                  ? tutorialLockedSyllogismOptionIds[currentQuestion.id]
                  : undefined
              }
              syllogismCorrectOptionIds={
                currentQuestion
                  ? tutorialCorrectSyllogismOptionIds[currentQuestion.id]
                  : undefined
              }
              onSyllogismClickAttempt={() => {
                allowTutorialControl("syllogismChoice");
              }}
              selectedOptionId={state.selectedAnswers[currentQuestion.id]}
              syllogismSnapshot={state.syllogismSnapshots?.[currentQuestion.id]}
              onChangeSyllogismSnapshot={(snapshot) => {
                if (tutorialQuestionLocked) return;
                setSyllogismSnapshot(currentQuestion.id, snapshot);
                recordSyllogismSnapshot(
                  currentQuestion.id,
                  snapshot,
                  flaggedCurrent,
                );
              }}
              onSelectOption={(optionId) => {
                if (tutorialQuestionLocked) return;
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
          tutorialMode={tutorialMode}
          draggableInTutorial={tutorialCalculatorDraggable}
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
