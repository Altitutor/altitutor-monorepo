"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { UcatPageHeader } from "@/features/layout";
import { usePracticeFilters } from "@/features/practice/hooks/use-practice-filters";
import {
  STEM_FILTERS_STEP_COPY,
  StemFiltersPanel,
  type StemFiltersWizardStep,
} from "@/features/practice/components/stem-filters-panel";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import {
  createAndPersistPracticeSession,
  type PracticeSessionStartInput,
} from "@/features/practice/api/create-practice-session";
import { PracticeReducedStartDialog } from "@/features/practice/components/practice-reduced-start-dialog";
import { evaluatePracticeQuotaPreflight } from "@/features/practice/lib/practice-quota-preflight";
import {
  clearPracticeSession,
  setPendingPracticeStart,
  type PracticeReviewTiming,
} from "@/features/practice/lib/session-storage";
import { discardExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { ExamAttemptConflictDialog } from "@/features/exam-attempts/components/exam-attempt-conflict-dialog";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { Button } from "@/components/ui/button";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";
import { UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";
import {
  buildQuestionEngineTutorialHref,
  useQuestionEngineTutorialGate,
} from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

export function PracticePage() {
  const router = useRouter();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const {
    active: activeExamAttempt,
    isLoading: activeAttemptLoading,
    refresh: refreshActiveAttempt,
    clearLocal: clearActiveAttempt,
  } = useActiveExamAttempt();
  const {
    isLoading: questionEngineTourLoading,
    isBlocked: questionEngineTourBlocked,
  } = useQuestionEngineTutorialGate();
  const { data: quota } = useQuotaUsage();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const filters = usePracticeFilters({
    timeControlType: "perQuestion",
    showUnlimitedOption: true,
  });
  const [reviewTiming, setReviewTiming] =
    useState<PracticeReviewTiming>("afterEachStem");
  const [conflictActive, setConflictActive] =
    useState<ActiveExamAttempt | null>(null);
  const [isDiscardingConflict, setIsDiscardingConflict] = useState(false);
  const pendingStartRef = useRef<PracticeSessionStartInput | null>(null);
  const [reducedStart, setReducedStart] = useState<{
    input: PracticeSessionStartInput;
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

  const buildStartInput = useCallback(
    (
      payload: PracticeSelectionInput & {
        unlimited?: boolean;
        reviewTiming: PracticeReviewTiming;
      },
      ucatSectionId: string,
    ): PracticeSessionStartInput => ({
      payload,
      ucatSectionId,
      filterMeta: {
        sectionLabel: filters.selectedSectionLabel,
        categoryLabels:
          payload.categoryIds.length > 0
            ? filters.selectedCategories.map((c) => c.name)
            : [],
        examTimePerQuestionSeconds: filters.sectionTimePerQuestionSeconds,
      },
    }),
    [
      filters.sectionTimePerQuestionSeconds,
      filters.selectedCategories,
      filters.selectedSectionLabel,
    ],
  );

  const startMutation = useMutation({
    mutationFn: createAndPersistPracticeSession,
    onSuccess: () => {
      router.push("/exam");
    },
    onError: (error) => {
      if (error instanceof QuotaExceededError) {
        openQuotaLimit(error.payload, {
          dismissAction: { label: "Dismiss", variant: "dismiss" },
        });
      }
    },
  });

  const startWithQuotaPreflight = useCallback(
    (input: PracticeSessionStartInput) => {
      const preflight = evaluatePracticeQuotaPreflight(quota, input);

      switch (preflight.status) {
        case "ok":
          startMutation.mutate(input);
          return;
        case "atLimit":
          openQuotaLimit(
            {
              code: "QUOTA_EXCEEDED",
              area: "practice",
              used: preflight.used,
              limit: preflight.limit,
              period: preflight.period,
            },
            {
              dismissAction: { label: "Dismiss", variant: "dismiss" },
            },
          );
          return;
        case "reduce":
          setReducedStart({
            input: { ...input, payload: preflight.payload },
            requestedCount: preflight.requestedCount,
            remainingCount: preflight.remainingCount,
          });
          return;
        default: {
          const _exhaustive: never = preflight;
          return _exhaustive;
        }
      }
    },
    [openQuotaLimit, quota, startMutation],
  );

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
    const startInput = buildStartInput(payload, ucatSectionId);
    // Create the DB session only after the engine tutorial — otherwise Resume
    // points at the unified exam route which immediately redirects to tutorial.
    if (questionEngineTourBlocked) {
      setPendingPracticeStart(startInput);
      router.push(buildQuestionEngineTutorialHref("/practice"));
      return;
    }

    if (activeExamAttempt) {
      pendingStartRef.current = startInput;
      setConflictActive(activeExamAttempt);
      return;
    }

    startWithQuotaPreflight(startInput);
  }

  async function handleDiscardConflictAndStart() {
    if (!conflictActive || !pendingStartRef.current) return;
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
      setConflictActive(null);
      startWithQuotaPreflight(pendingStartRef.current);
      pendingStartRef.current = null;
    } finally {
      setIsDiscardingConflict(false);
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
        isDiscarding={isDiscardingConflict}
        onDiscardAndContinue={() => void handleDiscardConflictAndStart()}
        onCancel={() => {
          setConflictActive(null);
          pendingStartRef.current = null;
        }}
      />
      <PracticeReducedStartDialog
        open={reducedStart != null}
        requestedCount={reducedStart?.requestedCount ?? 0}
        remainingCount={reducedStart?.remainingCount ?? 0}
        isPending={startMutation.isPending}
        onCancel={() => setReducedStart(null)}
        onConfirm={() => {
          if (!reducedStart) return;
          startMutation.mutate(reducedStart.input);
          setReducedStart(null);
        }}
      />
    </motion.div>
  );
}
