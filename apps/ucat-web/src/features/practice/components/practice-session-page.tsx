"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@altitutor/ui";
import { QuestionEnginePage } from "@/features/question-engine";
import { useUcatInterfacePreferences } from "@/features/interface-preferences/hooks/use-ucat-interface-preferences";
import type { PracticeEngineLiveStats } from "@/features/question-engine/components/question-engine-page";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import { useExamExperience } from "@/features/exam-experience/context/exam-experience-context";
import { SidebarExpandablePanel } from "@/features/layout/components/sidebar-expandable-panel";
import type { PracticeSessionStartInput } from "@/features/practice/api/create-practice-session";
import { PracticeReducedStartDialog } from "@/features/practice/components/practice-reduced-start-dialog";
import {
  fetchDeliveredPracticeStem,
  fetchNextPracticeStem,
} from "@/features/practice/api/fetch-next-practice-stem";
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
import { discardExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { ExamAttemptConflictDialog } from "@/features/exam-attempts/components/exam-attempt-conflict-dialog";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { useQuestionEngineTutorialGate } from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import { formatSpeedPercentAsMultiplier } from "@/features/progress/lib/format-speed-multiplier";
import type { QuotaExceededPayload } from "@/features/ucat-access/types/quota";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { quotaRouteFallback } from "@/features/ucat-access/lib/quota-route-fallback";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";
import { sectionLabels } from "@/features/practice/model/sections";
import { useStudyPlanCompanion } from "@/features/study-plan/context/study-plan-companion-context";
import {
  UCAT_CARD_CHROME,
  UCAT_PRIMARY_ACTION_BUTTON,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { calculatePracticeSessionTimeLimitSeconds } from "@/features/practice/model/practice-timing-policy";

function getPracticeCategoryList(
  input?: PracticeSelectionInput,
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
  filters,
  filterMeta,
}: {
  filters?: PracticeSelectionInput;
  filterMeta?: PracticeSessionData["filterMeta"];
}) {
  const timePerQuestionSeconds = filters?.timePerQuestionSeconds ?? null;
  const isTimed = timePerQuestionSeconds != null && timePerQuestionSeconds > 0;
  const sectionLabel =
    filterMeta?.sectionLabel ??
    (filters?.section ? sectionLabels[filters.section] : "Practice");
  const categoryList = getPracticeCategoryList(filters, filterMeta);
  const categoryPhrase = categoryList ? ` (${categoryList})` : "";
  let timingPhrase = "";
  if (isTimed) {
    const examSeconds = filterMeta?.examTimePerQuestionSeconds;
    const speedPercent =
      examSeconds != null && examSeconds > 0
        ? Math.round((examSeconds / timePerQuestionSeconds) * 100)
        : null;
    timingPhrase = ` @ ${formatSecondsPerQuestion(timePerQuestionSeconds)} per question${
      speedPercent != null
        ? ` (${formatSpeedPercentAsMultiplier(speedPercent)} exam speed)`
        : ""
    }`;
  }

  return `${isTimed ? "Timed" : "Untimed"} ${sectionLabel}${categoryPhrase} practice${timingPhrase}`;
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

export function PracticeSessionStatsCards({
  stats,
  elapsedSeconds,
  showAnswerStats = true,
  onFinishPractice,
}: {
  stats: PracticeEngineLiveStats | null;
  elapsedSeconds: number;
  showAnswerStats?: boolean;
  onFinishPractice?: () => void;
}) {
  const answeredCount = stats?.answeredCount ?? 0;
  const correctCount = stats?.correctCount ?? 0;
  const incorrectCount = stats?.incorrectCount ?? 0;

  return (
    <div className="space-y-3">
      {showAnswerStats ? (
        <Card className={cn(UCAT_CARD_CHROME, "min-w-0")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Answers</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="space-y-2">
              <InlineStatRow label="Answered" value={String(answeredCount)} />
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
            </dl>
          </CardContent>
        </Card>
      ) : null}
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
    </div>
  );
}

export function PracticeSessionPage() {
  const router = useRouter();
  const { setTitle, setPractice } = useExamExperience();
  const { preferences } = useUcatInterfacePreferences();
  const { data: quota, isLoading: quotaLoading } = useQuotaUsage();
  const {
    active: activeExamAttempt,
    isLoading: activeAttemptLoading,
    refresh: refreshActiveAttempt,
    clearLocal: clearActiveAttempt,
  } = useActiveExamAttempt();
  const { isReady: questionEngineTourReady } = useQuestionEngineTutorialGate();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { clearLivePractice, reportLivePractice } = useStudyPlanCompanion();
  const [session, setSession] = useState<
    PracticeSessionData | null | "loading"
  >("loading");
  const [liveStats, setLiveStats] = useState<PracticeEngineLiveStats | null>(
    null,
  );
  const openFinishPracticeDialogRef = useRef<(() => void) | null>(null);
  const completionNavigationRef = useRef(false);
  const pendingGateHandledRef = useRef(false);
  const [conflictActive, setConflictActive] =
    useState<ActiveExamAttempt | null>(null);
  const [isDiscardingConflict, setIsDiscardingConflict] = useState(false);
  const [pendingConflictStart, setPendingConflictStart] =
    useState<PracticeSessionStartInput | null>(null);
  const [reducedStart, setReducedStart] = useState<{
    input: PracticeSessionStartInput;
    requestedCount: number;
    remainingCount: number;
  } | null>(null);
  const [isCreatingFromPending, setIsCreatingFromPending] = useState(false);

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
    if (completionNavigationRef.current) return;

    let cancelled = false;
    const isObsolete = () => cancelled || completionNavigationRef.current;
    const localSession = getPracticeSession();
    if (localSession) {
      if (localSession.mode !== "unlimited") {
        setSession(localSession);
        return () => {
          cancelled = true;
        };
      }
      // Session storage is only a launch cache. Reconcile it with the
      // server-owned delivery snapshot for unlimited sessions before mounting
      // the engine, where concurrent next-stem requests can otherwise leave a
      // racing tab with a question the session did not commit.
      void fetch(`/api/ucat/practice-sessions/${localSession.sessionId}`)
        .then(async (response) => {
          if (!response.ok) return localSession;
          const detail = (await response.json()) as {
            stemsSnapshot?: QuestionStemWithQuestions[];
            completedAt?: string | null;
          };
          if (detail.completedAt) return null;
          const reconciled = {
            ...localSession,
            stems: detail.stemsSnapshot ?? [],
          } as PracticeSessionData;
          if (isObsolete()) return null;
          setPracticeSession(reconciled);
          return reconciled;
        })
        .catch(() => localSession)
        .then((reconciled) => {
          if (isObsolete()) return;
          if (!reconciled) {
            clearPracticeSession();
            setSession(null);
            router.replace("/practice");
            return;
          }
          setSession(reconciled);
        });
      return () => {
        cancelled = true;
      };
    }

    const inFlight = getInFlightPendingPracticeCreate();
    if (inFlight) {
      void inFlight
        .then((data) => {
          if (!isObsolete()) setSession(data);
        })
        .catch(() => {
          if (!isObsolete()) {
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
            filtersSnapshot?: PracticeSelectionInput & {
              reviewTiming?: PracticeReviewTiming;
            };
            unlimited?: boolean;
            startedAt?: string;
          };
          if (isObsolete()) return;
          if (detail.unlimited && detail.filtersSnapshot) {
            data = {
              mode: "unlimited",
              sessionId: activeExamAttempt.practiceSessionId,
              filters: detail.filtersSnapshot,
              stems: detail.stemsSnapshot ?? [],
              timePerQuestionSeconds:
                detail.filtersSnapshot.timePerQuestionSeconds ?? null,
              startedAtMs: detail.startedAt
                ? Date.parse(detail.startedAt)
                : Date.now(),
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
              startedAtMs: detail.startedAt
                ? Date.parse(detail.startedAt)
                : Date.now(),
              reviewTiming:
                detail.filtersSnapshot?.reviewTiming ?? "afterEachStem",
            };
          }
          if (data) setPracticeSession(data);
        }
      }
      if (isObsolete()) return;
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

  async function handleDiscardConflictAndStart() {
    if (!conflictActive || !pendingConflictStart) return;
    setIsDiscardingConflict(true);
    try {
      await discardExamAttempt({
        kind: conflictActive.kind,
        attemptId: conflictActive.attemptId,
      });
      if (conflictActive.kind === "practice") {
        clearPracticeSession();
      }
      clearActiveAttempt();
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
      setIsDiscardingConflict(false);
    }
  }

  const handlePracticeSessionCompleted = useCallback(
    (attemptHref: string) => {
      completionNavigationRef.current = true;
      clearPracticeSession();
      setSession(null);
      router.replace(attemptHref);
    },
    [router],
  );

  const activeSessionId =
    session === "loading" || !session ? null : session.sessionId;
  useEffect(() => {
    if (!activeSessionId) return;
    return () => clearLivePractice(activeSessionId);
  }, [activeSessionId, clearLivePractice]);

  useEffect(() => {
    if (session === "loading" || !session) return;
    reportLivePractice({
      sessionId: session.sessionId,
      studyPlanTaskId: session.studyPlan?.taskId ?? null,
      title:
        session.studyPlan?.title ??
        `${session.filterMeta?.sectionLabel ?? "UCAT"} practice`,
      answeredCount: liveStats?.answeredCount ?? 0,
      currentQuestionNumber: liveStats?.currentQuestionNumber ?? 1,
      targetUnits: session.studyPlan?.targetUnits ?? null,
      totalQuestionLabel:
        liveStats?.totalQuestionLabel ??
        (session.studyPlan?.targetUnits != null
          ? String(session.studyPlan.targetUnits)
          : "—"),
    });
  }, [liveStats, reportLivePractice, session]);

  const sessionTitle =
    session !== "loading" && session
      ? buildPracticeSessionTitle({
          filters: session.filters,
          filterMeta: session.filterMeta,
        })
      : null;

  useEffect(() => {
    if (session === "loading" || !session || !sessionTitle) {
      setTitle(null);
      setPractice(null);
      return;
    }
    setTitle(sessionTitle);
    const reviewAfterEachStem =
      (session.reviewTiming ?? "afterEachStem") === "afterEachStem";
    setPractice({
      stats: liveStats,
      elapsedSeconds:
        liveStats?.sessionTimeSeconds ??
        liveStats?.totalAnsweredTimeSeconds ??
        0,
      showAnswerStats: reviewAfterEachStem,
      reviewAfterEachStem,
      onFinishPractice:
        session.mode === "unlimited"
          ? handleFinishPracticeFromSidebar
          : undefined,
    });
    return () => {
      setTitle(null);
      setPractice(null);
    };
  }, [
    handleFinishPracticeFromSidebar,
    liveStats,
    session,
    sessionTitle,
    setPractice,
    setTitle,
  ]);

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
          isDiscarding={isDiscardingConflict}
          onDiscardAndContinue={() => void handleDiscardConflictAndStart()}
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

  const practiceSessionTimeLimitSeconds =
    session.mode === "set" &&
    (session.reviewTiming ?? "afterEachStem") === "atEnd" &&
    session.timePerQuestionSeconds != null &&
    session.timePerQuestionSeconds > 0
      ? calculatePracticeSessionTimeLimitSeconds(
          session.timePerQuestionSeconds,
          session.stems.reduce(
            (total, stem) => total + stem.questions.length,
            0,
          ),
        )
      : null;

  if (session.mode === "unlimited") {
    return (
      <div className="h-full min-h-0 w-full overflow-hidden">
        <UnlimitedPracticeEngine
          sessionId={session.sessionId}
          filters={session.filters}
          initialStems={session.stems ?? []}
          sessionMeta={session}
          timePerQuestionSeconds={session.timePerQuestionSeconds}
          reviewTiming={session.reviewTiming ?? "afterEachStem"}
          confirmNextStemTransitions={preferences.nextQuestionPopupEnabled}
          onPracticeSessionCompleted={handlePracticeSessionCompleted}
          onPracticeStatsChange={setLiveStats}
          onRegisterFinishPracticeDialog={handleRegisterFinishPracticeDialog}
        />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 w-full overflow-hidden">
      <QuestionEnginePage
        mode="questionStem"
        sourceId="practice"
        questionStems={session.stems}
        practice
        fillAvailableHeight
        practiceSessionId={session.sessionId}
        reviewTiming={session.reviewTiming ?? "afterEachStem"}
        confirmNextStemTransitions={preferences.nextQuestionPopupEnabled}
        onPracticeStatsChange={setLiveStats}
        timePerQuestionSeconds={session.timePerQuestionSeconds}
        practiceSessionTimeLimitSeconds={practiceSessionTimeLimitSeconds}
        onPracticeSessionCompleted={handlePracticeSessionCompleted}
      />
    </div>
  );
}

function UnlimitedPracticeEngine({
  sessionId,
  filters,
  initialStems,
  sessionMeta,
  timePerQuestionSeconds,
  reviewTiming,
  confirmNextStemTransitions,
  onPracticeSessionCompleted,
  onPracticeStatsChange,
  onRegisterFinishPracticeDialog,
}: {
  sessionId: string;
  filters: PracticeSelectionInput;
  initialStems: QuestionStemWithQuestions[];
  sessionMeta: Extract<PracticeSessionData, { mode: "unlimited" }>;
  timePerQuestionSeconds: number | null;
  reviewTiming: PracticeReviewTiming;
  confirmNextStemTransitions: boolean;
  onPracticeSessionCompleted: (attemptHref: string) => void;
  onPracticeStatsChange: (stats: PracticeEngineLiveStats | null) => void;
  onRegisterFinishPracticeDialog?: (open: () => void) => void;
}) {
  const router = useRouter();
  const [stems, setStems] = useState<QuestionStemWithQuestions[]>(initialStems);
  const [prefetchedStem, setPrefetchedStem] =
    useState<QuestionStemWithQuestions | null>(null);
  const prefetchingRef = useRef(false);
  const initialStemRequestRef = useRef<{
    sessionId: string;
    promise: Promise<QuestionStemWithQuestions | null>;
  } | null>(null);
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
    void fetchNextPracticeStem(
      sessionId,
      filtersRef.current,
      stems.map((stem) => stem.id),
      { preview: true },
    )
      .then((next) => {
        if (!cancelled) setPrefetchedStem(next);
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
    const cachedRequest = initialStemRequestRef.current;
    const request =
      cachedRequest?.sessionId === sessionId
        ? cachedRequest.promise
        : fetchNextPracticeStem(sessionId, filtersRef.current, []);
    initialStemRequestRef.current = { sessionId, promise: request };
    void (async () => {
      try {
        const next = await request;
        if (cancelled) return;
        if (next) {
          setStems([next]);
          setPracticeSession({ ...sessionMeta, stems: [next] });
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
          setError(
            "We couldn't load your practice questions. Please try again.",
          );
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialStems.length, openQuotaLimit, sessionId, sessionMeta]);

  const handleNeedMoreStems = useCallback(
    async (excludeStemIds: string[]) => {
      try {
        const next = await fetchDeliveredPracticeStem(
          sessionId,
          filtersRef.current,
          excludeStemIds,
          prefetchedStem?.id,
        );

        if (next) {
          setError(null);
          setPrefetchedStem(null);
          setStems((prev) => {
            if (prev.some((stem) => stem.id === next.id)) return prev;
            const updated = [...prev, next];
            setPracticeSession({ ...sessionMeta, stems: updated });
            return updated;
          });
          return { status: "loaded" as const, stems: [next] };
        }
        return { status: "exhausted" as const };
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          if (reviewTiming === "afterEachStem") {
            setQuotaReached(error.payload);
          }
          return { status: "quotaReached" as const };
        } else {
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
          onClick={() => router.replace("/practice")}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
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
      confirmNextStemTransitions={confirmNextStemTransitions}
      onPracticeStatsChange={onPracticeStatsChange}
      timePerQuestionSeconds={timePerQuestionSeconds}
      onPracticeSessionCompleted={onPracticeSessionCompleted}
      onNeedMoreStems={handleNeedMoreStems}
      practiceQuotaReached={quotaReached}
      onRegisterFinishPracticeDialog={onRegisterFinishPracticeDialog}
    />
  );
}
