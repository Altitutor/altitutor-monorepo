"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@altitutor/ui";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Gauge,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UcatPageHeader } from "@/features/layout";
import { StudyPlanCalendar } from "@/features/study-plan/components/study-plan-calendar";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import type {
  StudyPlanReadinessSnapshot,
  StudyPlanResponse,
  StudyPlanSectionReadiness,
  StudyPlanTrainingMode,
} from "@/features/study-plan/model/types";
import {
  daysBetweenDateKeys,
  formatStudyPlanDate,
} from "@/features/study-plan/lib/calendar";
import { studentCapacityRiskMessage } from "@/features/study-plan/lib/capacity-risk-copy";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { cn } from "@/lib/utils";

function countdownLabel(today: string, testDate: string) {
  const days = daysBetweenDateKeys(today, testDate);
  if (days == null) return null;
  if (days < 0) return "Test date passed";
  if (days === 0) return "Test day";
  if (days === 1) return "1 day until your test";
  return `${days} days until your test`;
}

function sectionShortName(sectionKey: StudyPlanSectionReadiness["sectionKey"]) {
  switch (sectionKey) {
    case "verbal_reasoning":
      return "VR";
    case "decision_making":
      return "DM";
    case "quantitative_reasoning":
      return "QR";
    case "situational_judgement":
      return "SJ";
    default: {
      const _exhaustive: never = sectionKey;
      return _exhaustive;
    }
  }
}

