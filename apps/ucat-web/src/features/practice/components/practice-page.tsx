"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { UcatPageHeader } from "@/features/layout";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import { useStemFilters } from "@/features/set-generator/hooks/use-stem-filters";
import { StemFiltersPanel } from "@/features/set-generator/components/stem-filters-panel";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import { setPracticeSession } from "@/features/practice/lib/session-storage";
import { Button } from "@/components/ui/button";
import { UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";

export function PracticePage() {
  const router = useRouter();
  const filters = useStemFilters({
    timeControlType: "perQuestion",
    showUnlimitedOption: true,
  });

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
          timePerQuestionSeconds,
        });
      } else {
        setPracticeSession({
          mode: "set",
          sessionId: data.sessionId,
          stems: data.stems,
          timePerQuestionSeconds,
        });
      }
      router.push("/practice/session");
    },
  });

  function handleStart() {
    const ucatSectionId = filters.selectedSection?.id;
    if (!ucatSectionId) return;

    const unlimited = filters.questionCountMode === "unlimited";
    const payload = {
      ...filters.input,
      unlimited: unlimited || undefined,
    };
    startMutation.mutate({ payload, ucatSectionId });
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
          title="Practice"
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
    </div>
  );
}
