"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@altitutor/ui";
import { QuestionEnginePage } from "@/features/question-engine";
import type { PracticeEngineLiveStats } from "@/features/question-engine/components/question-engine-page";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import { UcatLagProvider } from "@/features/question-engine/context/ucat-lag-context";
import { SidebarExpandablePanel } from "@/features/layout/components/sidebar-expandable-panel";
import { useAppShellLayout } from "@/features/layout/context/app-shell-layout-context";
import type { PracticeSessionStartInput } from "@/features/practice/api/create-practice-session";
import { PracticeReducedStartDialog } from "@/features/practice/components/practice-reduced-start-dialog";
import {
  claimAndCreatePracticeSessionFromPending,
  getInFlightPendingPracticeCreate,
} from "@/features/practice/lib/claim-pending-practice-start";
import { evaluatePracticeQuotaPreflight } from "@/features/practice/lib/practice-quota-preflight";
import {
  clearPendingPracticeStart,
  clearPracticeSession,
  getPendingPracticeStart,
  getPracticeSession,
  setPracticeSession,
  type PracticeSessionData,
  type PracticeReviewTiming,
} from "@/features/practice/lib/session-storage";
import { finalizeExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { ExamAttemptConflictDialog } from "@/features/exam-attempts/components/exam-attempt-conflict-dialog";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { useQuestionEngineTutorialGate } from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import type { QuotaExceededPayload } from "@/features/ucat-access/types/quota";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { quotaRouteFallback } from "@/features/ucat-access/lib/quota-route-fallback";
import {
  assertOkOrQuotaExceeded,
  QuotaExceededError,
} from "@/lib/ucat/quota/parse-quota-error";
import { sectionLabels } from "@/features/set-generator/model/mock-data";
import {
  UCAT_CARD_CHROME,
  UCAT_PRIMARY_ACTION_BUTTON,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "@altitutor/ui";

/** Side-by-side from tablet when the nav is collapsed; stack when it takes horizontal space. */
function practiceSessionLayoutClass(
  mainContentHasSidebarInset: boolean,
): string {
  return cn(
    "grid min-h-0 gap-4",
    mainContentHasSidebarInset
      ? "xl:flex-1 xl:grid-cols-[minmax(0,1fr)_280px] xl:grid-rows-[minmax(0,1fr)] xl:items-start"
      : "md:flex-1 md:grid-cols-[minmax(0,1fr)_280px] md:grid-rows-[minmax(0,1fr)] md:items-start",
  );
}

/**
 * App shell main uses `pt-28 p-6` (7rem top + 1.5rem bottom).
 * Lock height only in the side-by-side breakpoint so the engine can fill remaining space.
 */
function practiceSessionViewportClass(
  mainContentHasSidebarInset: boolean,
): string {
  return cn(
    "flex min-h-0 flex-col gap-4",
    mainContentHasSidebarInset
      ? "xl:h-[calc(100dvh-8.5rem)]"
      : "md:h-[calc(100dvh-8.5rem)]",
  );
}

/**
 * Stacked: fixed QE height (title + shell padding).
 * Side-by-side: fill the grid cell under the session title.
 */
function practiceSessionEngineSlotClass(
  mainContentHasSidebarInset: boolean,
): string {
  return cn(
    "h-[calc(100dvh-12rem)] min-h-0 w-full overflow-hidden",
    mainContentHasSidebarInset ? "xl:h-full" : "md:h-full",
  );
}

async function fetchNextStem(
  practiceSessionId: string,
  input: SetGeneratorInput,
  excludeStemIds: string[],
  options?: { preview?: boolean; deliverStemId?: string },
): Promise<QuestionStemWithQuestions[] | null> {
  const response = await fetch("/api/ucat/practice-stems/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      excludeStemIds,
      practiceSessionId,
      preview: options?.preview,
      deliverStemId: options?.deliverStemId,
    }),
  });
  if (!response.ok) {
    await assertOkOrQuotaExceeded(response);
    return null;
  }
  const data = (await response.json()) as {
    stem: QuestionStemWithQuestions | null;
  };
  return data.stem ? [data.stem] : null;
}

