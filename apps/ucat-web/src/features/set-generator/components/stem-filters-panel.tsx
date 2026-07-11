"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Switch } from "@altitutor/ui";
import { ArrowLeft, Clock3, Gauge, Infinity as InfinityIcon, ListChecks, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import type { CategoryRow, PerformanceFilter } from "@/features/set-generator/hooks/use-stem-filters";
import type { SectionKey, SetGeneratorInput, TimeMode } from "@/features/set-generator/model/types";
import { UCAT_PRIMARY_ACTION_BUTTON, ucatClickableCardClassName } from "@/lib/ucat-surface-motion";
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
  actionButton: React.ReactNode;
  timeControlType?: "set" | "perQuestion";
  onTimePerQuestionChange?: (value: number | null) => void;
  sectionTimePerQuestionSeconds?: number | null;
  showUnlimitedOption?: boolean;
  questionCountMode?: "set" | "unlimited";
  onQuestionCountModeChange?: (mode: "set" | "unlimited") => void;
  fixedQuestionCountLimit?: number | null;
};

const sectionDescriptions: Record<SectionKey, string> = {
  verbal_reasoning: "Read and reason from written passages.",
  decision_making: "Apply logic and evaluate information.",
  quantitative_reasoning: "Solve problems using numerical data.",
  situational_judgement: "Assess professional scenarios.",
};

const performanceOptions: Array<{ value: PerformanceFilter; label: string }> = [
  { value: "unanswered", label: "Unanswered" },
  { value: "incorrect", label: "Previously incorrect" },
  { value: "any", label: "All questions" },
];

const pacingSteps = [25, 50, 75, 100, 125, 150, 175, 200] as const;

function selectedCardClassName(selected: boolean) {
  return cn(
    selected && "!bg-muted/40 !ring-2 !ring-primary/30 shadow-md",
  );
}

