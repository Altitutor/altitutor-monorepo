"use client";

import React, { type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SearchableSelect } from "@altitutor/ui";
import { Check } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import {
  UCAT_CARD_CHROME,
  UCAT_PRIMARY_ACTION_BUTTON,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export type GoalYearOption = { year: number };

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
  const selectedYear =
    yearOptions.find((option) => option.year === testYear) ?? null;
  const selectTriggerClass = cn(
    STUDY_SETUP_FIELD_CLASS,
    "h-auto justify-between font-normal hover:bg-muted [&_svg]:text-muted-foreground",
  );

  return (
    <div className={cn(UCAT_CARD_CHROME, "space-y-6 p-6 sm:p-8")}>
      <label
        className="block space-y-2 text-sm text-muted-foreground"
        htmlFor={`${idPrefix}-target`}
      >
        <span>Target UCAT score</span>
        <input
          id={`${idPrefix}-target`}
          type="number"
          min={900}
          max={2700}
          step={10}
          required
          value={targetScore}
          disabled={disabled}
          onChange={(event) => onTargetScoreChange(Number(event.target.value))}
          className={STUDY_SETUP_FIELD_CLASS}
        />
      </label>

      <div>
        <button
          type="button"
          disabled={disabled}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline disabled:opacity-50"
          onClick={onTargetUnsure}
        >
          Not sure what to set?
        </button>
        <AnimatePresence initial={false}>
          {targetUnsure ? (
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, height: 0, y: -4 }}
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
              <input
                id={`${idPrefix}-date`}
                type="date"
                min={`${testYear}-01-01`}
                max={`${testYear}-12-31`}
                value={testDate}
                disabled={disabled}
                onChange={(event) => onTestDateChange(event.target.value)}
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
