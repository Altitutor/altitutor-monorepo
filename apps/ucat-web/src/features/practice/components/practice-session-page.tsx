"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { fetchActiveExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import type { QuotaExceededPayload } from "@/features/ucat-access/types/quota";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import {
  assertOkOrQuotaExceeded,
  QuotaExceededError,
} from "@/lib/ucat/quota/parse-quota-error";
import { sectionLabels } from "@/features/set-generator/model/mock-data";
import { formatTimeSeconds } from "@/features/progress/lib/format-time";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";

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

function formatPracticePerformanceFilter(input?: SetGeneratorInput): string {
  if (!input) return "Any";
  if (input.unansweredOnly) return "Unanswered";
  if (input.incorrectOnly) return "Incorrect";
  return "Any";
}

function formatPracticeTimeFilter(input?: SetGeneratorInput): string {
  const seconds = input?.timePerQuestionSeconds;
  if (seconds != null && seconds > 0) {
    return `${Number(seconds).toFixed(1)} sec/question`;
  }
  return "No time limit";
}

function formatPracticeCategoryFilter(
  input?: SetGeneratorInput,
  meta?: PracticeSessionData["filterMeta"],
): string {
  const count = input?.categoryIds?.length ?? 0;
  if (count === 0) return "All categories";
  const labels = meta?.categoryLabels?.filter(Boolean) ?? [];
  if (labels.length > 0) return labels.join(", ");
  return `${count} selected`;
}

function PracticeSessionStatsCards({
  stats,
  filters,
  filterMeta,
  elapsedSeconds,
}: {
  stats: PracticeEngineLiveStats | null;
  filters?: SetGeneratorInput;
  filterMeta?: PracticeSessionData["filterMeta"];
  elapsedSeconds: number;
}) {
  const answeredCount = stats?.answeredCount ?? 0;
  const correctCount = stats?.correctCount ?? 0;
  const incorrectCount = stats?.incorrectCount ?? 0;
  const averageSeconds =
    answeredCount > 0 ? elapsedSeconds / answeredCount : null;
  const sectionLabel =
    filterMeta?.sectionLabel ??
    (filters?.section ? sectionLabels[filters.section] : "Practice");
  const totalQuestionLabel = stats?.totalQuestionLabel ?? "—";
  const currentQuestionLabel = stats
    ? `${stats.currentQuestionNumber} / ${stats.totalQuestionLabel}`
    : "—";

  const statCards = [
    { label: "Answered", value: String(answeredCount) },
    {
      label: "Correct / answered",
      value: `${correctCount} / ${answeredCount}`,
    },
    {
      label: "Incorrect / answered",
      value: `${incorrectCount} / ${answeredCount}`,
    },
    { label: "Session time", value: formatTimeSeconds(elapsedSeconds) },
    {
      label: "Average time / question",
      value: averageSeconds != null ? formatTimeSeconds(averageSeconds) : "—",
    },
  ];

  const filterRows = [
    { label: "Section", value: sectionLabel },
    {
      label: "Category",
      value: formatPracticeCategoryFilter(filters, filterMeta),
    },
    { label: "Time", value: formatPracticeTimeFilter(filters) },
    { label: "Performance", value: formatPracticePerformanceFilter(filters) },
    { label: "Question count", value: totalQuestionLabel },
    { label: "Current question", value: currentQuestionLabel },
  ];

  return (
    <aside className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {statCards.map((card) => (
          <Card key={card.label} className={cn(UCAT_CARD_CHROME, "min-w-0")}>
            <CardContent className="p-4">
              <div className="text-xs font-medium text-muted-foreground">
                {card.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className={cn(UCAT_CARD_CHROME, "min-w-0")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Practice filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="space-y-2 text-sm">
            {filterRows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="break-words font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </aside>
  );
}

export function PracticeSessionPage() {
  const router = useRouter();
  const { data: quota, isLoading: quotaLoading } = useQuotaUsage();
  const { openQuotaLimit } = useQuotaLimitModal();
  const [session, setSession] = useState<
    PracticeSessionData | null | "loading"
  >("loading");
  const [liveStats, setLiveStats] = useState<PracticeEngineLiveStats | null>(
    null,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (quotaLoading) return;
    void (async () => {
      let data = getPracticeSession();
      if (!data) {
        const active = await fetchActiveExamAttempt();
        if (active?.kind === "practice" && active.practiceSessionId) {
          const stemsRes = await fetch(
            `/api/ucat/practice-sessions/${active.practiceSessionId}`,
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
                sessionId: active.practiceSessionId,
                filters: detail.filtersSnapshot,
                stems: detail.stemsSnapshot ?? [],
                timePerQuestionSeconds: null,
                startedAtMs: Date.now(),
              };
            } else if (detail.stemsSnapshot?.length) {
              data = {
                mode: "set",
                sessionId: active.practiceSessionId,
                stems: detail.stemsSnapshot,
                filters: detail.filtersSnapshot,
                timePerQuestionSeconds: null,
                startedAtMs: Date.now(),
              };
            }
            if (data) setPracticeSession(data);
          }
        }
      }
      if (!data) {
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
  }, [openQuotaLimit, quota, quotaLoading, router]);

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
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (session.mode === "unlimited") {
    return (
      <UcatLagProvider>
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <UnlimitedPracticeEngine
            sessionId={session.sessionId}
            filters={session.filters}
            initialStems={session.stems ?? []}
            sessionMeta={session}
            timePerQuestionSeconds={session.timePerQuestionSeconds}
            onBack={handleDone}
            onPracticeStatsChange={setLiveStats}
          />
          <PracticeSessionStatsCards
            stats={liveStats}
            filters={session.filters}
            filterMeta={session.filterMeta}
            elapsedSeconds={elapsedSeconds}
          />
        </div>
      </UcatLagProvider>
    );
  }

  return (
    <UcatLagProvider>
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
        />
        <PracticeSessionStatsCards
          stats={liveStats}
          filters={session.filters}
          filterMeta={session.filterMeta}
          elapsedSeconds={elapsedSeconds}
        />
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
}: {
  sessionId: string;
  filters: SetGeneratorInput;
  initialStems: QuestionStemWithQuestions[];
  sessionMeta: Extract<PracticeSessionData, { mode: "unlimited" }>;
  timePerQuestionSeconds: number | null;
  onBack: () => void;
  onPracticeStatsChange: (stats: PracticeEngineLiveStats | null) => void;
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
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
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
    />
  );
}
