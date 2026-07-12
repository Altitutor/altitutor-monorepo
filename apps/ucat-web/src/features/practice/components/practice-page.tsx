"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
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
import {
  STEM_FILTERS_STEP_COPY,
  StemFiltersPanel,
  type StemFiltersWizardStep,
} from "@/features/set-generator/components/stem-filters-panel";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import {
  clearPendingPracticeStart,
  clearPracticeSession,
  getPendingPracticeStart,
  setPracticeSession,
  setPendingPracticeStart,
  type PracticeReviewTiming,
} from "@/features/practice/lib/session-storage";
import { finalizeExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { ExamAttemptConflictDialog } from "@/features/exam-attempts/components/exam-attempt-conflict-dialog";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { Button } from "@/components/ui/button";
import {
  assertOkOrQuotaExceeded,
  QuotaExceededError,
} from "@/lib/ucat/quota/parse-quota-error";
import { UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";
import {
  buildQuestionEngineTutorialHref,
  useQuestionEngineTutorialGate,
} from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

export function PracticePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const {
    active: activeExamAttempt,
    isLoading: activeAttemptLoading,
    refresh: refreshActiveAttempt,
  } = useActiveExamAttempt();
  const {
    isLoading: questionEngineTourLoading,
    isBlocked: questionEngineTourBlocked,
  } = useQuestionEngineTutorialGate();
  const { data: quota } = useQuotaUsage();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const filters = useStemFilters({
    timeControlType: "perQuestion",
    showUnlimitedOption: true,
  });
  const [reviewTiming, setReviewTiming] =
    useState<PracticeReviewTiming>("afterEachStem");
  const [conflictActive, setConflictActive] =
    useState<ActiveExamAttempt | null>(null);
  const [isFinalizingConflict, setIsFinalizingConflict] = useState(false);
  const pendingStartRef = useRef<{
    payload: SetGeneratorInput & {
      unlimited?: boolean;
      reviewTiming: PracticeReviewTiming;
    };
    ucatSectionId: string;
  } | null>(null);
  const consumedTutorialStartRef = useRef(false);
  const [reducedStart, setReducedStart] = useState<{
    payload: SetGeneratorInput & {
      unlimited?: boolean;
      reviewTiming: PracticeReviewTiming;
    };
    ucatSectionId: string;
    requestedCount: number;
    remainingCount: number;
  } | null>(null);
  const [wizardHeader, setWizardHeader] = useState<{
    title: string;
    subtitle: string;
    canGoBack: boolean;
    isTransitioning: boolean;
  }>({
    title: STEM_FILTERS_STEP_COPY[0].title,
    subtitle: STEM_FILTERS_STEP_COPY[0].subtitle,
    canGoBack: false,
    isTransitioning: false,
  });
  const wizardGoBackRef = useRef<(() => void) | null>(null);
  const handleWizardStepChange = useCallback((state: StemFiltersWizardStep) => {
    wizardGoBackRef.current = state.goBack;
    setWizardHeader((prev) => {
      if (
        prev.title === state.title &&
        prev.subtitle === state.subtitle &&
        prev.canGoBack === state.canGoBack &&
        prev.isTransitioning === state.isTransitioning
      ) {
        return prev;
      }
      return {
        title: state.title,
        subtitle: state.subtitle,
        canGoBack: state.canGoBack,
        isTransitioning: state.isTransitioning,
      };
    });
  }, []);
  const practiceQuota = quota?.areas.find((area) => area.area === "practice");
  const freeQuestionLimit =
    quota?.onlineTier === "free" && !quota.isQuotaExempt && practiceQuota
      ? Math.max(0, practiceQuota.limit - practiceQuota.used)
      : null;

  const startMutation = useMutation({
    mutationFn: async ({
      payload,
      ucatSectionId,
    }: {
      payload: SetGeneratorInput & {
        unlimited?: boolean;
        reviewTiming: PracticeReviewTiming;
      };
      ucatSectionId: string;
    }) => {
      const { unlimited, reviewTiming, ...input } = payload;
      const sectionKey = input.section;

      if (unlimited) {
        const createSessionRes = await fetch("/api/ucat/practice-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionKey,
            ucatSectionId,
            filtersSnapshot: { ...input, reviewTiming },
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

      const createSessionRes = await fetch("/api/ucat/practice-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionKey,
          ucatSectionId,
          filtersSnapshot: { ...input, reviewTiming },
          unlimited: false,
        }),
      });

      if (!createSessionRes.ok) {
        await assertOkOrQuotaExceeded(createSessionRes);
        const body = await createSessionRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create practice session");
      }

      const sessionData = (await createSessionRes.json()) as {
        id: string;
        stems: QuestionStemWithQuestions[];
        questionCount: number;
        totalMatchingQuestions: number;
      };

      return {
        stems: sessionData.stems,
        questionCount: sessionData.questionCount,
        totalMatchingQuestions: sessionData.totalMatchingQuestions,
        sessionId: sessionData.id,
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
          reviewTiming: variables.payload.reviewTiming,
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
          reviewTiming: variables.payload.reviewTiming,
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

  const startWithQuotaPreflight = useCallback(({
    payload,
    ucatSectionId,
  }: {
    payload: SetGeneratorInput & {
      unlimited?: boolean;
      reviewTiming: PracticeReviewTiming;
    };
    ucatSectionId: string;
  }) => {
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
  }, [openQuotaLimit, quota, startMutation]);

  function handleStart() {
    const ucatSectionId = filters.selectedSection?.id;
    if (!ucatSectionId) return;
    if (questionEngineTourLoading) return;
    const unlimited = filters.questionCountMode === "unlimited";
    const payload = {
      ...filters.input,
      unlimited: unlimited || undefined,
      reviewTiming,
    };
    // Create the DB session only after the engine tutorial — otherwise Resume
    // points at /practice/session which immediately redirects back to tutorial.
    if (questionEngineTourBlocked) {
      const pendingStart = { payload, ucatSectionId };
      setPendingPracticeStart(pendingStart);
      router.push(
        buildQuestionEngineTutorialHref("/practice?startTutorialAttempt=1"),
      );
      return;
    }

    if (activeExamAttempt) {
      pendingStartRef.current = { payload, ucatSectionId };
      setConflictActive(activeExamAttempt);
      return;
    }

    startWithQuotaPreflight({ payload, ucatSectionId });
  }

  useEffect(() => {
    if (
      searchParams.get("startTutorialAttempt") !== "1" ||
      questionEngineTourLoading ||
      questionEngineTourBlocked ||
      activeAttemptLoading ||
      startMutation.isPending ||
      consumedTutorialStartRef.current
    ) {
      return;
    }

    const pendingStart = getPendingPracticeStart();
    consumedTutorialStartRef.current = true;
    clearPendingPracticeStart();
    router.replace("/practice");
    if (!pendingStart) return;

    if (activeExamAttempt) {
      pendingStartRef.current = pendingStart;
      setConflictActive(activeExamAttempt);
      return;
    }

    startWithQuotaPreflight(pendingStart);
  }, [
    activeAttemptLoading,
    activeExamAttempt,
    questionEngineTourBlocked,
    questionEngineTourLoading,
    router,
    searchParams,
    startWithQuotaPreflight,
    startMutation.isPending,
  ]);

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
      onClick={() => !startMutation.isPending && handleStart()}
      disabled={
        startMutation.isPending ||
        activeAttemptLoading ||
        questionEngineTourLoading ||
        !filters.selectedSection?.id
      }
      className={UCAT_PRIMARY_ACTION_BUTTON}
    >
      {startMutation.isPending ||
      activeAttemptLoading ||
      questionEngineTourLoading
        ? "Loading…"
        : "Start practice"}
    </Button>
  );

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div id="tour-practice-header" variants={itemVariants}>
        <UcatPageHeader
          title={wizardHeader.title}
          description={wizardHeader.subtitle}
          onBack={
            wizardHeader.canGoBack
              ? () => {
                  wizardGoBackRef.current?.();
                }
              : undefined
          }
          backDisabled={wizardHeader.isTransitioning}
        />
      </motion.div>
      <motion.div variants={itemVariants}>
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
          reviewTiming={reviewTiming}
          onReviewTimingChange={setReviewTiming}
          fixedQuestionCountLimit={freeQuestionLimit}
          actionButton={actionButton}
          hideStepHeader
          onWizardStepChange={handleWizardStepChange}
        />
      </motion.div>
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
    </motion.div>
  );
}
