"use client";

import React, { useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  CardContent,
  Input,
  Label,
  SearchableSelect,
  Skeleton,
  Switch,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  Sparkles,
  Target,
} from "lucide-react";
import { saveStudyPlan } from "@/features/study-plan/api/study-plan";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import { inferPreferredMockWeekday } from "@/features/study-plan/lib/activation";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import { StudyPlanTaskList } from "@/features/study-plan/components/study-plan-task-list";
import type {
  StudyPlanAvailability,
  StudyPlanResponse,
  StudyPlanWeekday,
} from "@/features/study-plan/model/types";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { SignupSuccessTransition } from "@/features/signup-onboarding/components/signup-success-transition";

const DAYS: Array<{ value: StudyPlanWeekday; label: string; short: string }> = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

const DEFAULT_AVAILABILITY: StudyPlanAvailability[] = [
  { weekday: 1, maxMinutes: 60 },
  { weekday: 2, maxMinutes: 60 },
  { weekday: 3, maxMinutes: 60 },
  { weekday: 4, maxMinutes: 60 },
  { weekday: 5, maxMinutes: 60 },
];

type YearOption = { year: number };

function defaultMinutesForDay(day: StudyPlanWeekday): number {
  return day === 0 || day === 6 ? 120 : 60;
}

function ActivationShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-y-auto bg-marketing-charcoal px-4 py-8 sm:px-6 sm:py-12">
      <NoiseOverlay />
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center justify-center">
        {children}
      </div>
    </main>
  );
}

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
  const weeklyCapacity = profile.availableDays.reduce(
    (sum, day) => sum + day.maxMinutes,
    0,
  );

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
            It starts with learning and short representative practice. As you
            complete real work, Altitutor will use that Attempt evidence to
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
                Available capacity
              </p>
              <p className="mt-1 text-xl font-semibold">
                {weeklyCapacity} min/week
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                A ceiling, not a quota
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
  const reduceMotion = useReducedMotion();
  const currentYear = new Date().getFullYear();
  const activationJourney = searchParams.get("activation") === "1";
  const yearOptions = useMemo<YearOption[]>(
    () =>
      [currentYear, currentYear + 1, currentYear + 2, currentYear + 3].map(
        (year) => ({ year }),
      ),
    [currentYear],
  );
  const [stage, setStage] = useState<"destination" | "availability">(
    "destination",
  );
  const [targetScore, setTargetScore] = useState(2200);
  const [targetUnsure, setTargetUnsure] = useState(false);
  const [testYear, setTestYear] = useState<number | null>(null);
  const [testDate, setTestDate] = useState("");
  const [availability, setAvailability] =
    useState<StudyPlanAvailability[]>(DEFAULT_AVAILABILITY);
  const [savedPlan, setSavedPlan] = useState<StudyPlanResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const plan = savedPlan ?? query.data;
  const selectedYear =
    yearOptions.find((option) => option.year === testYear) ?? null;
  const isPaidJourney =
    access.onlineTier === "unlimited" ||
    access.onlineTier === "unlimited_trial" ||
    access.onlineTier === "pro";

  function toggleDay(weekday: StudyPlanWeekday) {
    setAvailability((current) =>
      current.some((day) => day.weekday === weekday)
        ? current.filter((day) => day.weekday !== weekday)
        : [
            ...current,
            { weekday, maxMinutes: defaultMinutesForDay(weekday) },
          ],
    );
  }

  function finishActivation() {
    if (activationJourney) {
      setShowCompletion(true);
      return;
    }
    router.replace("/dashboard");
  }

  async function buildPlan() {
    if (!availability.length || testYear == null) return;
    setPending(true);
    setError(null);
    try {
      const nextPlan = await saveStudyPlan({
        targetScore,
        testYear,
        testDate: testDate || null,
        availableDays: availability,
        preferredMockWeekday: inferPreferredMockWeekday(availability),
      });
      setSavedPlan(nextPlan);
      await queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
      if (activationJourney) setShowCompletion(true);
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

  if (showCompletion) {
    return (
      <SignupSuccessTransition
        journey={isPaidJourney ? "paid" : "free"}
        occasion="signup"
        phase="welcome"
        isTakingLonger={false}
        error={null}
        onRetry={() => undefined}
        onComplete={() => router.replace("/dashboard")}
      />
    );
  }

  if (query.isLoading && !savedPlan) {
    return (
      <ActivationShell>
        <Skeleton className="h-[520px] w-full max-w-4xl rounded-3xl" />
      </ActivationShell>
    );
  }

  if (query.isError && !savedPlan) {
    return (
      <ActivationShell>
        <Alert variant="destructive" className="w-full max-w-2xl">
          <AlertTitle>Could not load Study plan setup</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      </ActivationShell>
    );
  }

  if (plan?.profile) {
    return (
      <ActivationShell>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.45 }}
          className="w-full"
        >
          <PlanReveal plan={plan} />
        </motion.div>
      </ActivationShell>
    );
  }

  const heading =
    stage === "destination"
      ? {
          kicker: "Study plan setup · 1 of 2",
          title: "What are you working towards?",
          description:
            "Set a direction now. Your real results will keep calibrating what comes next.",
        }
      : {
          kicker: "Study plan setup · 2 of 2",
          title: "When could you realistically study?",
          description:
            "Choose your usual study days. The time you enter is a ceiling, not a commitment.",
        };

  return (
    <ActivationShell>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4 }}
        className="w-full max-w-3xl"
      >
        <div className="mb-5 flex items-center gap-2 text-sm text-marketing-cream/65">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-marketing-accent text-marketing-charcoal">
            {stage === "availability" ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            ) : (
              "1"
            )}
          </span>
          <span className="h-px w-10 bg-white/15" />
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              stage === "availability"
                ? "bg-marketing-accent text-marketing-charcoal"
                : "bg-white/10",
            )}
          >
            2
          </span>
          <span className="ml-2">Build your Study plan</span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stage}
            initial={
              reduceMotion
                ? false
                : { opacity: 0, x: stage === "destination" ? -16 : 16 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: stage === "destination" ? -12 : 12 }}
            transition={{ duration: reduceMotion ? 0 : 0.28 }}
          >
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-marketing-accent">
                {heading.kicker}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-marketing-cream sm:text-4xl">
                {heading.title}
              </h1>
              <p className="mt-2 max-w-2xl text-marketing-cream/60">
                {heading.description}
              </p>
            </div>

            <Card className={cn(UCAT_CARD_CHROME, "shadow-2xl")}>
              <CardContent className="p-6 sm:p-8">
                {stage === "destination" ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="activation-target">
                        Target cognitive score
                      </Label>
                      <Input
                        id="activation-target"
                        type="number"
                        min={900}
                        max={2700}
                        step={10}
                        value={targetScore}
                        onChange={(event) => {
                          setTargetScore(Number(event.target.value));
                          setTargetUnsure(false);
                        }}
                      />
                      <button
                        type="button"
                        className="text-sm text-primary transition-colors hover:text-primary/80 hover:underline"
                        onClick={() => {
                          setTargetScore(2200);
                          setTargetUnsure(true);
                        }}
                      >
                        Not sure what to set?
                      </button>
                      <AnimatePresence initial={false}>
                        {targetUnsure ? (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground"
                          >
                            We’ll use 2200 as a sensible working target. It is
                            not a prediction, and you can change it any time.
                          </motion.p>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    <div className="space-y-2">
                      <Label>UCAT year</Label>
                      <SearchableSelect<YearOption>
                        items={yearOptions}
                        value={selectedYear}
                        onValueChange={(option) => {
                          setTestYear(option?.year ?? null);
                          setTestDate("");
                        }}
                        getItemLabel={(item) => String(item.year)}
                        getItemId={(item) => String(item.year)}
                        placeholder="Select your UCAT year"
                        ariaLabel="UCAT year"
                        searchPlaceholder="Search years…"
                        emptyMessage="No matching year."
                        triggerClassName="h-10 w-full justify-between font-normal"
                        contentWidth="min(100vw - 2rem, 24rem)"
                      />
                    </div>

                    <AnimatePresence initial={false}>
                      {testYear != null ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0, y: -8 }}
                          animate={{ opacity: 1, height: "auto", y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -8 }}
                          transition={{ duration: reduceMotion ? 0 : 0.24 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 pt-1">
                            <Label htmlFor="activation-date">
                              Exact date (optional)
                            </Label>
                            <Input
                              id="activation-date"
                              type="date"
                              min={`${testYear}-01-01`}
                              max={`${testYear}-12-31`}
                              value={testDate}
                              onChange={(event) => setTestDate(event.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Leave this blank if you do not know your date yet.
                            </p>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                      <Button
                        variant="ghost"
                        onClick={() => setSkipDialogOpen(true)}
                      >
                        Skip for now
                      </Button>
                      <Button
                        disabled={testYear == null}
                        onClick={() => setStage("availability")}
                      >
                        Choose my study week
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="divide-y divide-border/60">
                      {DAYS.map((day) => {
                        const available = availability.find(
                          (item) => item.weekday === day.value,
                        );
                        const enabled = Boolean(available);
                        return (
                          <div
                            key={day.value}
                            className="flex min-h-10 items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                          >
                            <span className="text-sm font-medium">
                              {day.label}
                            </span>
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "flex items-center gap-2 transition-opacity",
                                  !enabled && "pointer-events-none opacity-0",
                                )}
                                aria-hidden={!enabled}
                              >
                                <Input
                                  type="number"
                                  min={15}
                                  max={360}
                                  step={15}
                                  tabIndex={enabled ? 0 : -1}
                                  value={
                                    available?.maxMinutes ??
                                    defaultMinutesForDay(day.value)
                                  }
                                  disabled={!enabled}
                                  onChange={(event) =>
                                    setAvailability((current) =>
                                      current.map((item) =>
                                        item.weekday === day.value
                                          ? {
                                              ...item,
                                              maxMinutes: Number(
                                                event.target.value,
                                              ),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="h-10 w-24"
                                  aria-label={`${day.label} max minutes`}
                                />
                                <span className="text-sm text-muted-foreground">
                                  min
                                </span>
                              </div>
                              <Switch
                                checked={enabled}
                                onCheckedChange={() => toggleDay(day.value)}
                                aria-label={`${day.label} available`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Five weekdays are on by default. Adjust them honestly—we
                      may schedule less than your maximum and will infer a
                      sensible mock day automatically.
                    </p>
                    {error ? (
                      <p className="text-sm text-destructive">{error}</p>
                    ) : null}

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => setStage("destination")}
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                          Back
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setSkipDialogOpen(true)}
                        >
                          Skip for now
                        </Button>
                      </div>
                      <Button
                        disabled={
                          pending ||
                          availability.length === 0 ||
                          testYear == null
                        }
                        onClick={() => void buildPlan()}
                      >
                        {pending ? "Building…" : "Build my Study plan"}
                        {!pending ? (
                          <Sparkles className="ml-2 h-4 w-4" aria-hidden />
                        ) : null}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <AlertDialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip Study plan setup?</AlertDialogTitle>
            <AlertDialogDescription>
              You can continue without a plan and set one up later from Study
              plan settings. Until then, Altitutor cannot schedule your next
              recommended tasks around your target and availability.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep setting up</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSkipDialogOpen(false);
                finishActivation();
              }}
            >
              Skip for now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ActivationShell>
  );
}