function getPracticeCategoryList(
  input?: SetGeneratorInput,
  meta?: PracticeSessionData["filterMeta"],
): string {
  const count = input?.categoryIds?.length ?? 0;
  if (count === 0) return "";
  const labels = meta?.categoryLabels?.filter(Boolean) ?? [];
  if (labels.length > 0) return labels.join(", ");
  return `${count} selected`;
}

function formatSecondsPerQuestion(seconds: number): string {
  return Number.isInteger(seconds)
    ? `${seconds} sec`
    : `${seconds.toFixed(1)} sec`;
}

function formatPracticeDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function buildPracticeSessionTitle({
  stats,
  filters,
  filterMeta,
}: {
  stats: PracticeEngineLiveStats | null;
  filters?: SetGeneratorInput;
  filterMeta?: PracticeSessionData["filterMeta"];
}) {
  const timePerQuestionSeconds = filters?.timePerQuestionSeconds ?? null;
  const isTimed = timePerQuestionSeconds != null && timePerQuestionSeconds > 0;
  const sectionLabel =
    filterMeta?.sectionLabel ??
    (filters?.section ? sectionLabels[filters.section] : "Practice");
  const categoryList = getPracticeCategoryList(filters, filterMeta);
  const categoryPhrase = categoryList ? ` (${categoryList})` : "";
  const progress = stats
    ? `question ${stats.currentQuestionNumber} / ${stats.totalQuestionLabel}`
    : "question — / —";

  let timingPhrase = "";
  if (isTimed) {
    const examSeconds = filterMeta?.examTimePerQuestionSeconds;
    const speedPercent =
      examSeconds != null && examSeconds > 0
        ? Math.round((examSeconds / timePerQuestionSeconds) * 100)
        : null;
    timingPhrase = ` @ ${formatSecondsPerQuestion(timePerQuestionSeconds)} per question${
      speedPercent != null ? ` (${speedPercent}% of exam speed)` : ""
    }`;
  }

  return `${isTimed ? "Timed" : "Untimed"} ${sectionLabel}${categoryPhrase} practice${timingPhrase}: ${progress}`;
}

function InlineStatRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right text-sm font-semibold tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function PracticeStemTimingSection({
  stats,
}: {
  stats: PracticeEngineLiveStats | null;
}) {
  const timingPhase = stats?.timingPhase ?? "question";
  const stemTimeSeconds = stats?.stemTimeSeconds ?? 0;
  const stemQuestionTimes = stats?.stemQuestionTimes ?? [];
  const showBreakdown =
    timingPhase === "practiceAnswer" && stemQuestionTimes.length > 1;
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const prevTimingPhaseRef = useRef(timingPhase);

  useEffect(() => {
    if (
      timingPhase === "practiceAnswer" &&
      prevTimingPhaseRef.current === "question" &&
      stemQuestionTimes.length > 1
    ) {
      setBreakdownExpanded(true);
    }
    if (timingPhase === "question") {
      setBreakdownExpanded(false);
    }
    prevTimingPhaseRef.current = timingPhase;
  }, [timingPhase, stemQuestionTimes.length]);

  const label =
    timingPhase === "practiceAnswer" ? "Stem time" : "Current stem time";

  if (!showBreakdown) {
    return (
      <InlineStatRow
        label={label}
        value={formatPracticeDuration(stemTimeSeconds)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <InlineStatRow
        label={label}
        value={formatPracticeDuration(stemTimeSeconds)}
      />
      <SidebarExpandablePanel expanded={breakdownExpanded}>
        <dl className="space-y-1.5 border-l border-border pl-2">
          {stemQuestionTimes.map((row) => (
            <div
              key={row.questionId}
              className="flex items-baseline justify-between gap-3"
            >
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-xs font-semibold tabular-nums">
                {formatPracticeDuration(row.seconds)}
              </dd>
            </div>
          ))}
        </dl>
      </SidebarExpandablePanel>
    </div>
  );
}

function PracticeSessionStatsCards({
  stats,
  elapsedSeconds,
  onFinishPractice,
}: {
  stats: PracticeEngineLiveStats | null;
  elapsedSeconds: number;
  onFinishPractice?: () => void;
}) {
  const answeredCount = stats?.answeredCount ?? 0;
  const correctCount = stats?.correctCount ?? 0;
  const incorrectCount = stats?.incorrectCount ?? 0;
  const answeredTimeSeconds = stats?.totalAnsweredTimeSeconds ?? 0;
  const averageSeconds =
    answeredCount > 0 ? answeredTimeSeconds / answeredCount : null;

  return (
    <aside className="space-y-3">
      <Card className={cn(UCAT_CARD_CHROME, "min-w-0")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Answers</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="space-y-2">
            <InlineStatRow label="Answered" value={String(answeredCount)} />
            {stats?.revealAccuracy !== false ? (
              <>
                <InlineStatRow
                  label="Correct"
                  value={String(correctCount)}
                  valueClassName="text-emerald-600 dark:text-emerald-400"
                />
                <InlineStatRow
                  label="Incorrect"
                  value={String(incorrectCount)}
                  valueClassName="text-red-600 dark:text-red-400"
                />
              </>
            ) : null}
          </dl>
        </CardContent>
      </Card>
      <Card className={cn(UCAT_CARD_CHROME, "min-w-0")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Timing</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="space-y-2 text-sm">
            <InlineStatRow
              label="Session time"
              value={formatPracticeDuration(elapsedSeconds)}
            />
            <PracticeStemTimingSection stats={stats} />
            <InlineStatRow
              label="Average time / question"
              value={
                averageSeconds != null
                  ? formatPracticeDuration(averageSeconds)
                  : "—"
              }
            />
          </dl>
        </CardContent>
      </Card>
      {onFinishPractice ? (
        <Card className={cn(UCAT_CARD_CHROME, "min-w-0")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              type="button"
              className={cn(UCAT_PRIMARY_ACTION_BUTTON, "w-full")}
              onClick={onFinishPractice}
            >
              Finish practice
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </aside>
  );
}

export function PracticeSessionPage() {
  const router = useRouter();
  const { mainContentHasSidebarInset } = useAppShellLayout();
  const { data: quota, isLoading: quotaLoading } = useQuotaUsage();
  const {
    active: activeExamAttempt,
    isLoading: activeAttemptLoading,
    refresh: refreshActiveAttempt,
  } = useActiveExamAttempt();
  const { isReady: questionEngineTourReady } = useQuestionEngineTutorialGate();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const [session, setSession] = useState<
    PracticeSessionData | null | "loading"
  >("loading");
  const [liveStats, setLiveStats] = useState<PracticeEngineLiveStats | null>(
    null,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const openFinishPracticeDialogRef = useRef<(() => void) | null>(null);
  const pendingGateHandledRef = useRef(false);
  const [conflictActive, setConflictActive] =
    useState<ActiveExamAttempt | null>(null);
  const [isFinalizingConflict, setIsFinalizingConflict] = useState(false);
  const [pendingConflictStart, setPendingConflictStart] =
    useState<PracticeSessionStartInput | null>(null);
  const [reducedStart, setReducedStart] = useState<{
    input: PracticeSessionStartInput;
    requestedCount: number;
    remainingCount: number;
  } | null>(null);
  const [isCreatingFromPending, setIsCreatingFromPending] = useState(false);
  const sessionLayoutClass = practiceSessionLayoutClass(
    mainContentHasSidebarInset,
  );
  const sessionViewportClass = practiceSessionViewportClass(
    mainContentHasSidebarInset,
  );
  const engineSlotClass = practiceSessionEngineSlotClass(
    mainContentHasSidebarInset,
  );

  const handleRegisterFinishPracticeDialog = useCallback((open: () => void) => {
    openFinishPracticeDialogRef.current = open;
  }, []);

  const handleFinishPracticeFromSidebar = useCallback(() => {
    openFinishPracticeDialogRef.current?.();
  }, []);

  const abandonPendingStart = useCallback(() => {
    clearPendingPracticeStart();
    pendingGateHandledRef.current = true;
    setConflictActive(null);
    setPendingConflictStart(null);
    setReducedStart(null);
    setSession(null);
    router.replace("/practice");
  }, [router]);

  const createFromPending = useCallback(
    async (input?: PracticeSessionStartInput) => {
      setIsCreatingFromPending(true);
      setReducedStart(null);
      setConflictActive(null);
      setPendingConflictStart(null);
      try {
        const promise =
          claimAndCreatePracticeSessionFromPending(input) ??
          getInFlightPendingPracticeCreate();
        if (!promise) {
          router.replace("/practice");
          return;
        }
        const data = await promise;
        setSession(data);
      } catch (error) {
        clearPendingPracticeStart();
        if (error instanceof QuotaExceededError) {
          openQuotaLimit(error.payload, {
            dismissAction: quotaRouteFallback("practice"),
          });
        }
        setSession(null);
        router.replace("/practice");
      } finally {
        setIsCreatingFromPending(false);
      }
    },
    [openQuotaLimit, router],
  );

  useEffect(() => {
    // Wait for the tutorial gate so we never begin a practice attempt that
    // will immediately be redirected away.
    if (!questionEngineTourReady) return;

    let cancelled = false;
    const localSession = getPracticeSession();
    if (localSession) {
      setSession(localSession);
      return () => {
        cancelled = true;
      };
    }

    const inFlight = getInFlightPendingPracticeCreate();
    if (inFlight) {
      void inFlight
        .then((data) => {
          if (!cancelled) setSession(data);
        })
        .catch(() => {
          if (!cancelled) {
            setSession(null);
            router.replace("/practice");
          }
        });
      return () => {
        cancelled = true;
      };
    }

    if (activeAttemptLoading) return;

    const pending = getPendingPracticeStart();
    if (pending) {
      if (pendingGateHandledRef.current) return;

      if (activeExamAttempt) {
        pendingGateHandledRef.current = true;
        setPendingConflictStart(pending);
        setConflictActive(activeExamAttempt);
        return;
      }

      if (quotaLoading) return;

      const preflight = evaluatePracticeQuotaPreflight(quota, pending);
      switch (preflight.status) {
        case "atLimit":
          pendingGateHandledRef.current = true;
          clearPendingPracticeStart();
          openQuotaLimit(
            {
              code: "QUOTA_EXCEEDED",
              area: "practice",
              used: preflight.used,
              limit: preflight.limit,
              period: preflight.period,
            },
            { dismissAction: quotaRouteFallback("practice") },
          );
          setSession(null);
          router.replace("/practice");
          return;
        case "reduce":
          pendingGateHandledRef.current = true;
          setReducedStart({
            input: {
              ...pending,
              payload: preflight.payload,
            },
            requestedCount: preflight.requestedCount,
            remainingCount: preflight.remainingCount,
          });
          return;
        case "ok":
          pendingGateHandledRef.current = true;
          void createFromPending(pending);
          return;
        default: {
          const _exhaustive: never = preflight;
          return _exhaustive;
        }
      }
    }

    void (async () => {
      let data: PracticeSessionData | null = null;
      if (
        activeExamAttempt?.kind === "practice" &&
        activeExamAttempt.practiceSessionId
      ) {
        const stemsRes = await fetch(
          `/api/ucat/practice-sessions/${activeExamAttempt.practiceSessionId}`,
        );
        if (stemsRes.ok) {
          const detail = (await stemsRes.json()) as {
            stemsSnapshot?: QuestionStemWithQuestions[];
            filtersSnapshot?: SetGeneratorInput & {
              reviewTiming?: PracticeReviewTiming;
            };
            unlimited?: boolean;
          };
          if (detail.unlimited && detail.filtersSnapshot) {
            data = {
              mode: "unlimited",
              sessionId: activeExamAttempt.practiceSessionId,
              filters: detail.filtersSnapshot,
              stems: detail.stemsSnapshot ?? [],
              timePerQuestionSeconds:
                detail.filtersSnapshot.timePerQuestionSeconds ?? null,
              startedAtMs: Date.now(),
              reviewTiming:
                detail.filtersSnapshot.reviewTiming ?? "afterEachStem",
            };
          } else if (detail.stemsSnapshot?.length) {
            data = {
              mode: "set",
              sessionId: activeExamAttempt.practiceSessionId,
              stems: detail.stemsSnapshot,
              filters: detail.filtersSnapshot,
              timePerQuestionSeconds:
                detail.filtersSnapshot?.timePerQuestionSeconds ?? null,
              startedAtMs: Date.now(),
              reviewTiming:
                detail.filtersSnapshot?.reviewTiming ?? "afterEachStem",
            };
          }
          if (data) setPracticeSession(data);
        }
      }
      if (cancelled) return;
      if (!data) {
        if (quotaLoading) return;
        const practiceQuota = quota?.areas.find(
          (area) => area.area === "practice",
        );
        if (
          quota?.onlineTier === "free" &&
          !quota.isQuotaExempt &&
          practiceQuota &&
          (practiceQuota.disabled || practiceQuota.atLimit)
        ) {
          clearPracticeSession();
          openQuotaLimit(
            {
              code: "QUOTA_EXCEEDED",
              area: "practice",
              used: practiceQuota.used,
              limit: practiceQuota.limit,
              period: practiceQuota.period,
            },
            { dismissAction: quotaRouteFallback("practice") },
          );
          setSession(null);
          return;
        }
        router.replace("/practice");
        return;
      }
      if (data.mode === "set" && (!data.stems || data.stems.length === 0)) {
        router.replace("/practice");
        return;
      }
      setSession(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeAttemptLoading,
    activeExamAttempt,
    createFromPending,
    openQuotaLimit,
    questionEngineTourReady,
    quota,
    quotaLoading,
    router,
  ]);

  async function handleFinalizeConflictAndStart() {
    if (!conflictActive || !pendingConflictStart) return;
    setIsFinalizingConflict(true);
    try {
      await finalizeExamAttempt({
        kind: conflictActive.kind,
        attemptId: conflictActive.attemptId,
      });
      if (conflictActive.kind === "practice") {
        clearPracticeSession();
      }
      await refreshActiveAttempt();
      const startInput = pendingConflictStart;
      setConflictActive(null);
      setPendingConflictStart(null);

      const preflight = evaluatePracticeQuotaPreflight(quota, startInput);
      switch (preflight.status) {
        case "atLimit":
          clearPendingPracticeStart();
          openQuotaLimit(
            {
              code: "QUOTA_EXCEEDED",
              area: "practice",
              used: preflight.used,
              limit: preflight.limit,
              period: preflight.period,
            },
            { dismissAction: quotaRouteFallback("practice") },
          );
          setSession(null);
          router.replace("/practice");
          return;
        case "reduce":
          setReducedStart({
            input: {
              ...startInput,
              payload: preflight.payload,
            },
            requestedCount: preflight.requestedCount,
            remainingCount: preflight.remainingCount,
          });
          return;
        case "ok":
          await createFromPending(startInput);
          return;
        default: {
          const _exhaustive: never = preflight;
          return _exhaustive;
        }
      }
    } finally {
      setIsFinalizingConflict(false);
    }
  }

  const handleDone = useCallback(() => {
    clearPracticeSession();
    router.replace("/practice");
  }, [router]);

  useEffect(() => {
    if (session === "loading" || !session) return;

    const startedAt = session.startedAtMs ?? Date.now();
    const updateElapsed = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      );
    };
    updateElapsed();
    const id = setInterval(updateElapsed, 1000);
    return () => clearInterval(id);
  }, [session]);

  if (session === "loading" || conflictActive != null || reducedStart != null) {
    return (
      <>
        <div
          className="space-y-4 p-6"
          aria-busy="true"
          aria-label="Loading practice session"
        >
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-[28rem] w-full rounded-xl" />
        </div>
        <ExamAttemptConflictDialog
          open={conflictActive != null}
          active={conflictActive}
          pendingLabel="new practice session"
          isFinalizing={isFinalizingConflict}
          onFinalizeAndContinue={() => void handleFinalizeConflictAndStart()}
          onCancel={abandonPendingStart}
        />
        <PracticeReducedStartDialog
          open={reducedStart != null}
          requestedCount={reducedStart?.requestedCount ?? 0}
          remainingCount={reducedStart?.remainingCount ?? 0}
          isPending={isCreatingFromPending}
          onCancel={abandonPendingStart}
          onConfirm={() => {
            if (!reducedStart) return;
            void createFromPending(reducedStart.input);
          }}
        />
      </>
    );
  }

  if (!session) {
    return null;
  }

  const sessionTitle = buildPracticeSessionTitle({
    stats: liveStats,
    filters: session.filters,
    filterMeta: session.filterMeta,
  });

  if (session.mode === "unlimited") {
    return (
      <UcatLagProvider>
        <div className={sessionViewportClass}>
          <h1 className="shrink-0 text-lg font-semibold tracking-normal text-foreground">
            {sessionTitle}
          </h1>
          <div className={sessionLayoutClass}>
            <div className={engineSlotClass}>
              <UnlimitedPracticeEngine
                sessionId={session.sessionId}
                filters={session.filters}
                initialStems={session.stems ?? []}
                sessionMeta={session}
                timePerQuestionSeconds={session.timePerQuestionSeconds}
                reviewTiming={session.reviewTiming ?? "afterEachStem"}
                onBack={handleDone}
                onPracticeStatsChange={setLiveStats}
                onRegisterFinishPracticeDialog={
                  handleRegisterFinishPracticeDialog
                }
              />
            </div>
            <PracticeSessionStatsCards
              stats={liveStats}
              elapsedSeconds={elapsedSeconds}
              onFinishPractice={handleFinishPracticeFromSidebar}
            />
          </div>
        </div>
      </UcatLagProvider>
    );
  }

  return (
    <UcatLagProvider>
      <div className={sessionViewportClass}>
        <h1 className="shrink-0 text-lg font-semibold tracking-normal text-foreground">
          {sessionTitle}
        </h1>
        <div className={sessionLayoutClass}>
          <div className={engineSlotClass}>
            <QuestionEnginePage
              mode="questionStem"
              sourceId="practice"
              questionStems={session.stems}
              practice
              fillAvailableHeight
              practiceSessionId={session.sessionId}
              reviewTiming={session.reviewTiming ?? "afterEachStem"}
              onPracticeStatsChange={setLiveStats}
              timePerQuestionSeconds={session.timePerQuestionSeconds}
              backHref="/practice"
              onBack={handleDone}
              onRegisterFinishPracticeDialog={
                handleRegisterFinishPracticeDialog
              }
            />
          </div>
          <PracticeSessionStatsCards
            stats={liveStats}
            elapsedSeconds={elapsedSeconds}
            onFinishPractice={handleFinishPracticeFromSidebar}
          />
        </div>
      </div>
    </UcatLagProvider>
  );
}

function UnlimitedPracticeEngine({
  sessionId,
  filters,
  initialStems,
  sessionMeta,
  timePerQuestionSeconds,
  reviewTiming,
  onBack,
  onPracticeStatsChange,
  onRegisterFinishPracticeDialog,
}: {
  sessionId: string;
  filters: SetGeneratorInput;
  initialStems: QuestionStemWithQuestions[];
  sessionMeta: Extract<PracticeSessionData, { mode: "unlimited" }>;
  timePerQuestionSeconds: number | null;
  reviewTiming: PracticeReviewTiming;
  onBack: () => void;
  onPracticeStatsChange: (stats: PracticeEngineLiveStats | null) => void;
  onRegisterFinishPracticeDialog?: (open: () => void) => void;
}) {
  const [stems, setStems] = useState<QuestionStemWithQuestions[]>(initialStems);
  const [prefetchedStem, setPrefetchedStem] =
    useState<QuestionStemWithQuestions | null>(null);
  const prefetchingRef = useRef(false);
  const [loading, setLoading] = useState(initialStems.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [quotaReached, setQuotaReached] = useState<QuotaExceededPayload | null>(
    null,
  );
  const { openQuotaLimit } = useQuotaLimitDialog();
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (
      loading ||
      error ||
      quotaReached ||
      prefetchedStem ||
      prefetchingRef.current
    ) {
      return;
    }
    if (stems.length === 0) return;
    let cancelled = false;
    prefetchingRef.current = true;
    void fetchNextStem(
      sessionId,
      filtersRef.current,
      stems.map((stem) => stem.id),
      { preview: true },
    )
      .then((next) => {
        if (!cancelled) setPrefetchedStem(next?.[0] ?? null);
      })
      .catch(() => {
        // Lookahead is opportunistic. Surface errors only when the student
        // actually advances and delivery is attempted.
      })
      .finally(() => {
        prefetchingRef.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [error, loading, prefetchedStem, quotaReached, sessionId, stems]);

  useEffect(() => {
    if (initialStems.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchNextStem(sessionId, filtersRef.current, []);
        if (cancelled) return;
        if (next?.length) {
          setStems(next);
          setPracticeSession({ ...sessionMeta, stems: next });
        } else {
          setError("No question stems match these filters.");
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof QuotaExceededError) {
          openQuotaLimit(error.payload, {
            dismissAction: quotaRouteFallback("practice"),
          });
          clearPracticeSession();
          setError("Practice limit reached.");
        } else {
          setError("No question stems match these filters.");
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialStems.length, openQuotaLimit, sessionId, sessionMeta]);

  const handleNeedMoreStems = useCallback(
    async (excludeStemIds: string[]) => {
      try {
        const next = prefetchedStem
          ? await fetchNextStem(
              sessionId,
              filtersRef.current,
              excludeStemIds,
              { deliverStemId: prefetchedStem.id },
            )
          : await fetchNextStem(
              sessionId,
              filtersRef.current,
              excludeStemIds,
            );
        if (next?.length) {
          setPrefetchedStem(null);
          setStems((prev) => {
            const updated = [...prev, ...next];
            setPracticeSession({ ...sessionMeta, stems: updated });
            return updated;
          });
          return { status: "loaded" as const, stems: next };
        }
        return { status: "exhausted" as const };
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          if (reviewTiming === "afterEachStem") {
            setQuotaReached(error.payload);
          }
          return { status: "quotaReached" as const };
        } else {
          setError("No question stems match these filters.");
          return { status: "error" as const };
        }
      }
    },
    [prefetchedStem, reviewTiming, sessionId, sessionMeta],
  );

  if (loading) {
    return (
      <div
        className="flex h-full min-h-0 flex-col space-y-4 p-6"
        aria-busy="true"
        aria-label="Loading questions"
      >
        <Skeleton className="h-6 w-40" />
        <Skeleton className="min-h-0 flex-1 w-full rounded-xl" />
      </div>
    );
  }

  if (error || stems.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground">
          {error ?? "No questions available."}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-sidebar px-4 py-2 text-sm font-medium text-sidebar-foreground"
        >
          Back to practice
        </button>
      </div>
    );
  }

  return (
    <QuestionEnginePage
      mode="questionStem"
      sourceId="practice"
      questionStems={stems}
      practice
      fillAvailableHeight
      practiceSessionId={sessionId}
      reviewTiming={reviewTiming}
      onPracticeStatsChange={onPracticeStatsChange}
      timePerQuestionSeconds={timePerQuestionSeconds}
      backHref="/practice"
      onBack={onBack}
      onNeedMoreStems={handleNeedMoreStems}
      practiceQuotaReached={quotaReached}
      onRegisterFinishPracticeDialog={onRegisterFinishPracticeDialog}
    />
  );
}
