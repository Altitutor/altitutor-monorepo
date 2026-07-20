"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { Alert, AlertDescription, AlertTitle, Skeleton } from "@altitutor/ui";
import { ArrowLeft, ArrowRight, Target } from "lucide-react";
import { saveStudyPlan } from "@/features/study-plan/api/study-plan";
import {
  STUDY_PLAN_QUERY_KEY,
  useStudyPlan,
} from "@/features/study-plan/hooks/use-study-plan";
import {
  STUDY_SETUP_GHOST_BUTTON_CLASS,
  STUDY_SETUP_PRIMARY_BUTTON_CLASS,
  StudyPlanGoalFields,
  StudyPlanSetupShell,
  StudyPlanStepIndicator,
  type GoalYearOption,
} from "@/features/study-plan/components/study-plan-setup-ui";

export function UcatGoalSetupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useStudyPlan();
  const reduceMotion = useReducedMotion();
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo<GoalYearOption[]>(
    () =>
      [currentYear, currentYear + 1, currentYear + 2, currentYear + 3].map(
        (year) => ({ year }),
      ),
    [currentYear],
  );
  const [targetScore, setTargetScore] = useState(2200);
  const [targetUnsure, setTargetUnsure] = useState(false);
  const [testYear, setTestYear] = useState<number | null>(null);
  const [testDate, setTestDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const profile = query.data?.profile;
    if (!profile || hydratedRef.current) return;
    hydratedRef.current = true;
    setTargetScore(profile.targetScore);
    setTestYear(profile.testYear);
    setTestDate(profile.testDate ?? "");
  }, [query.data?.profile]);

  async function saveGoal() {
    if (testYear == null) return;
    setPending(true);
    setError(null);
    try {
      const existing = query.data?.profile;
      const nextPlan = await saveStudyPlan({
        studyPlanEnabled: existing?.studyPlanEnabled ?? false,
        studySuggestionsEnabled: existing?.studySuggestionsEnabled ?? true,
        targetScore,
        testYear,
        testDate: testDate || null,
        availableDays: existing?.availableDays ?? [],
        preferredMockWeekday: existing?.preferredMockWeekday ?? 6,
      });
      queryClient.setQueryData(STUDY_PLAN_QUERY_KEY, nextPlan);
      await queryClient.invalidateQueries({ queryKey: STUDY_PLAN_QUERY_KEY });
      router.replace("/dashboard");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save your UCAT goal.",
      );
    } finally {
      setPending(false);
    }
  }

  if (query.isLoading) {
    return (
      <StudyPlanSetupShell>
        <Skeleton className="h-[540px] w-full max-w-3xl rounded-3xl" />
      </StudyPlanSetupShell>
    );
  }

  if (query.isError) {
    return (
      <StudyPlanSetupShell>
        <Alert variant="destructive" className="w-full max-w-2xl">
          <AlertTitle>Could not load your UCAT goal</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      </StudyPlanSetupShell>
    );
  }

  return (
    <StudyPlanSetupShell>
      <motion.div
        layout={!reduceMotion}
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.3,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="w-full max-w-3xl"
      >
        <StudyPlanStepIndicator activeStep={1} stepCount={1} />
        <div className="mb-6">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary dark:text-accent">
            <Target className="h-4 w-4" aria-hidden />
            UCAT goal
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Set your UCAT year and target score
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Give your dashboard a clear destination. This stays separate from
            deciding how you want to organise your study.
          </p>
        </div>

        <StudyPlanGoalFields
          idPrefix="goal-setup"
          targetScore={targetScore}
          targetUnsure={targetUnsure}
          testYear={testYear}
          testDate={testDate}
          yearOptions={yearOptions}
          disabled={pending}
          onTargetScoreChange={(score) => {
            setTargetScore(score);
            setTargetUnsure(false);
          }}
          onTargetUnsure={() => {
            setTargetScore(2200);
            setTargetUnsure(true);
          }}
          onTestYearChange={setTestYear}
          onTestDateChange={setTestDate}
        />

        {error ? (
          <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className={STUDY_SETUP_GHOST_BUTTON_CLASS}
            onClick={() => router.replace("/dashboard")}
          >
            <ArrowLeft className="mr-2 inline h-4 w-4" aria-hidden />
            Back
          </button>
          <button
            type="button"
            className={STUDY_SETUP_PRIMARY_BUTTON_CLASS}
            disabled={pending || testYear == null}
            onClick={() => void saveGoal()}
          >
            {pending ? "Saving…" : "Save my goal"}
            {!pending ? (
              <ArrowRight className="ml-2 inline h-4 w-4" aria-hidden />
            ) : null}
          </button>
        </div>
      </motion.div>
    </StudyPlanSetupShell>
  );
}
