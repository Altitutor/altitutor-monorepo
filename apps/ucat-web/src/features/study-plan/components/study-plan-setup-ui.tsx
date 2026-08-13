"use client";

import React, { type ReactNode, useEffect, useMemo, useState } from "react";
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

export type GoalYearOption = { year: number };

export const STUDY_PLAN_TEST_DATE_PLACEHOLDER = "Pick date";
export const STUDY_PLAN_TEST_DATE_INPUT_PLACEHOLDER = "e.g. 2 Jul or 2/7";

export const STUDY_SETUP_FIELD_CLASS =
  "w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-foreground outline-none transition-[border-color,box-shadow,background-color] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:focus:border-accent/50 dark:focus:ring-accent/20";

export const STUDY_SETUP_PRIMARY_BUTTON_CLASS = UCAT_PRIMARY_ACTION_BUTTON;

export const STUDY_SETUP_GHOST_BUTTON_CLASS =
  "rounded-ucatControl px-4 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  const scoreProgress = ((targetScore - 900) / (2700 - 900)) * 100;
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
      parsedScore >= 900 &&
      parsedScore <= 2700
    ) {
      onTargetScoreChange(parsedScore);
    }
  }

  return (
    <div className={cn(UCAT_CARD_CHROME, "space-y-6 p-6 sm:p-8")}>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary dark:text-accent">
            Your working target
          </p>
          <label className="mt-2 flex items-baseline gap-2">
            <span className="sr-only">Target UCAT score</span>
            <input
              id={`${idPrefix}-target`}
              type="number"
              inputMode="numeric"
              min={900}
              max={2700}
              step={10}
              required
              aria-label="Target UCAT score"
              value={targetScoreDraft}
              disabled={disabled}
              onChange={(event) => updateTargetScoreDraft(event.target.value)}
              onBlur={() => setTargetScoreDraft(String(targetScore))}
              className="w-40 rounded-md bg-transparent text-5xl font-black tabular-nums tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
            <span className="text-sm font-medium text-muted-foreground">
              / 2700
            </span>
          </label>
          <button
            type="button"
            disabled={disabled}
            className="mt-3 text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline disabled:opacity-50"
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
                className="mt-2 overflow-hidden rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground"
              >
                We’ll use 2200 as a sensible working target. It is not a
                prediction, and you can change it any time.
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="rounded-2xl bg-muted/55 p-5">
          <div className="relative pb-8 pt-5">
            <div className="h-4 overflow-hidden rounded-full bg-gradient-to-r from-accent/35 via-accent/70 to-accent" />
            <div
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${scoreProgress}%` }}
            >
              <div className="rounded-md bg-primary px-2 py-1 text-xs font-bold tabular-nums text-primary-foreground shadow dark:bg-accent dark:text-accent-foreground">
                {targetScore}
              </div>
              <div className="mx-auto h-7 w-0.5 bg-primary dark:bg-accent" />
            </div>
            <input
              type="range"
              min={900}
              max={2700}
              step={10}
              value={targetScore}
              disabled={disabled}
              onChange={(event) =>
                onTargetScoreChange(Number(event.target.value))
              }
              aria-label="Target UCAT score"
              className="absolute inset-x-0 top-3 h-7 w-full cursor-pointer opacity-0"
            />
            <div className="mt-3 grid grid-cols-3 text-[11px] font-semibold text-muted-foreground">
              <span>
                900
                <br />
                lowest total
              </span>
              <span className="text-center">
                1800
                <br />
                scale midpoint
              </span>
              <span className="text-right">
                2700
                <br />
                highest total
              </span>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your total combines three cognitive subtests, each scored from 300
            to 900. Choose a working goal now—you can change it later.
          </p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {targetScore < 2000 ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            role="alert"
            className="flex overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
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

      <div className="space-y-2 text-sm text-muted-foreground">
        <span className="block">UCAT year</span>
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
          triggerClassName={selectTriggerClass}
          contentWidth="var(--radix-popover-trigger-width)"
        />
      </div>

      <AnimatePresence initial={false}>
        {testYear != null ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.24 }}
            className="overflow-hidden"
          >
            <label
              className="block space-y-2 text-sm text-muted-foreground"
              htmlFor={`${idPrefix}-date`}
            >
              <span>Exact date (optional)</span>
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
              <span className="block text-xs text-muted-foreground/75">
                Leave this blank if you do not know your date yet.
              </span>
            </label>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
