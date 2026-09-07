"use client";

import React, { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SearchableSelect, SmartDatePickerField } from "@altitutor/ui";
import { AlertTriangle, Check } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import {
  UCAT_CARD_CHROME,
  UCAT_PRIMARY_ACTION_BUTTON,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { testDateBounds } from "@/features/study-plan/lib/test-date-bounds";
import {
  TARGET_SCORE_MAX,
  TARGET_SCORE_MIN,
  TARGET_SCORE_STEP,
} from "@/features/study-plan/lib/target-score";

export type GoalYearOption = { year: number };

export const STUDY_PLAN_TEST_DATE_PLACEHOLDER = "Pick date";
export const STUDY_PLAN_TEST_DATE_INPUT_PLACEHOLDER = "e.g. 2 Jul or 2/7";

export const STUDY_SETUP_FIELD_CLASS =
  "w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-foreground outline-none transition-[border-color,box-shadow,background-color] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:focus:border-accent/50 dark:focus:ring-accent/20";

export const STUDY_SETUP_PRIMARY_BUTTON_CLASS = UCAT_PRIMARY_ACTION_BUTTON;

export const STUDY_SETUP_GHOST_BUTTON_CLASS =
  "rounded-ucatControl px-4 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StudyPlanContinueButton({
  blockedReason,
  pending = false,
  children,
  onClick,
}: {
  blockedReason: string | null;
  pending?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  const [revealedReason, setRevealedReason] = useState<string | null>(null);
  const reasonId = `${useId()}-blocked-reason`;
  const blocked = Boolean(blockedReason);
  const inactive = blocked || pending;
  const reasonToShow = blocked ? revealedReason : null;

  useEffect(() => {
    if (!blocked) setRevealedReason(null);
  }, [blocked]);

  return (
    <div className="flex min-w-0 flex-col items-end gap-2">
      {reasonToShow ? (
        <p
          id={reasonId}
          role="status"
          className="max-w-xs text-right text-sm text-foreground"
        >
          {reasonToShow}
        </p>
      ) : null}
      <button
        type="button"
        className={cn(
          STUDY_SETUP_PRIMARY_BUTTON_CLASS,
          inactive &&
            "cursor-not-allowed opacity-60 hover:shadow-none motion-safe:hover:scale-100",
        )}
        aria-disabled={inactive}
        aria-describedby={reasonToShow ? reasonId : undefined}
        onClick={() => {
          if (pending) return;
          if (blockedReason) {
            setRevealedReason(blockedReason);
            return;
          }
          onClick();
        }}
      >
        {children}
      </button>
    </div>
  );
}

export function StudyPlanSetupShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-y-auto bg-background px-4 py-8 text-foreground transition-colors sm:px-6 sm:py-12">
      <NoiseOverlay />
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center justify-center">
        {children}
      </div>
    </main>
  );
}

