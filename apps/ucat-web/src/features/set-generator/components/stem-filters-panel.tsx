"use client";

import { Button } from "@/components/ui/button";
import { Label, Popover, PopoverContent, PopoverTrigger, SearchableSelect, SearchableSelectInline, Slider } from "@altitutor/ui";
import { ChevronDown } from "lucide-react";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import type {
  SectionKey,
  TimeMode,
} from "@/features/set-generator/model/types";
import type {
  CategoryRow,
  PerformanceFilter,
} from "@/features/set-generator/hooks/use-stem-filters";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import { UCAT_INTERACTION_EASE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export type StemFiltersPanelProps = {
  input: SetGeneratorInput;
  selectedSection: { id: string; number_of_questions: number | null } | null;
  sectionCategories: CategoryRow[];
  selectedCategories: CategoryRow[];
  matchingCount: number | undefined;
  maxQuestionsInSection: number;
  selectedSectionLabel: string;
  performanceFilter: PerformanceFilter;
  previewTimeLabel: string;
  sectionLabels: Record<SectionKey, string>;
  onSectionChange: (section: SectionKey) => void;
  onCategoryChange: (categories: CategoryRow[]) => void;
  onPerformanceFilterChange: (mode: PerformanceFilter) => void;
  onTimeModeChange: (mode: TimeMode) => void;
  onTimeSpeedChange: (value: number) => void;
  onQuestionCountChange: (value: number) => void;
  onCustomTimeMinutesChange: (value: number | null) => void;
  /** Action button (e.g. "Generate set" or "Start practice") */
  actionButton: React.ReactNode;
  /** When 'perQuestion', show time-per-question controls instead of set time. */
  timeControlType?: "set" | "perQuestion";
  onTimePerQuestionChange?: (value: number | null) => void;
  /** Section's exam time per question (seconds). Shown in subheading when timeControlType is perQuestion. */
  sectionTimePerQuestionSeconds?: number | null;
  /** When true (practice page), show Set/Unlimited toggle for question count. */
  showUnlimitedOption?: boolean;
  questionCountMode?: "set" | "unlimited";
  onQuestionCountModeChange?: (mode: "set" | "unlimited") => void;
};

export function StemFiltersPanel({
  input,
  selectedSection,
  sectionCategories,
  selectedCategories,
  matchingCount,
  maxQuestionsInSection,
  selectedSectionLabel,
  performanceFilter,
  previewTimeLabel,
  sectionLabels,
  onSectionChange,
  onCategoryChange,
  onPerformanceFilterChange,
  onTimeModeChange,
  onTimeSpeedChange,
  onQuestionCountChange,
  onCustomTimeMinutesChange,
  actionButton,
  timeControlType = "set",
  onTimePerQuestionChange,
  sectionTimePerQuestionSeconds = null,
  showUnlimitedOption = false,
  questionCountMode = "set",
  onQuestionCountModeChange,
}: StemFiltersPanelProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        className={cn(
          "space-y-4 rounded-ucatShell bg-card p-4 text-card-foreground shadow-sm",
          "transition-shadow duration-200",
          UCAT_INTERACTION_EASE,
        )}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </h2>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Label className="text-sm font-medium">Section</Label>
            <p className="text-xs text-muted-foreground">
              UCAT section to include. The set will only contain questions from
              this section.
            </p>
          </div>
          <SearchableSelect<SectionKey>
            items={Object.keys(sectionLabels) as SectionKey[]}
            value={input.section}
            onValueChange={(item) => item && onSectionChange(item)}
            getItemLabel={(s) => sectionLabels[s]}
            getItemId={(s) => s}
            triggerClassName="w-full sm:w-48"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Label className="text-sm font-medium">Category</Label>
            <p className="text-xs text-muted-foreground">
              Filter by question categories. Only categories for the selected
              section are shown. All categories are selected by default.
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-48 justify-between text-left font-normal"
                disabled={!selectedSection}
              >
                {!selectedSection
                  ? "Select a section first"
                  : sectionCategories.length === 0
                    ? "No categories"
                    : input.categoryIds.length === 0
                      ? `All categories (${sectionCategories.length})`
                      : `${input.categoryIds.length} of ${sectionCategories.length} selected`}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <SearchableSelectInline<CategoryRow>
                items={sectionCategories}
                value={selectedCategories}
                onValueChange={onCategoryChange}
                getItemId={(c) => c.id}
                getItemLabel={(c) => c.name}
                searchPlaceholder="Search categories..."
                emptyMessage="No categories found"
                multiSelect
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Label className="text-sm font-medium">
              {timeControlType === "perQuestion" ? "Time per question" : "Time"}
            </Label>
            <p className="text-xs text-muted-foreground">
              {timeControlType === "perQuestion"
                ? sectionTimePerQuestionSeconds != null &&
                  sectionTimePerQuestionSeconds > 0
                  ? `Off: no time limit. Timed: exam pace is ${Number(sectionTimePerQuestionSeconds).toFixed(1)} sec per question for this section. In question stem mode, stem time = seconds × questions in stem.`
                  : "Off: no time limit. Set seconds per question for timed practice. In question stem mode, stem time = seconds × questions in stem."
                : "Off: no time limit. Exam: time limit matches UCAT pacing. Speed: scale exam timing. Custom: set your own limit."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {timeControlType === "perQuestion" ? (
              <>
                <SegmentedControl<"off" | "timed">
                  value={
                    input.timePerQuestionSeconds == null ||
                    input.timePerQuestionSeconds <= 0
                      ? "off"
                      : "timed"
                  }
                  onValueChange={(mode) => {
                    if (mode === "off") {
                      onTimePerQuestionChange?.(null);
                      return;
                    }
                    onTimePerQuestionChange?.(
                      input.timePerQuestionSeconds ??
                        sectionTimePerQuestionSeconds ??
                        90,
                    );
                  }}
                  options={[
                    { value: "off", label: "Off" },
                    { value: "timed", label: "Timed" },
                  ]}
                />
                {input.timePerQuestionSeconds != null &&
                input.timePerQuestionSeconds > 0 ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="number"
                      min={10}
                      max={600}
                      step={0.1}
                      value={Number(input.timePerQuestionSeconds).toFixed(1)}
                      onChange={(event) =>
                        onTimePerQuestionChange?.(
                          event.target.value === ""
                            ? null
                            : Math.max(
                                10,
                                Math.min(600, Number(event.target.value)),
                              ),
                        )
                      }
                      className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-right text-sm"
                    />
                    <span className="text-xs text-muted-foreground">
                      seconds
                    </span>
                  </label>
                ) : null}
              </>
            ) : (
              <>
                <SegmentedControl<TimeMode>
                  value={input.timeMode}
                  onValueChange={onTimeModeChange}
                  className="flex-wrap"
                  options={[
                    {
                      value: "off",
                      label: "Off",
                      infoTooltip: "No time limit. Take as long as you need.",
                    },
                    {
                      value: "exam",
                      label: "Exam",
                      infoTooltip:
                        "Time limit matches UCAT pacing for this section.",
                    },
                    {
                      value: "speed",
                      label: "Speed",
                      infoTooltip:
                        "Scale exam timing. 1 = exam pace, 0.5 = 2× time, 0.1 = 10× time. Drag the slider to adjust.",
                    },
                    {
                      value: "custom",
                      label: "Custom",
                      infoTooltip:
                        "Set your own time limit. Defaults to the exam estimate when you switch.",
                    },
                  ]}
                />
                {input.timeMode === "speed" ? (
                  <div className="flex flex-col gap-1.5 w-full sm:w-48">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {(1 / (input.timeSpeedMultiplier ?? 1)).toFixed(1)}×
                        time
                      </span>
                    </div>
                    <Slider
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={[input.timeSpeedMultiplier ?? 1]}
                      onValueChange={([v]) => onTimeSpeedChange(v)}
                    />
                  </div>
                ) : input.timeMode === "custom" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="number"
                      min={1}
                      max={240}
                      value={input.customTimeMinutes ?? ""}
                      onChange={(event) =>
                        onCustomTimeMinutesChange(
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                      className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-right text-sm"
                    />
                    <span className="text-xs text-muted-foreground">
                      minutes
                    </span>
                  </label>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Label className="text-sm font-medium">Performance</Label>
          </div>
          <SegmentedControl<PerformanceFilter>
            value={performanceFilter}
            onValueChange={onPerformanceFilterChange}
            className="flex-wrap"
            options={[
              {
                value: "any",
                label: "Any",
                infoTooltip:
                  "Include all questions regardless of your past attempts.",
              },
              {
                value: "unanswered",
                label: "Unanswered",
                infoTooltip: "Only questions you haven't answered before.",
              },
              {
                value: "incorrect",
                label: "Incorrect",
                infoTooltip: "Only questions you've got wrong before.",
              },
            ]}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Label htmlFor="question-count" className="text-sm font-medium">
              Question count
            </Label>
            <p className="text-xs text-muted-foreground">
              {showUnlimitedOption
                ? "Set a fixed number or practice unlimited questions."
                : `Number of questions in the set (max ${maxQuestionsInSection} for this section). Actual total may be lower if there aren't enough matching questions.`}
            </p>
          </div>
          {showUnlimitedOption ? (
            <div className="flex flex-col gap-2">
              <SegmentedControl<"set" | "unlimited">
                value={questionCountMode}
                onValueChange={(mode) => onQuestionCountModeChange?.(mode)}
                options={[
                  { value: "set", label: "Set" },
                  { value: "unlimited", label: "Unlimited" },
                ]}
              />
              {questionCountMode === "set" && (
                <input
                  id="question-count"
                  type="number"
                  min={1}
                  max={maxQuestionsInSection}
                  value={input.questionCount}
                  onChange={(event) =>
                    onQuestionCountChange(Number(event.target.value))
                  }
                  className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              )}
            </div>
          ) : (
            <input
              id="question-count"
              type="number"
              min={1}
              max={maxQuestionsInSection}
              value={input.questionCount}
              onChange={(event) =>
                onQuestionCountChange(Number(event.target.value))
              }
              className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          )}
        </div>
      </section>

      <section
        className={cn(
          "space-y-4 rounded-ucatShell bg-card p-4 text-card-foreground shadow-sm",
          "transition-shadow duration-200",
          UCAT_INTERACTION_EASE,
        )}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Preview
        </h2>
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Section:</span> {selectedSectionLabel}
          </p>
          <p>
            <span className="font-medium">Categories:</span>{" "}
            {!selectedSection
              ? "—"
              : selectedCategories.length === 0
                ? "—"
                : selectedCategories.map((c) => c.name).join(", ")}
          </p>
          <p>
            <span className="font-medium">Questions:</span>{" "}
            {showUnlimitedOption && questionCountMode === "unlimited"
              ? `Unlimited (${matchingCount ?? "…"} available)`
              : `${input.questionCount} / ${matchingCount ?? "…"}`}
          </p>
          <p>
            <span className="font-medium">Time:</span> {previewTimeLabel}
          </p>
        </div>
        {actionButton}
      </section>
    </div>
  );
}
