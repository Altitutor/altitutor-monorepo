"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Switch, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@altitutor/ui";
import { ChevronLeft, Clock3, Eye, Gauge, Infinity as InfinityIcon, ListChecks, Rows3, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PracticeReviewTiming } from "@/features/practice/lib/session-storage";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import { formatSpeedPercentAsMultiplier } from "@/features/progress/lib/format-speed-multiplier";
import type { CategoryRow, PerformanceFilter } from "@/features/practice/hooks/use-practice-filters";
import type { SectionKey, PracticeSelectionInput, TimeMode } from "@/features/practice/model/types";
import {
  UCAT_HEADER_ICON_BUTTON,
  UCAT_PRIMARY_ACTION_BUTTON,
  ucatClickableCardClassName,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export type StemFiltersWizardStep = {
  step: number;
  title: string;
  subtitle: string;
  canGoBack: boolean;
  goBack: () => void;
  isTransitioning: boolean;
};

export type StemFiltersPanelProps = {
  input: PracticeSelectionInput;
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
  reviewTiming?: PracticeReviewTiming;
  onReviewTimingChange?: (timing: PracticeReviewTiming) => void;
  fixedQuestionCountLimit?: number | null;
  /** Hide the in-panel step title/back — parent owns the page header. */
  hideStepHeader?: boolean;
  /** Notifies the parent when the wizard step (and back handler) change. */
  onWizardStepChange?: (state: StemFiltersWizardStep) => void;
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

export const STEM_FILTERS_STEP_COPY = [
  {
    title: "Choose a section",
    subtitle: "Select a section, then switch off any categories you do not want.",
  },
  {
    title: "Choose your pace",
    subtitle: "Practice against the clock or work without a time limit.",
  },
  {
    title: "Shape your practice",
    subtitle: "Choose the session size and the questions to include.",
  },
  {
    title: "Choose when to review",
    subtitle: "See feedback as you go or review everything at the end.",
  },
  {
    title: "Review your setup",
    subtitle: "Check your choices before you begin.",
  },
] as const;

/** Slide distance for wizard card transitions (px). */
const STEP_SLIDE_PX = 64;

/**
 * Direction-aware card variants. `custom` must be passed so exit uses the
 * *new* navigation direction (inline exit objects keep the previous step's
 * direction and reverse the wrong way after back/forward mixes).
 */
const stepSlideVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * STEP_SLIDE_PX,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -STEP_SLIDE_PX,
  }),
};