function phaseLabel(mode: StudyPlanTrainingMode) {
  switch (mode) {
    case "learning":
      return "Learning";
    case "timing":
      return "Timing";
    case "exam":
      return "Exam";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

function readinessStatusLabel(unit: {
  learningComplete: boolean;
  coverageComplete: boolean;
}) {
  if (unit.learningComplete) return "Ready";
  if (unit.coverageComplete) return "Almost";
  return "Building";
}

function StudyPlanDetailCard({
  icon: Icon,
  label,
  action,
  children,
}: {
  icon: LucideIcon;
  label: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          {action}
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-1">{children}</div>
      </CardContent>
    </Card>
  );
}

function StudyPlanPhaseDetailsDialog({
  open,
  onOpenChange,
  readiness,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readiness: StudyPlanReadinessSnapshot;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(85dvh,40rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Study plan phase
            <Badge variant="secondary">{phaseLabel(readiness.mode)}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {readiness.sections.map((section) => {
            const short = sectionShortName(section.sectionKey);
            const showCategories =
              section.sectionKey === "verbal_reasoning" ||
              section.sectionKey === "decision_making";
            return (
              <section
                key={section.sectionId}
                className="rounded-xl border border-border/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">
                      {short}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {section.mode === "learning"
                          ? "Learning"
                          : `${section.paceMultiplier.toFixed(1)}× prescribed pace`}
                      </span>
                    </h3>
                  </div>
                  <Badge variant="secondary">{phaseLabel(section.mode)}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {section.nextMilestone}
                </p>
                <ul className="mt-3 space-y-2">
                  {(showCategories
                    ? section.units.filter((unit) => unit.scope === "category")
                    : section.units.filter((unit) => unit.scope === "section")
                  ).map((unit) => {
                    const status = readinessStatusLabel(unit);
                    return (
                      <li
                        key={unit.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate text-muted-foreground">
                          {showCategories ? unit.name : `${short} overall`}
                        </span>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            status === "Ready"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : status === "Almost"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {status === "Ready" ? (
                            <Check className="h-3 w-3" aria-hidden />
                          ) : null}
                          {status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StudyPlanPage({
  previewPlan,
}: {
  previewPlan?: StudyPlanResponse;
} = {}) {
  const previewMode = Boolean(previewPlan);
  const query = useStudyPlan(!previewMode);
  const plan = previewPlan ?? query.data;
  const router = useRouter();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const [phaseDetailsOpen, setPhaseDetailsOpen] = useState(false);

  useEffect(() => {
    if (!previewMode && plan?.profile && !plan.profile.studyPlanEnabled) {
      router.replace("/settings/study-plan");
    }
  }, [plan?.profile, previewMode, router]);

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title="Study plan"
          description="Your adaptive 21-day route toward test day"
        />
      </motion.div>

      {!previewMode && query.isLoading ? (
        <motion.div className="space-y-5" variants={itemVariants}>
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-[520px] w-full rounded-2xl" />
        </motion.div>
      ) : null}

      {!previewMode && query.isError ? (
        <motion.div variants={itemVariants}>
          <Alert variant="destructive">
            <AlertTitle>Could not load your Study plan</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        </motion.div>
      ) : null}

      {plan && !plan.profile ? (
        <motion.div variants={itemVariants}>
          <Card className={UCAT_CARD_CHROME}>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CalendarDays className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold">
                Build your Study plan
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Add your target and availability to turn this calendar into a
                practical route to test day.
              </p>
              {previewMode ? (
                <Button className="mt-5" disabled>
                  Set up Study plan
                </Button>
              ) : (
                <Button asChild className="mt-5">
                  <Link href="/study-plan/setup">Set up Study plan</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      {plan?.profile?.studyPlanEnabled ? (
        <>
          {plan.generation?.capacityRisk.level === "warning" ? (
            <motion.div variants={itemVariants}>
              <Alert className="border-amber-500/30 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Your plan is prioritising</AlertTitle>
                <AlertDescription>
                  {studentCapacityRiskMessage(plan.generation.capacityRisk)} This
                  is guidance, not a block.
                </AlertDescription>
              </Alert>
            </motion.div>
          ) : null}

          <motion.div variants={itemVariants}>
            <StudyPlanCalendar
              plan={plan}
              previewMode={previewMode}
              summaryCards={
                <div
                  className="order-first grid h-full gap-4 sm:grid-cols-2 lg:order-last lg:grid-cols-1"
                  aria-label="Study plan goal"
                >
                  <StudyPlanDetailCard
                    icon={Target}
                    label="Target score"
                    action={
                      previewMode ? (
                        <Button variant="outline" size="sm" disabled>
                          Edit
                        </Button>
                      ) : (
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href="/settings/study-plan"
                            aria-label="Edit target score"
                          >
                            Edit
                          </Link>
                        </Button>
                      )
                    }
                  >
                    <p className="text-2xl font-semibold tabular-nums">
                      {plan.profile.targetScore}
                    </p>
                  </StudyPlanDetailCard>

                  <StudyPlanDetailCard
                    icon={CalendarDays}
                    label="UCAT test"
                    action={
                      previewMode ? (
                        <Button variant="outline" size="sm" disabled>
                          Edit
                        </Button>
                      ) : (
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href="/settings/study-plan"
                            aria-label="Edit UCAT test date"
                          >
                            Edit
                          </Link>
                        </Button>
                      )
                    }
                  >
                    {plan.profile.testDate ? (
                      <>
                        <p className="font-semibold">
                          {formatStudyPlanDate(plan.profile.testDate, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {countdownLabel(plan.today, plan.profile.testDate)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xl font-semibold">
                        UCAT {plan.profile.testYear}
                      </p>
                    )}
                  </StudyPlanDetailCard>

                  {plan.generation?.readiness ? (
                    <StudyPlanDetailCard
                      icon={Gauge}
                      label="Study plan phase"
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPhaseDetailsOpen(true)}
                        >
                          View details
                        </Button>
                      }
                    >
                      <p className="text-xl font-semibold">
                        {phaseLabel(plan.generation.readiness.mode)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {plan.generation.readiness.sections
                          .map(
                            (section) =>
                              `${sectionShortName(section.sectionKey)} ${section.mode === "learning" ? "learn" : `${section.paceMultiplier.toFixed(1)}×`}`,
                          )
                          .join(" · ")}
                      </p>
                    </StudyPlanDetailCard>
                  ) : null}
                </div>
              }
            />
          </motion.div>

          {plan.generation?.readiness ? (
            <StudyPlanPhaseDetailsDialog
              open={phaseDetailsOpen}
              onOpenChange={setPhaseDetailsOpen}
              readiness={plan.generation.readiness}
            />
          ) : null}
        </>
      ) : null}
    </motion.div>
  );
}