export function StudyPlanStepIndicator({
  activeStep,
  stepCount,
}: {
  activeStep: number;
  stepCount: number;
}) {
  return (
    <div
      className="mb-10 flex items-center gap-3"
      aria-label={`Step ${activeStep} of ${stepCount}`}
    >
      {Array.from({ length: stepCount }, (_, index) => {
        const step = index + 1;
        const complete = step < activeStep;
        const active = step === activeStep;
        return (
          <div key={step} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300",
                active &&
                  "scale-105 bg-primary text-primary-foreground dark:bg-accent dark:text-primary-foreground",
                complete &&
                  "bg-primary/15 text-primary dark:bg-accent/20 dark:text-accent",
                !active && !complete && "bg-muted text-muted-foreground",
              )}
            >
              {complete ? <Check className="h-3.5 w-3.5" aria-hidden /> : step}
            </div>
            {step < stepCount ? (
              <div
                className={cn(
                  "h-px w-12 transition-colors duration-300",
                  complete ? "bg-primary/40 dark:bg-accent/40" : "bg-border",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const GOAL_FIELD_LABEL_CLASS =
  "text-base font-semibold tracking-tight text-foreground";

function GoalFieldRow({
  label,
  labelId,
  description,
  align = "start",
  className,
  children,
}: {
  label: string;
  labelId: string;
  description?: ReactNode;
  align?: "start" | "center";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-8",
        align === "center" ? "sm:items-center" : "sm:items-start",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <p id={labelId} className={GOAL_FIELD_LABEL_CLASS}>
          {label}
        </p>
        {description}
      </div>
      <div className="min-w-0 w-full">{children}</div>
    </div>
  );
}

export function StudyPlanGoalFields({
  idPrefix,
  targetScore,
  targetUnsure,
  testYear,
  testDate,
  yearOptions,
  disabled = false,
  onTargetScoreChange,
  onTargetUnsure,
  onTestYearChange,
  onTestDateChange,
}: {
  idPrefix: string;
  targetScore: number;
  targetUnsure: boolean;
  testYear: number | null;
  testDate: string;
  yearOptions: GoalYearOption[];
  disabled?: boolean;
  onTargetScoreChange: (score: number) => void;
  onTargetUnsure: () => void;
  onTestYearChange: (year: number | null) => void;
  onTestDateChange: (date: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [targetScoreDraft, setTargetScoreDraft] = useState(
    String(targetScore),
  );
  const selectedYear =
    yearOptions.find((option) => option.year === testYear) ?? null;
  const testDateBoundsForYear = useMemo(
    () => (testYear != null ? testDateBounds(testYear) : null),
    [testYear],
  );
  const scoreProgress =
    ((targetScore - TARGET_SCORE_MIN) /
      (TARGET_SCORE_MAX - TARGET_SCORE_MIN)) *
    100;
  const yearLabelId = `${idPrefix}-year-label`;
  const dateLabelId = `${idPrefix}-date-label`;
  const targetLabelId = `${idPrefix}-target-label`;
  const selectTriggerClass = cn(
    STUDY_SETUP_FIELD_CLASS,
    "h-auto justify-between font-normal hover:bg-muted [&_svg]:text-muted-foreground",
  );

  useEffect(() => {
    setTargetScoreDraft(String(targetScore));
  }, [targetScore]);

  function updateTargetScoreDraft(value: string) {
    setTargetScoreDraft(value);
    const parsedScore = Number(value);
    if (
      value !== "" &&
      Number.isInteger(parsedScore) &&
      parsedScore >= TARGET_SCORE_MIN &&
      parsedScore <= TARGET_SCORE_MAX
    ) {
      onTargetScoreChange(parsedScore);
    }
  }

  return (
    <div className={cn(UCAT_CARD_CHROME, "p-6 sm:p-8")}>
      <div>
        <GoalFieldRow
          label="UCAT year"
          labelId={yearLabelId}
          align="center"
          className="border-b border-border/60 pb-6"
        >
          <SearchableSelect<GoalYearOption>
            items={yearOptions}
            value={selectedYear}
            onValueChange={(option) => {
              onTestYearChange(option?.year ?? null);
              onTestDateChange("");
            }}
            getItemLabel={(item) => String(item.year)}
            getItemId={(item) => String(item.year)}
            placeholder="Select your UCAT year"
            ariaLabel="UCAT year"
            searchPlaceholder="Search years…"
            emptyMessage="No matching year."
            disabled={disabled}
            fullWidth
            triggerClassName={selectTriggerClass}
            contentWidth="var(--radix-popover-trigger-width)"
          />
        </GoalFieldRow>

        <AnimatePresence initial={false}>
          {testYear != null ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.24 }}
              className="overflow-hidden"
            >
              <GoalFieldRow
                label="Exact date (optional)"
                labelId={dateLabelId}
                className="border-b border-border/60 py-6"
                description={
                  <p className="text-sm text-muted-foreground">
                    Leave this blank if you do not know your date yet.
                  </p>
                }
              >
                <div
                  role="group"
                  aria-labelledby={dateLabelId}
                  className="w-full min-w-0"
                >
                  <SmartDatePickerField
                    value={testDate || null}
                    onChange={(value) => onTestDateChange(value ?? "")}
                    valueFormat="date"
                    showPresets={false}
                    anchorYear={testYear}
                    minDate={testDateBoundsForYear?.minDate}
                    maxDate={testDateBoundsForYear?.maxDate}
                    placeholder={STUDY_PLAN_TEST_DATE_PLACEHOLDER}
                    inputPlaceholder={STUDY_PLAN_TEST_DATE_INPUT_PLACEHOLDER}
                    disabled={disabled}
                    className={STUDY_SETUP_FIELD_CLASS}
                  />
                </div>
              </GoalFieldRow>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <GoalFieldRow
          label="Target score"
          labelId={targetLabelId}
          className="pt-6"
          description={
            <div className="space-y-2">
              <button
                type="button"
                disabled={disabled}
                className="text-left text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline disabled:opacity-50"
                onClick={onTargetUnsure}
              >
                Not sure what to set?
              </button>
              <AnimatePresence initial={false}>
                {targetUnsure ? (
                  <motion.p
                    initial={
                      reduceMotion ? false : { opacity: 0, height: 0, y: -4 }
                    }
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -4 }}
                    transition={{ duration: reduceMotion ? 0 : 0.24 }}
                    className="overflow-hidden text-sm text-muted-foreground"
                  >
                    We’ll use 2200 as a sensible working target. It is not a
                    prediction, and you can change it any time.
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
          }
        >
          <div className="w-full min-w-0">
            <label className="flex items-baseline gap-2">
              <span className="sr-only">Target UCAT score</span>
              <input
                id={`${idPrefix}-target`}
                type="number"
                inputMode="numeric"
                min={TARGET_SCORE_MIN}
                max={TARGET_SCORE_MAX}
                step={TARGET_SCORE_STEP}
                required
                aria-label="Target UCAT score"
                value={targetScoreDraft}
                disabled={disabled}
                onChange={(event) => updateTargetScoreDraft(event.target.value)}
                onBlur={() => setTargetScoreDraft(String(targetScore))}
                className="w-40 max-w-full bg-transparent text-5xl font-black tabular-nums tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
              <span className="text-sm font-medium text-muted-foreground">
                / {TARGET_SCORE_MAX}
              </span>
            </label>

            <div className="relative mt-4">
              <div className="relative h-7">
                <div className="absolute inset-x-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-accent/35 via-accent/70 to-accent" />
                <div
                  className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm ring-2 ring-background dark:bg-accent"
                  style={{
                    left: `calc(0.5rem + (100% - 1rem) * ${scoreProgress / 100})`,
                  }}
                />
                <input
                  type="range"
                  min={TARGET_SCORE_MIN}
                  max={TARGET_SCORE_MAX}
                  step={TARGET_SCORE_STEP}
                  value={targetScore}
                  disabled={disabled}
                  onChange={(event) =>
                    onTargetScoreChange(Number(event.target.value))
                  }
                  aria-label="Adjust target UCAT score"
                  className="absolute inset-y-0 left-2 right-2 h-7 w-[calc(100%-1rem)] cursor-pointer opacity-0"
                />
              </div>
              <div className="mt-2 grid grid-cols-3 text-[11px] font-semibold text-muted-foreground">
                <span>
                  {TARGET_SCORE_MIN}
                  <br />
                  lowest total
                </span>
                <span className="text-center">
                  {(TARGET_SCORE_MIN + TARGET_SCORE_MAX) / 2}
                </span>
                <span className="text-right">
                  {TARGET_SCORE_MAX}
                  <br />
                  highest total
                </span>
              </div>
            </div>
          </div>
        </GoalFieldRow>
      </div>

      <AnimatePresence initial={false}>
        {targetScore < 2000 ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            role="alert"
            className="mt-6 flex overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
          >
            <AlertTriangle
              className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            <p>
              <strong className="font-bold">This target may be too low.</strong>{" "}
              A score under 2000 is unlikely to be competitive for many
              interview offers. Criteria vary by university and can change
              each year, so check the universities you plan to apply to.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