export function StemFiltersPanel({
  input,
  selectedSection,
  sectionCategories,
  selectedCategories,
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
  actionButton,
  timeControlType = "set",
  onTimePerQuestionChange,
  sectionTimePerQuestionSeconds = null,
  showUnlimitedOption = false,
  questionCountMode = "set",
  onQuestionCountModeChange,
  fixedQuestionCountLimit = null,
}: StemFiltersPanelProps) {
  const [{ step, direction }, setWizard] = useState({ step: 0, direction: 1 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const reduceMotion = useReducedMotion();
  const fixedCountMax = Math.max(
    1,
    Math.min(
      maxQuestionsInSection,
      fixedQuestionCountLimit ?? maxQuestionsInSection,
    ),
  );
  const isTimed =
    timeControlType === "perQuestion"
      ? (input.timePerQuestionSeconds ?? 0) > 0
      : input.timeMode !== "off";
  const pacingPercent =
    timeControlType === "perQuestion"
      ? sectionTimePerQuestionSeconds && input.timePerQuestionSeconds
        ? Math.round(
            (sectionTimePerQuestionSeconds / input.timePerQuestionSeconds) * 100,
          )
        : 100
      : Math.round((input.timeSpeedMultiplier ?? 1) * 100);

  useEffect(() => {
    if (questionCountMode === "set" && input.questionCount > fixedCountMax) {
      onQuestionCountChange(fixedCountMax);
    }
  }, [fixedCountMax, input.questionCount, onQuestionCountChange, questionCountMode]);

  function goToStep(nextStep: number) {
    if (isTransitioning || nextStep === step) return;
    setIsTransitioning(true);
    setWizard({ step: nextStep, direction: nextStep > step ? 1 : -1 });
  }

  function selectTiming(timed: boolean) {
    if (timeControlType === "perQuestion") {
      onTimePerQuestionChange?.(
        timed ? (sectionTimePerQuestionSeconds ?? 90) : null,
      );
      return;
    }
    onTimeModeChange(timed ? "exam" : "off");
    if (timed) onTimeSpeedChange(1);
  }

  function setPacing(percent: number) {
    const multiplier = percent / 100;
    if (timeControlType === "perQuestion") {
      const examSeconds = sectionTimePerQuestionSeconds ?? 90;
      onTimePerQuestionChange?.(examSeconds / multiplier);
      return;
    }
    onTimeModeChange("speed");
    onTimeSpeedChange(multiplier);
  }

  function toggleCategory(category: CategoryRow, checked: boolean) {
    if (checked) {
      onCategoryChange([...selectedCategories, category]);
      return;
    }
    if (selectedCategories.length > 1) {
      onCategoryChange(
        selectedCategories.filter((item) => item.id !== category.id),
      );
    }
  }

  const performanceToggle = (
    <div className="mt-5">
      <SegmentedControl<PerformanceFilter>
        value={performanceFilter}
        onValueChange={onPerformanceFilterChange}
        className="flex-wrap"
        options={performanceOptions}
      />
    </div>
  );

  return (
    <div className="min-h-[430px]">
      <AnimatePresence
        mode="wait"
        custom={direction}
        onExitComplete={() => setIsTransitioning(false)}
      >
        <motion.div
          key={step}
          custom={direction}
          initial={reduceMotion ? false : { opacity: 0, x: direction * 64 }}
          animate={{ opacity: 1, x: 0 }}
          exit={
            reduceMotion
              ? { opacity: 1, x: 0 }
              : { opacity: 0, x: direction * -64 }
          }
          transition={{
            duration: reduceMotion ? 0 : 0.24,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
        {step === 0 ? (
          <div className="space-y-7">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Choose a section
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a section, then switch off any categories you do not want.
              </p>
            </div>

            <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(sectionLabels) as SectionKey[]).map((section) => {
                const selected = input.section === section;
                return (
                  <motion.div
                    key={section}
                    className="h-full"
                  >
                    <div
                      onClick={(event) => {
                        if (
                          !(event.target as HTMLElement).closest(
                            "button,input,[role='switch']",
                          )
                        ) {
                          onSectionChange(section);
                        }
                      }}
                      className={cn(
                        ucatClickableCardClassName(),
                        selectedCardClassName(selected),
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSectionChange(section)}
                        aria-pressed={selected}
                        className="w-full text-left"
                      >
                        <ListChecks className="h-5 w-5 text-muted-foreground" />
                        <h3 className="mt-4 font-semibold">
                          {sectionLabels[section]}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {sectionDescriptions[section]}
                        </p>
                      </button>
                      <AnimatePresence initial={false}>
                        {selected ? (
                          <motion.div
                            initial={
                              reduceMotion
                                ? false
                                : { opacity: 0, height: 0, y: -6 }
                            }
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -6 }}
                            transition={{
                              duration: reduceMotion ? 0 : 0.22,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="w-full overflow-hidden"
                          >
                            <div className="mt-5 pt-1">
                              <p className="mb-3 text-xs font-medium text-muted-foreground">
                                Categories
                              </p>
                              {sectionCategories.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Loading…
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {sectionCategories.map((category) => {
                                    const checked = selectedCategories.some(
                                      (item) => item.id === category.id,
                                    );
                                    return (
                                      <label
                                        key={category.id}
                                        className="flex items-center justify-between gap-3 text-xs"
                                      >
                                        <span>{category.name}</span>
                                        <Switch
                                          checked={checked}
                                          disabled={
                                            checked && selectedCategories.length === 1
                                          }
                                          onCheckedChange={(nextChecked) =>
                                            toggleCategory(category, nextChecked)
                                          }
                                        />
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-7">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Choose your pace
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Practise against the clock or work without a time limit.
              </p>
            </div>
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              <div
                onClick={(event) => {
                  if (!(event.target as HTMLElement).closest("button,input")) {
                    selectTiming(false);
                  }
                }}
                className={cn(
                  ucatClickableCardClassName(),
                  selectedCardClassName(!isTimed),
                )}
              >
                <button
                  type="button"
                  onClick={() => selectTiming(false)}
                  aria-pressed={!isTimed}
                  className="w-full text-left"
                >
                  <TimerOff className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold">Untimed</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Take as long as you need.
                  </p>
                </button>
              </div>
              <motion.div
                onClick={(event) => {
                  if (!(event.target as HTMLElement).closest("button,input")) {
                    selectTiming(true);
                  }
                }}
                className={cn(
                  ucatClickableCardClassName(),
                  selectedCardClassName(isTimed),
                )}
                transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              >
                <button
                  type="button"
                  onClick={() => selectTiming(true)}
                  aria-pressed={isTimed}
                  className="w-full text-left"
                >
                  <Clock3 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold">Timed</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set your pace relative to the UCAT exam.
                  </p>
                </button>
                <AnimatePresence initial={false}>
                  {isTimed ? (
                    <motion.div
                      initial={
                        reduceMotion ? false : { opacity: 0, height: 0, y: -6 }
                      }
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -6 }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.22,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="mt-5 w-full overflow-hidden pt-1"
                    >
                    <input
                      type="range"
                      min={25}
                      max={200}
                      step={25}
                      value={pacingPercent}
                      onChange={(event) => setPacing(Number(event.target.value))}
                      className="w-full accent-primary"
                      aria-label="UCAT exam pacing percentage"
                    />
                    <div className="mt-2 grid grid-cols-8">
                      {pacingSteps.map((pace) => (
                        <button
                          key={pace}
                          type="button"
                          onClick={() => setPacing(pace)}
                          className={cn(
                            "flex flex-col items-center gap-1 text-[10px] text-muted-foreground transition-colors",
                            pace === pacingPercent && "font-semibold text-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-px bg-border",
                              pace === pacingPercent && "h-3 bg-primary",
                            )}
                          />
                          {pace}%
                        </button>
                      ))}
                    </div>
                    <p className="mt-4 text-sm">
                      Questions will be paced at {pacingPercent}% of the UCAT exam
                      speed.
                    </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-7">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Shape your practice
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the session size and the questions to include.
              </p>
            </div>
            <div
              className={cn(
                "grid items-stretch gap-4",
                showUnlimitedOption && "sm:grid-cols-2",
              )}
            >
              {showUnlimitedOption ? (
                <motion.div
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest("button,input,[role='tab']")) {
                      onQuestionCountModeChange?.("unlimited");
                    }
                  }}
                  className={cn(
                    ucatClickableCardClassName(),
                    selectedCardClassName(questionCountMode === "unlimited"),
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onQuestionCountModeChange?.("unlimited")}
                    aria-pressed={questionCountMode === "unlimited"}
                    className="w-full text-left"
                  >
                    <InfinityIcon className="h-5 w-5 text-muted-foreground" />
                    <h3 className="mt-4 font-semibold">Unlimited</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Continue until you decide to stop.
                    </p>
                  </button>
                  <AnimatePresence initial={false}>
                    {questionCountMode === "unlimited" ? (
                      <motion.div
                        initial={
                          reduceMotion ? false : { opacity: 0, height: 0, y: -6 }
                        }
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -6 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.22,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="w-full overflow-hidden"
                      >
                        {performanceToggle}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              ) : null}

              <motion.div
                onClick={(event) => {
                  if (!(event.target as HTMLElement).closest("button,input,[role='tab']")) {
                    onQuestionCountModeChange?.("set");
                  }
                }}
                className={cn(
                  ucatClickableCardClassName(),
                  selectedCardClassName(
                    !showUnlimitedOption || questionCountMode === "set",
                  ),
                )}
              >
                <button
                  type="button"
                  onClick={() => onQuestionCountModeChange?.("set")}
                  aria-pressed={!showUnlimitedOption || questionCountMode === "set"}
                  className="w-full text-left"
                >
                  <Gauge className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold">Fixed set</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a specific number of questions.
                  </p>
                </button>
                <AnimatePresence initial={false}>
                  {(!showUnlimitedOption || questionCountMode === "set") ? (
                    <motion.div
                      initial={
                        reduceMotion ? false : { opacity: 0, height: 0, y: -6 }
                      }
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -6 }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.22,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="mt-5 w-full overflow-hidden pt-1"
                    >
                    <label className="flex items-center justify-between gap-4 text-sm">
                      <span>Number of questions</span>
                      <input
                        type="number"
                        min={1}
                        max={fixedCountMax}
                        value={input.questionCount}
                        onChange={(event) =>
                          onQuestionCountChange(Number(event.target.value))
                        }
                        className="w-24 rounded-ucatControl border border-border bg-background px-3 py-2 text-right font-semibold"
                      />
                    </label>
                    {performanceToggle}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-7">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Review your setup
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check your choices before you begin.
              </p>
            </div>
            <div
              className={ucatClickableCardClassName({
                interactive: false,
                className: "gap-0",
              })}
            >
              {[
                ["Section", selectedSectionLabel],
                [
                  "Categories",
                  selectedCategories.length === sectionCategories.length
                    ? "All categories"
                    : selectedCategories.map((category) => category.name).join(", "),
                ],
                ["Timing", previewTimeLabel],
                [
                  "Questions",
                  showUnlimitedOption && questionCountMode === "unlimited"
                    ? "Unlimited"
                    : `${input.questionCount}`,
                ],
                [
                  "Performance",
                  performanceOptions.find(
                    (option) => option.value === performanceFilter,
                  )?.label ?? "All questions",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex w-full items-center justify-between gap-6 py-3 first:pt-0 last:pb-0"
                >
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-right text-sm font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 flex min-h-10 items-center justify-between">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => goToStep(step - 1)}
            disabled={isTransitioning}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        ) : null}
        {step < 3 ? (
          <Button
            type="button"
            onClick={() => goToStep(step + 1)}
            disabled={
              isTransitioning ||
              (step === 0 &&
                (!selectedSection || selectedCategories.length === 0))
            }
            className={cn(UCAT_PRIMARY_ACTION_BUTTON, "ml-auto")}
          >
            Next
          </Button>
        ) : null}
        {step === 3 ? (
          <div className="ml-auto">{actionButton}</div>
        ) : null}
      </div>
    </div>
  );
}
