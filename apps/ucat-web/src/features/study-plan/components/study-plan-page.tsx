"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  Skeleton,
} from "@altitutor/ui";
import {
  AlertTriangle,
  CalendarDays,
  Gauge,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UcatPageHeader } from "@/features/layout";
import { StudyPlanCalendar } from "@/features/study-plan/components/study-plan-calendar";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import type { StudyPlanResponse } from "@/features/study-plan/model/types";
import {
  daysBetweenDateKeys,
  formatStudyPlanDate,
} from "@/features/study-plan/lib/calendar";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

function countdownLabel(today: string, testDate: string) {
  const days = daysBetweenDateKeys(today, testDate);
  if (days == null) return null;
  if (days < 0) return "Test date passed";
  if (days === 0) return "Test day";
  if (days === 1) return "1 day until your test";
  return `${days} days until your test`;
}

function StudyPlanDetailCard({
  icon: Icon,
  label,
  editLabel,
  previewMode,
  children,
}: {
  icon: LucideIcon;
  label: string;
  editLabel: string;
  previewMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={UCAT_CARD_CHROME}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          {previewMode ? (
            <Button variant="outline" size="sm" disabled>
              Edit
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/study-plan" aria-label={editLabel}>
                Edit
              </Link>
            </Button>
          )}
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-1">{children}</div>
      </CardContent>
    </Card>
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
                <AlertTitle>There is a capacity gap</AlertTitle>
                <AlertDescription>
                  {plan.generation.capacityRisk.message} This is guidance, not a
                  block.
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
                  className="order-first grid gap-4 sm:grid-cols-2 lg:order-last lg:grid-cols-1"
                  aria-label="Study plan goal"
                >
                  <StudyPlanDetailCard
                    icon={Target}
                    label="Target score"
                    editLabel="Edit target score"
                    previewMode={previewMode}
                  >
                    <p className="text-2xl font-semibold tabular-nums">
                      {plan.profile.targetScore}
                    </p>
                  </StudyPlanDetailCard>

                  <StudyPlanDetailCard
                    icon={CalendarDays}
                    label="UCAT test"
                    editLabel="Edit UCAT test date"
                    previewMode={previewMode}
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
                      label="Current plan mode"
                      editLabel="View study readiness"
                      previewMode={previewMode}
                    >
                      <p className="text-xl font-semibold capitalize">
                        {plan.generation.readiness.mode}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {plan.generation.readiness.sections
                          .map(
                            (section) =>
                              `${section.sectionKey === "verbal_reasoning" ? "VR" : section.sectionKey === "decision_making" ? "DM" : "QR"} ${section.mode === "learning" ? "learn" : `${section.paceMultiplier.toFixed(1)}×`}`,
                          )
                          .join(" · ")}
                      </p>
                    </StudyPlanDetailCard>
                  ) : null}
                </div>
              }
            />
          </motion.div>
        </>
      ) : null}
    </motion.div>
  );
}
