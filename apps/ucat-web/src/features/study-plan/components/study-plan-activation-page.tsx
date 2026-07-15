"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Skeleton,
} from "@altitutor/ui";
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
  { weekday: 3, maxMinutes: 60 },
  { weekday: 6, maxMinutes: 120 },
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
            <StudyPlanTaskList tasks={[firstTask]} />
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
  const queryClient = useQueryClient();
  const query = useStudyPlan();
  const currentYear = new Date().getFullYear();
  const [stage, setStage] = useState<"destination" | "availability">(
    "destination",
  );
  const [targetScore, setTargetScore] = useState(2100);
  const [targetUnsure, setTargetUnsure] = useState(true);
  const [testYear, setTestYear] = useState(currentYear);
  const [testDate, setTestDate] = useState("");
  const [availability, setAvailability] =
    useState<StudyPlanAvailability[]>(DEFAULT_AVAILABILITY);
  const [savedPlan, setSavedPlan] = useState<StudyPlanResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = savedPlan ?? query.data;

  function toggleDay(weekday: StudyPlanWeekday) {
    setAvailability((current) =>
      current.some((day) => day.weekday === weekday)
        ? current.filter((day) => day.weekday !== weekday)
        : [
            ...current,
            { weekday, maxMinutes: weekday === 0 || weekday === 6 ? 120 : 60 },
          ],
    );
  }

  async function buildPlan() {
    if (!availability.length) return;
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

  if (query.isLoading && !savedPlan) {
    return (
      <Skeleton className="mx-auto h-[520px] w-full max-w-4xl rounded-3xl" />
    );
  }

  if (query.isError && !savedPlan) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-2xl">
        <AlertTitle>Could not load Study plan setup</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (plan?.profile) {
    return <PlanReveal plan={plan} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full",
            stage === "destination"
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary",
          )}
        >
          {stage === "availability" ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          ) : (
            "1"
          )}
        </span>
        <span className="h-px w-10 bg-border" />
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full",
            stage === "availability"
              ? "bg-primary text-primary-foreground"
              : "bg-muted",
          )}
        >
          2
        </span>
        <span className="ml-2">Build your Study plan</span>
      </div>

      <Card className={UCAT_CARD_CHROME}>
        <CardContent className="p-6 sm:p-8">
          {stage === "destination" ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Your destination
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  What are you working towards?
                </h1>
                <p className="mt-2 text-muted-foreground">
                  These inputs set direction. Your real results will calibrate
                  the plan.
                </p>
              </div>

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
                  className="text-sm text-primary hover:underline"
                  onClick={() => {
                    setTargetScore(2100);
                    setTargetUnsure(true);
                  }}
                >
                  I’m not sure yet
                </button>
                {targetUnsure ? (
                  <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                    We’ll use 2100 as a working target for now. It is not a
                    prediction, and you can change it at any time.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="activation-year">UCAT year</Label>
                  <Input
                    id="activation-year"
                    type="number"
                    min={currentYear}
                    max={currentYear + 3}
                    value={testYear}
                    onChange={(event) =>
                      setTestYear(Number(event.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activation-date">Exact date (optional)</Label>
                  <Input
                    id="activation-date"
                    type="date"
                    value={testDate}
                    onChange={(event) => {
                      setTestDate(event.target.value);
                      if (event.target.value)
                        setTestYear(Number(event.target.value.slice(0, 4)));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    If you have not booked, we’ll clearly label a provisional
                    date.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={() => router.replace("/dashboard")}
                >
                  Do this later
                </Button>
                <Button onClick={() => setStage("availability")}>
                  Choose my study week{" "}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Your week
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  When could you realistically study?
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Time is a maximum, not a commitment. Your plan may schedule
                  less.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DAYS.map((day) => {
                  const selected = availability.some(
                    (item) => item.weekday === day.value,
                  );
                  return (
                    <Button
                      key={day.value}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.short}
                    </Button>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {availability.map((available) => (
                  <div
                    key={available.weekday}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3"
                  >
                    <span className="text-sm font-medium">
                      {
                        DAYS.find((day) => day.value === available.weekday)
                          ?.label
                      }
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-9 w-20"
                        type="number"
                        min={15}
                        max={360}
                        step={15}
                        value={available.maxMinutes}
                        onChange={(event) =>
                          setAvailability((current) =>
                            current.map((item) =>
                              item.weekday === available.weekday
                                ? {
                                    ...item,
                                    maxMinutes: Number(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-muted-foreground">
                We’ll infer a sensible mock day from your highest-capacity day.
                You can edit it later in Study plan settings.
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
                    onClick={() => router.replace("/dashboard")}
                  >
                    Do this later
                  </Button>
                </div>
                <Button
                  disabled={pending || availability.length === 0}
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
    </div>
  );
}
