"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import { useStemFilters } from "@/features/set-generator/hooks/use-stem-filters";
import { StemFiltersPanel } from "@/features/set-generator/components/stem-filters-panel";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import {
  clearPracticeSession,
  setPracticeSession,
} from "@/features/practice/lib/session-storage";
import {
  fetchActiveExamAttempt,
  finalizeExamAttempt,
} from "@/features/exam-attempts/api/exam-attempts-api";
import { ExamAttemptConflictDialog } from "@/features/exam-attempts/components/exam-attempt-conflict-dialog";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { Button } from "@/components/ui/button";
import {
  assertOkOrQuotaExceeded,
  QuotaExceededError,
} from "@/lib/ucat/quota/parse-quota-error";
import { UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";

export function PracticePage() {
  const router = useRouter();
  const { refresh: refreshActiveAttempt } = useActiveExamAttempt();
  const { data: quota } = useQuotaUsage();
  const { openQuotaLimit } = useQuotaLimitModal();
  const filters = useStemFilters({
    timeControlType: "perQuestion",
    showUnlimitedOption: true,
  });
  const [conflictActive, setConflictActive] =
    useState<ActiveExamAttempt | null>(null);
  const [isFinalizingConflict, setIsFinalizingConflict] = useState(false);
  const pendingStartRef = useRef<{
    payload: SetGeneratorInput & { unlimited?: boolean };
    ucatSectionId: string;
  } | null>(null);
  const [reducedStart, setReducedStart] = useState<{
    payload: SetGeneratorInput & { unlimited?: boolean };
    ucatSectionId: string;
    requestedCount: number;
    remainingCount: number;
  } | null>(null);

  const startMutation = useMutation({
    mutationFn: async ({
      payload,
      ucatSectionId,
    }: {
      payload: SetGeneratorInput & { unlimited?: boolean };
      ucatSectionId: string;
    }) => {
      const { unlimited, ...input } = payload;
      const sectionKey = input.section;

      if (unlimited) {
        const createSessionRes = await fetch("/api/ucat/practice-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionKey,
            ucatSectionId,
            filtersSnapshot: input,
            unlimited: true,
          }),
        });

        if (!createSessionRes.ok) {
          await assertOkOrQuotaExceeded(createSessionRes);
          const body = await createSessionRes.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to create practice session");
        }

        const { id: sessionId } = (await createSessionRes.json()) as {
          id: string;
        };
        return { unlimited: true as const, stems: [], sessionId };
      }

      const stemsRes = await fetch("/api/ucat/practice-stems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: payload }),
      });

      if (!stemsRes.ok) {
        await assertOkOrQuotaExceeded(stemsRes);
        const body = await stemsRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to load practice stems");
      }

      const stemsData = (await stemsRes.json()) as {
        stems: QuestionStemWithQuestions[];
        questionCount: number;
        totalMatchingQuestions: number;
      };

      const createSessionRes = await fetch("/api/ucat/practice-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionKey,
          ucatSectionId,
          filtersSnapshot: input,
          stemsSnapshot: stemsData.stems,
          unlimited: false,
        }),
      });

      if (!createSessionRes.ok) {
        await assertOkOrQuotaExceeded(createSessionRes);
        const body = await createSessionRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create practice session");
      }

      const { id: sessionId } = (await createSessionRes.json()) as {
        id: string;
      };

      return {
        stems: stemsData.stems,
        questionCount: stemsData.questionCount,
        totalMatchingQuestions: stemsData.totalMatchingQuestions,
        sessionId,
      };
    },
    onSuccess: (data, variables) => {
      const timePerQuestionSeconds =
        variables.payload.timePerQuestionSeconds != null &&
        variables.payload.timePerQuestionSeconds > 0
          ? variables.payload.timePerQuestionSeconds
          : null;

      if ("unlimited" in data && data.unlimited) {
        setPracticeSession({
          mode: "unlimited",
          sessionId: data.sessionId,
          filters: variables.payload,
          filterMeta: {
            sectionLabel: filters.selectedSectionLabel,
            categoryLabels:
              variables.payload.categoryIds.length > 0
                ? filters.selectedCategories.map((c) => c.name)
                : [],
            examTimePerQuestionSeconds: filters.sectionTimePerQuestionSeconds,
          },
          timePerQuestionSeconds,
          startedAtMs: Date.now(),
        });
      } else {
        setPracticeSession({
          mode: "set",
          sessionId: data.sessionId,
          stems: data.stems,
          filters: variables.payload,
          filterMeta: {
            sectionLabel: filters.selectedSectionLabel,
            categoryLabels:
              variables.payload.categoryIds.length > 0
                ? filters.selectedCategories.map((c) => c.name)
                : [],
            examTimePerQuestionSeconds: filters.sectionTimePerQuestionSeconds,
          },
          timePerQuestionSeconds,
          startedAtMs: Date.now(),
        });
      }
      router.push("/practice/session");
    },
    onError: (error) => {
      if (error instanceof QuotaExceededError) {
        openQuotaLimit(error.payload, {
          dismissAction: { label: "Dismiss", variant: "dismiss" },
        });
      }
    },
  });

  function startWithQuotaPreflight({
    payload,
    ucatSectionId,
  }: {
    payload: SetGeneratorInput & { unlimited?: boolean };
    ucatSectionId: string;
  }) {
    const practiceQuota = quota?.areas.find((area) => area.area === "practice");
    const enforceFreeQuota =
      quota?.onlineTier === "free" && !quota.isQuotaExempt && practiceQuota;

    if (enforceFreeQuota) {
      const remainingCount = Math.max(
        0,
        practiceQuota.limit - practiceQuota.used,
      );
      if (practiceQuota.limit === 0 || remainingCount === 0) {
        openQuotaLimit(
          {
            code: "QUOTA_EXCEEDED",
            area: "practice",
            used: practiceQuota.used,
            limit: practiceQuota.limit,
            period: practiceQuota.period,
          },
          {
            dismissAction: { label: "Dismiss", variant: "dismiss" },
          },
        );
        return;
      }

      if (!payload.unlimited && payload.questionCount > remainingCount) {
        setReducedStart({
          payload: { ...payload, questionCount: remainingCount },
          ucatSectionId,
          requestedCount: payload.questionCount,
          remainingCount,
        });
        return;
      }
    }

    startMutation.mutate({ payload, ucatSectionId });
  }

  async function handleStart() {
    const ucatSectionId = filters.selectedSection?.id;
    if (!ucatSectionId) return;

    const unlimited = filters.questionCountMode === "unlimited";
    const payload = {
      ...filters.input,
      unlimited: unlimited || undefined,
    };

    const active = await fetchActiveExamAttempt();
    if (active) {
      pendingStartRef.current = { payload, ucatSectionId };
      setConflictActive(active);
      return;
    }

    startWithQuotaPreflight({ payload, ucatSectionId });
  }

  async function handleFinalizeConflictAndStart() {
    if (!conflictActive || !pendingStartRef.current) return;
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
      setConflictActive(null);
      startWithQuotaPreflight(pendingStartRef.current);
      pendingStartRef.current = null;
    } finally {
      setIsFinalizingConflict(false);
    }
  }

  const actionButton = (
    <Button
      type="button"
      data-tour="practice-start"
      onClick={() => !startMutation.isPending && handleStart()}
      disabled={startMutation.isPending || !filters.selectedSection?.id}
      className={UCAT_PRIMARY_ACTION_BUTTON}
    >
      {startMutation.isPending ? "Loading…" : "Start practice"}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div id="tour-practice-header">
        <UcatPageHeader
          title="Practice questions"
          description="Pick stems and practice in question stem mode. Answer each stem, see feedback immediately."
        />
      </div>
      <div id="tour-practice-filters">
        <StemFiltersPanel
          input={filters.input}
          selectedSection={filters.selectedSection}
          sectionCategories={filters.sectionCategories}
          selectedCategories={filters.selectedCategories}
          matchingCount={filters.matchingCount}
          maxQuestionsInSection={filters.maxQuestionsInSection}
          selectedSectionLabel={filters.selectedSectionLabel}
          performanceFilter={filters.performanceFilter}
          previewTimeLabel={filters.previewTimeLabel}
          sectionLabels={filters.sectionLabels}
          onSectionChange={filters.handleSectionChange}
          onCategoryChange={filters.handleCategoryChange}
          onPerformanceFilterChange={filters.handlePerformanceFilterChange}
          onTimeModeChange={filters.handleTimeModeChange}
          onTimeSpeedChange={filters.handleTimeSpeedChange}
          onQuestionCountChange={filters.handleQuestionCountChange}
          onCustomTimeMinutesChange={filters.handleCustomTimeMinutesChange}
          onTimePerQuestionChange={filters.handleTimePerQuestionChange}
          timeControlType="perQuestion"
          sectionTimePerQuestionSeconds={filters.sectionTimePerQuestionSeconds}
          showUnlimitedOption={filters.showUnlimitedOption}
          questionCountMode={filters.questionCountMode}
          onQuestionCountModeChange={filters.handleQuestionCountModeChange}
          actionButton={actionButton}
        />
      </div>
      <ExamAttemptConflictDialog
        open={conflictActive != null}
        active={conflictActive}
        pendingLabel="new practice session"
        isFinalizing={isFinalizingConflict}
        onFinalizeAndContinue={() => void handleFinalizeConflictAndStart()}
        onCancel={() => {
          setConflictActive(null);
          pendingStartRef.current = null;
        }}
      />
      <AlertDialog
        open={reducedStart != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setReducedStart(null);
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a smaller practice set?</AlertDialogTitle>
            <AlertDialogDescription>
              You asked for {reducedStart?.requestedCount ?? 0} questions, but
              you have {reducedStart?.remainingCount ?? 0} new practice
              questions left in your UCAT Free allowance. Start with{" "}
              {reducedStart?.remainingCount ?? 0} questions using the same
              filters?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReducedStart(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!reducedStart) return;
                startMutation.mutate({
                  payload: reducedStart.payload,
                  ucatSectionId: reducedStart.ucatSectionId,
                });
                setReducedStart(null);
              }}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? "Loading…" : "Start smaller set"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
