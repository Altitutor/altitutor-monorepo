"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Badge,
  Card,
  CardContent,
  Skeleton,
  Switch,
} from "@altitutor/ui";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Compass,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import { UCAT_STUDY_PLAN_DECIDED } from "@/features/onboarding/lib/activation-milestones";
import { AnimatedStepPanel } from "@/features/signup-onboarding/components/animated-step-panel";
import {
  SignupSuccessTransition,
  type SignupSuccessTransitionPhase,
  type StudyPlanCompletionStatus,
} from "@/features/signup-onboarding/components/signup-success-transition";
import { saveStudyPlan } from "@/features/study-plan/api/study-plan";
import {
  STUDY_SETUP_GHOST_BUTTON_CLASS,
  StudyPlanContinueButton,
  StudyPlanGoalFields,
  StudyPlanSetupShell,
  StudyPlanStepIndicator,
  type GoalYearOption,
} from "@/features/study-plan/components/study-plan-setup-ui";
import { StudyPlanTaskList } from "@/features/study-plan/components/study-plan-task-list";
import {
  STUDY_PLAN_QUERY_KEY,
  useStudyPlan,
} from "@/features/study-plan/hooks/use-study-plan";
import { inferPreferredMockWeekday } from "@/features/study-plan/lib/activation";
import type {
  StudyPlanAvailability,
  StudyPlanResponse,
  StudyPlanSjtPreference,
  StudyPlanWeekday,
} from "@/features/study-plan/model/types";
import { UcatClickableCardButton } from "@/shared/components/ucat-clickable-card";
import {
  UCAT_CARD_CHROME,
  UCAT_CLICKABLE_CARD_SELECTED,
  UCAT_DIALOG_PRIMARY_ACTION,
  UCAT_SURFACE_CARD,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const DAYS: Array<{ value: StudyPlanWeekday; label: string }> = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const DEFAULT_AVAILABILITY: StudyPlanAvailability[] = [
  { weekday: 1 },
  { weekday: 2 },
  { weekday: 4 },
  { weekday: 5 },
  { weekday: 6 },
];

const WORKSPACE_SETUP_ANIMATION_MS = 4_100;
const SJT_OPTIONS: Array<{
  value: StudyPlanSjtPreference;
  label: string;
  description: string;
}> = [
  {
    value: "normally",
    label: "Normally",
    description: "Include regular standalone SJT practice.",
  },
  {
    value: "a_little",
    label: "A little",
    description: "Keep SJT light outside full mocks.",
  },
  {
    value: "not_at_all",
    label: "Not at all",
    description: "Use full mocks for SJT and skip standalone SJT work.",
  },
];

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PlanReveal({ plan }: { plan: StudyPlanResponse }) {
  const router = useRouter();
  const profile = plan.profile;
  const firstTask = plan.tasks.find(
    (task) => task.status !== "completed" && task.status !== "skipped",
  );
  if (!profile) return null;
  const availableStudyDays = profile.availableDays.length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <Card
        className={cn(UCAT_CARD_CHROME, "overflow-hidden border-primary/20")}
      >
        <CardContent className="p-6 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <Badge className="mt-6" variant="secondary">
            Calibration phase
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Your Study plan is ready
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            It starts with learning and short realistic practice. As you
            complete real work, Altitutor will use that attempt evidence to
            sharpen what comes next.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-background/50 p-4">
              <Target className="h-4 w-4 text-primary" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">
                Working target
              </p>
              <p className="mt-1 text-xl font-semibold">
                {profile.targetScore}
              </p>
            </div>
            <div className="rounded-2xl border bg-background/50 p-4">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">
                Planning date
              </p>
              <p className="mt-1 font-semibold">
                {formatDate(profile.planningDate)}
              </p>
              {profile.planningDateIsProvisional ? (
                <Badge className="mt-2" variant="outline">
                  Provisional
                </Badge>
              ) : null}
            </div>
            <div className="rounded-2xl border bg-background/50 p-4">
              <Clock3 className="h-4 w-4 text-primary" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">
                Available study days
              </p>
              <p className="mt-1 text-xl font-semibold">
                {availableStudyDays} {availableStudyDays === 1 ? "day" : "days"}
                /week
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Session length adapts by phase
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {firstTask ? (
        <Card className={UCAT_CARD_CHROME}>
          <CardContent className="p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Compass className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold">Your first recommended task</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start here, or head to the dashboard and return when you are
                  ready.
                </p>
              </div>
            </div>
            <StudyPlanTaskList tasks={[firstTask]} today={plan.today} />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.replace("/dashboard")}>
          Go to dashboard
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function StudyPlanActivationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const query = useStudyPlan();
  const access = useUcatAccess();
  const completeMilestone = useCompleteOnboardingTour();
  const reduceMotion = useReducedMotion();
  const currentYear = new Date().getFullYear();
  const activationJourney = searchParams.get("activation") === "1";
  const planSetup = searchParams.get("section") === "plan";
  const fromSettings = searchParams.get("from") === "settings";
  const yearOptions = useMemo<GoalYearOption[]>(
    () =>
      [currentYear, currentYear + 1, currentYear + 2, currentYear + 3].map(
        (year) => ({ year }),
      ),
    [currentYear],
  );
  const [stage, setStage] = useState<
    "preference" | "destination" | "availability"
  >("preference");
  const [direction, setDirection] = useState(1);
  const [studyPlanEnabled, setStudyPlanEnabled] = useState<boolean | null>(
    null,
  );
  const [targetScore, setTargetScore] = useState(2200);
  const [targetUnsure, setTargetUnsure] = useState(false);
  const [testYear, setTestYear] = useState<number | null>(null);
  const [testDate, setTestDate] = useState("");
  const [sjtPreference, setSjtPreference] =
    useState<StudyPlanSjtPreference>("a_little");
  const [availability, setAvailability] =
    useState<StudyPlanAvailability[]>(DEFAULT_AVAILABILITY);
  const [savedPlan, setSavedPlan] = useState<StudyPlanResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [completion, setCompletion] = useState<{
    phase: SignupSuccessTransitionPhase;
    studyPlanStatus: StudyPlanCompletionStatus;
  } | null>(null);
  const [completionReady, setCompletionReady] = useState(false);
  const [completionMinimumElapsed, setCompletionMinimumElapsed] =
    useState(false);
  const hydratedProfileRef = useRef(false);
  const plan = savedPlan ?? query.data;
  const isPaidJourney =
    access.onlineTier === "unlimited" ||
    access.onlineTier === "unlimited_trial";
  const completionPhase = completion?.phase ?? null;
  const hasSavedGoal = Boolean(
    plan?.profile?.testYear && plan.profile.targetScore,
  );

  useEffect(() => {
    if (
      !planSetup &&
      plan?.profile &&
      !plan.profile.studyPlanEnabled &&
      !completion
    ) {
      router.replace("/dashboard");
    }
  }, [completion, plan?.profile, planSetup, router]);

  useEffect(() => {
    if (!plan?.profile || hydratedProfileRef.current) return;
    hydratedProfileRef.current = true;
    setTargetScore(plan.profile.targetScore);
    setTestYear(plan.profile.testYear);
    setTestDate(plan.profile.testDate ?? "");
    setSjtPreference(plan.profile.sjtPreference ?? "a_little");
    if (plan.profile.availableDays.length) {
      setAvailability(plan.profile.availableDays);
    }
  }, [plan?.profile]);

  useEffect(() => {
    if (completionPhase !== "confirming") return;
    const timer = window.setTimeout(
      () => setCompletionMinimumElapsed(true),
      WORKSPACE_SETUP_ANIMATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [completionPhase]);

  useEffect(() => {
    if (
      completionPhase !== "confirming" ||
      !completionReady ||
      !completionMinimumElapsed
    ) {
      return;
    }
    setCompletion((current) =>
      current ? { ...current, phase: "welcome" } : current,
    );
  }, [completionMinimumElapsed, completionPhase, completionReady]);

  function toggleDay(weekday: StudyPlanWeekday) {
    setAvailability((current) =>
      current.some((day) => day.weekday === weekday)
        ? current.filter((day) => day.weekday !== weekday)
        : [...current, { weekday }],
    );
  }

  function destinationAfterSetup(studyPlanStatus: StudyPlanCompletionStatus) {
    if (fromSettings) return "/settings/study-plan";
    return studyPlanStatus === "created" ? "/study-plan" : "/dashboard";
  }

  async function runWorkspaceSetupTransition(
    studyPlanStatus: StudyPlanCompletionStatus,
    readiness: Promise<unknown> = Promise.resolve(),
  ) {
    const destination = destinationAfterSetup(studyPlanStatus);
    if (!activationJourney) {
      await readiness;
      router.replace(destination);
      return;
    }
    setCompletionReady(false);
    setCompletionMinimumElapsed(false);
    setCompletion({ phase: "confirming", studyPlanStatus });
    router.prefetch(destination);
    await readiness.catch(() => undefined);
    setCompletionReady(true);
  }

  async function buildPlan() {
    if (!availability.length || testYear == null) return;
    setPending(true);
    setError(null);
    try {
      const nextPlan = await saveStudyPlan({
        studyPlanEnabled: true,
        targetScore,
        testYear,
        testDate: testDate || null,
        availableDays: availability,
        preferredMockWeekday: inferPreferredMockWeekday(availability),
        sjtPreference,
      });
      setSavedPlan(nextPlan);
      queryClient.setQueryData(STUDY_PLAN_QUERY_KEY, nextPlan);
      await completeMilestone.mutateAsync(UCAT_STUDY_PLAN_DECIDED);
      await runWorkspaceSetupTransition(
        "created",
        queryClient.invalidateQueries({ queryKey: STUDY_PLAN_QUERY_KEY }),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not build your Study plan.",
      );
    } finally {
      setPending(false);
    }
  }

  async function saveWithoutPlan() {
    if (testYear == null) return;
    setPending(true);
    setError(null);
    try {
      const nextPlan = await saveStudyPlan({
        studyPlanEnabled: false,
        targetScore,
        testYear,
        testDate: testDate || null,
        availableDays: [],
        preferredMockWeekday: 6,
        sjtPreference,
      });
      setSavedPlan(nextPlan);
      queryClient.setQueryData(STUDY_PLAN_QUERY_KEY, nextPlan);
      await completeMilestone.mutateAsync(UCAT_STUDY_PLAN_DECIDED);
      await runWorkspaceSetupTransition(
        "skipped",
        queryClient.invalidateQueries({ queryKey: STUDY_PLAN_QUERY_KEY }),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save your Study plan preference.",
      );
    } finally {
      setPending(false);
    }
  }

  async function declineStudyPlanWithoutSaving() {
    setPending(true);
    setError(null);
    try {
      await completeMilestone.mutateAsync(UCAT_STUDY_PLAN_DECIDED);
      if (activationJourney) {
        await runWorkspaceSetupTransition("skipped");
      } else {
        router.replace("/dashboard");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save your Study plan preference.",
      );
    } finally {
      setPending(false);
    }
  }

  function continueFromPreference() {
    if (studyPlanEnabled == null) return;
    // From settings we always collect a goal and write a profile for "manage
    // my own", so settings has a real row afterwards (not milestone-only).
    if (!studyPlanEnabled && !hasSavedGoal && !fromSettings) {
      void declineStudyPlanWithoutSaving();
      return;
    }
    if (!hasSavedGoal) {
      setDirection(1);
      setStage("destination");
      return;
    }
    if (studyPlanEnabled) {
      setDirection(1);
      setStage("availability");
      return;
    }
    void saveWithoutPlan();
  }

  if (completion) {
    return (
      <SignupSuccessTransition
        journey={isPaidJourney ? "paid" : "free"}
        occasion="signup"
        phase={completion.phase}
        isTakingLonger={false}
        error={null}
        onRetry={() => undefined}
        onComplete={() =>
          router.replace(destinationAfterSetup(completion.studyPlanStatus))
        }
        studyPlanStatus={completion.studyPlanStatus}
        preloadDashboard={completion.studyPlanStatus !== "created"}
      />
    );
  }

  if (query.isLoading && !savedPlan) {
    return (
      <StudyPlanSetupShell>
        <Skeleton className="h-[520px] w-full max-w-4xl rounded-3xl" />
      </StudyPlanSetupShell>
    );
  }

  if (query.isError && !savedPlan) {
    return (
      <StudyPlanSetupShell>
        <Alert variant="destructive" className="w-full max-w-2xl">
          <AlertTitle>Could not load Study plan setup</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      </StudyPlanSetupShell>
    );
  }

  if (!planSetup && plan?.profile?.studyPlanEnabled) {
    return (
      <StudyPlanSetupShell>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.45 }}
          className="w-full"
        >
          <PlanReveal plan={plan} />
        </motion.div>
      </StudyPlanSetupShell>
    );
  }

  if (!planSetup && plan?.profile && !plan.profile.studyPlanEnabled) {
    return (
      <StudyPlanSetupShell>
        <Skeleton className="h-64 w-full max-w-3xl rounded-3xl" />
      </StudyPlanSetupShell>
    );
  }

  const stepCount = hasSavedGoal ? 2 : 3;
  const activeStep =
    stage === "preference" ? 1 : stage === "destination" ? 2 : stepCount;
  const heading =
    stage === "preference"
      ? {
          kicker: `Study plan setup · 1 of ${stepCount}`,
          title: "How would you like to organise your study?",
          description:
            "Choose whether Altitutor should schedule adaptive work for you, or whether you’ll manage your own plan.",
        }
      : stage === "destination"
        ? {
            kicker: `Study plan setup · 2 of ${stepCount}`,
            title: "What are you working towards?",
            description:
              "Set your UCAT year and a working target score before we finish your study preference.",
          }
        : {
            kicker: `Study plan setup · ${stepCount} of ${stepCount}`,
            title: "When could you realistically study?",
            description:
              "Choose your usual study days and, optionally, the day you would prefer for full mocks.",
          };

  return (
    <StudyPlanSetupShell>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.3,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="w-full max-w-3xl"
      >
        <StudyPlanStepIndicator activeStep={activeStep} stepCount={stepCount} />
        <AnimatedStepPanel
          stepKey={`study-plan-heading-${stage}`}
          direction={direction}
        >
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary dark:text-accent">
              {heading.kicker}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {heading.title}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {heading.description}
            </p>
          </div>
        </AnimatedStepPanel>

        <motion.div
          layout={!reduceMotion}
          layoutDependency={stage}
          transition={{
            layout: reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 270, damping: 30, mass: 0.85 },
          }}
          className="relative"
        >
          <AnimatedStepPanel
            stepKey={`study-plan-cards-${stage}`}
            direction={direction}
            morphLayout
            slide={false}
          >
            {stage === "preference" ? (
              <div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <UcatClickableCardButton
                    selected={studyPlanEnabled === true}
                    icon={CalendarDays}
                    title="Build me a Study plan"
                    description="Altitutor schedules adaptive work around your availability and adjusts it as your performance changes."
                    showChevron={false}
                    onClick={() => setStudyPlanEnabled(true)}
                  />
                  <UcatClickableCardButton
                    selected={studyPlanEnabled === false}
                    icon={Compass}
                    title="I’ll manage my own plan"
                    description="Organise study yourself while Altitutor continues to suggest useful next activities."
                    showChevron={false}
                    onClick={() => setStudyPlanEnabled(false)}
                  />
                </div>
                <SetupError message={error} />
                <div className="mt-6 flex items-end justify-between gap-3">
                  {fromSettings ? (
                    <button
                      type="button"
                      className={STUDY_SETUP_GHOST_BUTTON_CLASS}
                      onClick={() => router.replace("/settings")}
                    >
                      <ArrowLeft className="mr-2 inline h-4 w-4" aria-hidden />
                      Back to settings
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={STUDY_SETUP_GHOST_BUTTON_CLASS}
                      onClick={() => setSkipDialogOpen(true)}
                    >
                      Skip for now
                    </button>
                  )}
                  <StudyPlanContinueButton
                    blockedReason={
                      studyPlanEnabled == null
                        ? "Choose how you’d like to organise your study first."
                        : null
                    }
                    pending={pending}
                    onClick={continueFromPreference}
                  >
                    {pending ? "Saving…" : "Next"}
                    {!pending ? (
                      <ArrowRight className="ml-2 inline h-4 w-4" aria-hidden />
                    ) : null}
                  </StudyPlanContinueButton>
                </div>
              </div>
            ) : stage === "destination" ? (
              <div>
                <StudyPlanGoalFields
                  idPrefix="study-plan-goal"
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
                <div
                  role="group"
                  aria-labelledby="sjt-preference-heading"
                  className={cn(UCAT_CARD_CHROME, "mt-4 p-5")}
                >
                  <h2
                    id="sjt-preference-heading"
                    className="text-sm font-semibold text-foreground"
                  >
                    How much standalone Situational Judgement practice do you
                    want?
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Situational Judgement does not count towards your UCAT
                    score, but some universities consider it separately.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {SJT_OPTIONS.map((option) => {
                      const selected = sjtPreference === option.value;
                      return (
                        <label
                          key={option.value}
                          className={cn(
                            "cursor-pointer rounded-xl border p-4 transition-colors",
                            selected
                              ? cn(
                                  "border-transparent ring-1",
                                  UCAT_CLICKABLE_CARD_SELECTED,
                                )
                              : "border-border bg-background/50 hover:bg-muted/60",
                          )}
                        >
                          <input
                            type="radio"
                            name="sjt-preference"
                            value={option.value}
                            checked={selected}
                            disabled={pending}
                            onChange={() => setSjtPreference(option.value)}
                            className="sr-only"
                          />
                          <span className="block text-sm font-semibold text-foreground">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            {option.description}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <SetupError message={error} />
                <div className="mt-6 flex items-end justify-between gap-3">
                  <BackButton
                    onClick={() => {
                      setDirection(-1);
                      setStage("preference");
                    }}
                  />
                  <StudyPlanContinueButton
                    blockedReason={
                      testYear == null
                        ? "Select your UCAT year to continue."
                        : null
                    }
                    pending={pending}
                    onClick={() => {
                      if (studyPlanEnabled) {
                        setDirection(1);
                        setStage("availability");
                      } else {
                        void saveWithoutPlan();
                      }
                    }}
                  >
                    {pending
                      ? "Saving…"
                      : studyPlanEnabled
                        ? "Choose my study week"
                        : "Save and finish"}
                    {!pending ? (
                      <ArrowRight className="ml-2 inline h-4 w-4" aria-hidden />
                    ) : null}
                  </StudyPlanContinueButton>
                </div>
              </div>
            ) : (
              <div>
                <div className="space-y-3">
                  {DAYS.map((day) => {
                    const available = availability.find(
                      (item) => item.weekday === day.value,
                    );
                    const enabled = Boolean(available);
                    return (
                      <div
                        key={day.value}
                        className={cn(
                          "flex items-center justify-between gap-4 rounded-ucatShell px-4 py-4 sm:px-5",
                          UCAT_SURFACE_CARD,
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Switch
                            checked={enabled}
                            disabled={pending}
                            onCheckedChange={() => toggleDay(day.value)}
                            aria-label={`Study on ${day.label}`}
                            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30 dark:data-[state=checked]:bg-accent"
                          />
                          <span className="text-sm text-foreground">
                            {day.label}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {enabled ? "Available" : "Rest day"}
                        </span>
                      </div>
                    );
                  })}
                  <div
                    className={cn(
                      "flex gap-3 rounded-ucatShell px-4 py-3 text-sm text-muted-foreground",
                      UCAT_SURFACE_CARD,
                      "bg-muted/40",
                    )}
                  >
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>
                      Choose the days you can normally study. Altitutor will
                      adjust the session length and number of practice blocks as
                      your readiness and exam date change.
                    </p>
                  </div>
                </div>
                <SetupError message={error} />
                <div className="mt-6 flex items-end justify-between gap-3">
                  <BackButton
                    onClick={() => {
                      setDirection(-1);
                      setStage(hasSavedGoal ? "preference" : "destination");
                    }}
                  />
                  <StudyPlanContinueButton
                    blockedReason={
                      availability.length
                        ? null
                        : "Choose at least one study day to continue."
                    }
                    pending={pending}
                    onClick={() => void buildPlan()}
                  >
                    {pending ? "Building…" : "Build my Study plan"}
                    {!pending ? (
                      <Sparkles className="ml-2 inline h-4 w-4" aria-hidden />
                    ) : null}
                  </StudyPlanContinueButton>
                </div>
              </div>
            )}
          </AnimatedStepPanel>
        </motion.div>
      </motion.div>

      <AlertDialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip Study plan setup?</AlertDialogTitle>
            <AlertDialogDescription>
              You can continue without deciding now and return from the
              dashboard. Altitutor will still suggest useful next steps.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep setting up</AlertDialogCancel>
            <AlertDialogAction
              className={UCAT_DIALOG_PRIMARY_ACTION}
              onClick={() => {
                setSkipDialogOpen(false);
                void (async () => {
                  setPending(true);
                  setError(null);
                  try {
                    await completeMilestone.mutateAsync(
                      UCAT_STUDY_PLAN_DECIDED,
                    );
                    await runWorkspaceSetupTransition("skipped");
                  } catch (caught) {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : "Could not save your Study plan preference.",
                    );
                  } finally {
                    setPending(false);
                  }
                })();
              }}
            >
              Skip for now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StudyPlanSetupShell>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={STUDY_SETUP_GHOST_BUTTON_CLASS}
      onClick={onClick}
    >
      <ArrowLeft className="mr-2 inline h-4 w-4" aria-hidden />
      Back
    </button>
  );
}

function SetupError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </p>
  );
}