/** Subtle title/subtitle crossfade — opacity only, no slide. */
const stepCopyFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

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
  reviewTiming,
  onReviewTimingChange,
  fixedQuestionCountLimit = null,
  hideStepHeader = false,
  onWizardStepChange,
}: StemFiltersPanelProps) {
  const [{ step, direction }, setWizard] = useState({ step: 0, direction: 1 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const reduceMotion = useReducedMotion();
  const hasReviewTimingStep =
    reviewTiming != null && onReviewTimingChange != null;
  const reviewStep = hasReviewTimingStep ? 3 : -1;
  const summaryStep = hasReviewTimingStep ? 4 : 3;
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
  }, [
    fixedCountMax,
    input.questionCount,
    onQuestionCountChange,
    questionCountMode,
  ]);

  function goToStep(nextStep: number) {
    if (isTransitioning || nextStep === step) return;
    setIsTransitioning(true);
    setWizard({ step: nextStep, direction: nextStep > step ? 1 : -1 });
  }

  const copy = hasReviewTimingStep
    ? (STEM_FILTERS_STEP_COPY[step] ?? STEM_FILTERS_STEP_COPY[0])
    : (STEM_FILTERS_STEP_COPY[step === 3 ? 4 : step] ??
      STEM_FILTERS_STEP_COPY[0]);

  useEffect(() => {
    if (!onWizardStepChange) return;
    onWizardStepChange({
      step,
      title: copy.title,
      subtitle: copy.subtitle,
      canGoBack: step > 0,
      goBack: () => goToStep(step - 1),
      isTransitioning,
    });
    // goToStep is recreated each render; intentionally sync on step/transition only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify parent of wizard step chrome
  }, [step, copy.title, copy.subtitle, isTransitioning, onWizardStepChange]);

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

  const copyTransition = {
    duration: reduceMotion ? 0 : 0.2,
    ease: [0.22, 1, 0.36, 1] as const,
  };
  const slideTransition = {
    duration: reduceMotion ? 0 : 0.24,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  return (
    <div className="min-h-[430px]">
      {hideStepHeader ? null : (
        <div className="flex items-start gap-3">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => goToStep(step - 1)}
              disabled={isTransitioning}
              aria-label="Go back"
              className={cn(
                UCAT_HEADER_ICON_BUTTON,
                "group shrink-0 [&_svg]:size-5",
              )}
            >
              <ChevronLeft className="h-5 w-5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
            </Button>
          ) : null}
          <div className="relative min-h-[3.75rem] min-w-0 flex-1">
            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={step}
                className="absolute inset-x-0 top-0"
                initial={stepCopyFade.initial}
                animate={stepCopyFade.animate}
                exit={stepCopyFade.exit}
                transition={copyTransition}
              >
                <h2 className="text-2xl font-semibold tracking-tight">
                  {copy.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {copy.subtitle}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className={cn("relative", hideStepHeader ? undefined : "mt-7")}>
        <div className="-mx-3 -my-3 overflow-hidden bg-background px-3 py-3">
          <AnimatePresence
            mode="wait"
            initial={false}
            custom={direction}
            onExitComplete={() => setIsTransitioning(false)}
          >
            <motion.div
              key={step}
              custom={direction}
              variants={stepSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
              className="bg-background"
            >
          {step === 0 ? (
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
                      className={ucatClickableCardClassName({ selected })}
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
                                <TooltipProvider delayDuration={200}>
                                  <div className="space-y-3">
                                    {sectionCategories.map((category) => {
                                      const checked = selectedCategories.some(
                                        (item) => item.id === category.id,
                                      );
                                      const name = (
                                        <span
                                          className={
                                            category.description
                                              ? "cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-2"
                                              : undefined
                                          }
                                        >
                                          {category.name}
                                        </span>
                                      );
                                      return (
                                        <label
                                          key={category.id}
                                          className="flex items-center justify-between gap-3 text-xs"
                                        >
                                          {category.description ? (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className="min-w-0 flex-1">
                                                  {name}
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent
                                                side="top"
                                                className="max-w-[280px] text-left"
                                              >
                                                {category.description}
                                              </TooltipContent>
                                            </Tooltip>
                                          ) : (
                                            <span className="min-w-0 flex-1">
                                              {name}
                                            </span>
                                          )}
                                          <Switch
                                            checked={checked}
                                            disabled={
                                              checked &&
                                              selectedCategories.length === 1
                                            }
                                            onCheckedChange={(nextChecked) =>
                                              toggleCategory(
                                                category,
                                                nextChecked,
                                              )
                                            }
                                          />
                                        </label>
                                      );
                                    })}
                                  </div>
                                </TooltipProvider>
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
          ) : null}

          {step === 1 ? (
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              <div
                onClick={(event) => {
                  if (!(event.target as HTMLElement).closest("button,input")) {
                    selectTiming(false);
                  }
                }}
                className={ucatClickableCardClassName({ selected: !isTimed })}
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
                className={ucatClickableCardClassName({ selected: isTimed })}
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
                      aria-label="UCAT exam pacing multiplier"
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
                          {formatSpeedPercentAsMultiplier(pace)}
                        </button>
                      ))}
                    </div>
                    <p className="mt-4 text-sm">
                      Questions will be paced at{" "}
                      {formatSpeedPercentAsMultiplier(pacingPercent)} exam speed.
                    </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </div>
          ) : null}

          {step === 2 ? (
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
                  className={ucatClickableCardClassName({
                    selected: questionCountMode === "unlimited",
                  })}
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
                className={ucatClickableCardClassName({
                  selected: !showUnlimitedOption || questionCountMode === "set",
                })}
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
          ) : null}

          {step === reviewStep ? (
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              {([
                {
                  value: "afterEachStem" as const,
                  title: "Review after each stem",
                  description:
                    "Submit a stem, see the answers, then continue.",
                  icon: Eye,
                },
                {
                  value: "atEnd" as const,
                  title: "Review all at the end",
                  description:
                    "Work continuously, then review when you finish.",
                  icon: Rows3,
                },
              ]).map((option) => {
                const Icon = option.icon;
                const selected = reviewTiming === option.value;
                return (
                  <div
                    key={option.value}
                    onClick={() => onReviewTimingChange?.(option.value)}
                    className={ucatClickableCardClassName({ selected })}
                  >
                    <button
                      type="button"
                      onClick={() => onReviewTimingChange?.(option.value)}
                      aria-pressed={selected}
                      className="w-full text-left"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <h3 className="mt-4 font-semibold">{option.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {step === summaryStep ? (
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
                    : selectedCategories
                        .map((category) => category.name)
                        .join(", "),
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
                ...(hasReviewTimingStep
                  ? [
                      [
                        "Review",
                        reviewTiming === "atEnd"
                          ? "All at the end"
                          : "After each stem",
                      ],
                    ]
                  : []),
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex w-full items-center justify-between gap-6 py-3 first:pt-0 last:pb-0"
                >
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-right text-sm font-medium">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
      </div>

      <div
        data-tour="practice-primary-action"
        className="mt-10 flex min-h-10 items-center justify-end"
      >
        {step < summaryStep ? (
          <Button
            type="button"
            onClick={() => goToStep(step + 1)}
            disabled={
              isTransitioning ||
              (step === 0 &&
                (!selectedSection || selectedCategories.length === 0))
            }
            className={UCAT_PRIMARY_ACTION_BUTTON}
          >
            Next
          </Button>
        ) : null}
        {step === summaryStep ? actionButton : null}
      </div>
    </div>
  );
}
