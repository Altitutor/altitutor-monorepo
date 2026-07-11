"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@altitutor/ui";
import { QuestionEnginePage } from "@/features/question-engine";
import type { PracticeEngineLiveStats } from "@/features/question-engine/components/question-engine-page";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import { UcatLagProvider } from "@/features/question-engine/context/ucat-lag-context";
import {
  clearPracticeSession,
  getPracticeSession,
  setPracticeSession,
  type PracticeSessionData,
} from "@/features/practice/lib/session-storage";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import type { QuotaExceededPayload } from "@/features/ucat-access/types/quota";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
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

async function fetchNextStem(
  practiceSessionId: string,
  input: SetGeneratorInput,
  excludeStemIds: string[],
): Promise<QuestionStemWithQuestions[] | null> {
  const response = await fetch("/api/ucat/practice-stems/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      excludeStemIds,
      practiceSessionId,
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
            <InlineStatRow
              label="Question time"
              value={formatPracticeDuration(answeredTimeSeconds)}
            />
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
  const { data: quota, isLoading: quotaLoading } = useQuotaUsage();
  const { active: activeExamAttempt, isLoading: activeAttemptLoading } =
    useActiveExamAttempt();
  const { openQuotaLimit } = useQuotaLimitModal();
  const [session, setSession] = useState<
    PracticeSessionData | null | "loading"
  >("loading");
  const [liveStats, setLiveStats] = useState<PracticeEngineLiveStats | null>(
    null,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const openFinishPracticeDialogRef = useRef<(() => void) | null>(null);

  const handleRegisterFinishPracticeDialog = useCallback((open: () => void) => {
    openFinishPracticeDialogRef.current = open;
  }, []);

  const handleFinishPracticeFromSidebar = useCallback(() => {
    openFinishPracticeDialogRef.current?.();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const localSession = getPracticeSession();
    if (localSession) {
      setSession(localSession);
      return () => {
        cancelled = true;
      };
    }
    if (activeAttemptLoading) return;

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
            filtersSnapshot?: SetGeneratorInput;
            unlimited?: boolean;
          };
          if (detail.unlimited && detail.filtersSnapshot) {
            data = {
              mode: "unlimited",
              sessionId: activeExamAttempt.practiceSessionId,
              filters: detail.filtersSnapshot,
              stems: detail.stemsSnapshot ?? [],
              timePerQuestionSeconds: null,
              startedAtMs: Date.now(),
            };
          } else if (detail.stemsSnapshot?.length) {
            data = {
              mode: "set",
              sessionId: activeExamAttempt.practiceSessionId,
              stems: detail.stemsSnapshot,
              filters: detail.filtersSnapshot,
              timePerQuestionSeconds: null,
              startedAtMs: Date.now(),
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
          openQuotaLimit({
            code: "QUOTA_EXCEEDED",
            area: "practice",
            used: practiceQuota.used,
            limit: practiceQuota.limit,
            period: practiceQuota.period,
          });
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
    openQuotaLimit,
    quota,
    quotaLoading,
    router,
  ]);

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

  if (session === "loading") {
    return (
      <div
        className="space-y-4 p-6"
        aria-busy="true"
        aria-label="Loading practice session"
      >
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[28rem] w-full rounded-xl" />
      </div>
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
        <div className="space-y-4">
          <h1 className="text-lg font-semibold tracking-normal text-foreground">
            {sessionTitle}
          </h1>
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <UnlimitedPracticeEngine
              sessionId={session.sessionId}
              filters={session.filters}
              initialStems={session.stems ?? []}
              sessionMeta={session}
              timePerQuestionSeconds={session.timePerQuestionSeconds}
              onBack={handleDone}
              onPracticeStatsChange={setLiveStats}
              onRegisterFinishPracticeDialog={
                handleRegisterFinishPracticeDialog
              }
            />
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
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-normal text-foreground">
          {sessionTitle}
        </h1>
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <QuestionEnginePage
            mode="questionStem"
            sourceId="practice"
            questionStems={session.stems}
            practice
            practiceSessionId={session.sessionId}
            onPracticeStatsChange={setLiveStats}
            timePerQuestionSeconds={session.timePerQuestionSeconds}
            backHref="/practice"
            onBack={handleDone}
            onRegisterFinishPracticeDialog={handleRegisterFinishPracticeDialog}
          />
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
  onBack,
  onPracticeStatsChange,
  onRegisterFinishPracticeDialog,
}: {
  sessionId: string;
  filters: SetGeneratorInput;
  initialStems: QuestionStemWithQuestions[];
  sessionMeta: Extract<PracticeSessionData, { mode: "unlimited" }>;
  timePerQuestionSeconds: number | null;
  onBack: () => void;
  onPracticeStatsChange: (stats: PracticeEngineLiveStats | null) => void;
  onRegisterFinishPracticeDialog?: (open: () => void) => void;
}) {
  const [stems, setStems] = useState<QuestionStemWithQuestions[]>(initialStems);
  const [loading, setLoading] = useState(initialStems.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [quotaReached, setQuotaReached] = useState<QuotaExceededPayload | null>(
    null,
  );
  const { openQuotaLimit } = useQuotaLimitModal();
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

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
          openQuotaLimit(error.payload);
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
        const next = await fetchNextStem(
          sessionId,
          filtersRef.current,
          excludeStemIds,
        );
        if (next?.length) {
          setStems((prev) => {
            const updated = [...prev, ...next];
            setPracticeSession({ ...sessionMeta, stems: updated });
            return updated;
          });
          return next;
        }
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          setQuotaReached(error.payload);
        } else {
          setError("No question stems match these filters.");
        }
      }
      return null;
    },
    [sessionId, sessionMeta],
  );

  if (loading) {
    return (
      <div
        className="space-y-4 p-6"
        aria-busy="true"
        aria-label="Loading questions"
      >
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (error || stems.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8">
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
      practiceSessionId={sessionId}
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
