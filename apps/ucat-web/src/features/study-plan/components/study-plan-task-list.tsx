"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
} from "@altitutor/ui";
import { motion } from "motion/react";
import type { Variants } from "motion/react";
import { Button } from "@/components/ui/button";
import { UcatClickableCardIcon } from "@/shared/components/ucat-clickable-card";
import {
  BookOpen,
  BrainCircuit,
  Check,
  Clock3,
  Gauge,
  Loader2,
  NotebookText,
  RotateCcw,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useStudyPlanTaskActions } from "@/features/study-plan/hooks/use-study-plan-task-actions";
import { studyPlanActivityTypeLabel } from "@/features/study-plan/lib/activity-type-label";
import type { StudyPlanTask } from "@/features/study-plan/model/types";
import {
  UCAT_COMPLETED_ITEM_SURFACE,
  UCAT_CARD_CHROME,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

type StudyPlanTaskListProps = {
  tasks: StudyPlanTask[];
  compact?: boolean;
  today?: string;
  afterTasks?: ReactNode;
  previewMode?: boolean;
};

function TaskIcon({ task }: { task: StudyPlanTask }) {
  const className = "h-5 w-5";
  if (task.taskType === "learn") return <BookOpen className={className} />;
  if (task.taskType === "mock") return <NotebookText className={className} />;
  if (task.taskType === "section_benchmark")
    return <Gauge className={className} />;
  if (task.taskType === "skill_trainer")
    return <Sparkles className={className} />;
  if (task.taskType === "review") return <RotateCcw className={className} />;
  return <BrainCircuit className={className} />;
}

function configString(task: StudyPlanTask, key: string): string | null {
  const value = task.launchConfig[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function configNumber(task: StudyPlanTask, key: string): number | null {
  const value = task.launchConfig[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function TaskRow({
  task,
  compact,
  today,
  variants,
  previewMode,
  sourceTask,
}: {
  task: StudyPlanTask;
  compact: boolean;
  today?: string;
  variants: Variants;
  previewMode: boolean;
  sourceTask: StudyPlanTask | null;
}) {
  const {
    error,
    pendingAction,
    skipTask,
    startTask,
    unskipTask,
    futureStartPromptOpen,
    currentRecommendedTask,
    setFutureStartPromptOpen,
    continueFutureTask,
    startCurrentRecommendedTask,
  } = useStudyPlanTaskActions(task, !previewMode);
  const isDone = task.status === "completed";
  const isSkipped = task.status === "skipped";
  const awaitingReviewAttempt =
    task.taskType === "review" && task.launchConfig.awaitingAttempt !== false;
  const canSkip = Boolean(today && task.scheduledDate <= today);
  const sectionName = configString(task, "sectionName");
  const preparationPhase = configString(task, "preparationPhase");
  const prescribedPace = configNumber(task, "prescribedPace");
  const nextMilestone = configString(task, "nextMilestone");
  const preparationWarning = configString(task, "preparationWarning");
  const practiceMinutes = configNumber(task, "practiceMinutes");
  const reviewMinutes = configNumber(task, "reviewMinutes");

  return (
    <motion.li
      variants={variants}
      className={cn(
        UCAT_CARD_CHROME,
        "p-4",
        isDone && cn(UCAT_COMPLETED_ITEM_SURFACE, "!bg-muted/30"),
        isSkipped && "!bg-muted/20 opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <UcatClickableCardIcon
          className={cn(
            "mt-0.5",
            isDone ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {isDone ? <Check className="h-4 w-4" /> : <TaskIcon task={task} />}
        </UcatClickableCardIcon>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {studyPlanActivityTypeLabel(task, sourceTask)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "font-medium",
                (isDone || isSkipped) &&
                  "text-muted-foreground line-through decoration-muted-foreground/60",
              )}
            >
              {task.title}
            </p>
            {task.status === "partial" ? (
              <Badge variant="secondary">In progress</Badge>
            ) : null}
            {isSkipped ? <Badge variant="outline">Skipped</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {task.description}
          </p>
          {sectionName || preparationPhase || prescribedPace != null ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sectionName ? <Badge variant="outline">{sectionName}</Badge> : null}
              {preparationPhase ? (
                <Badge variant="secondary">
                  {preparationPhase[0]!.toUpperCase() + preparationPhase.slice(1)} phase
                </Badge>
              ) : null}
              {prescribedPace != null ? (
                <Badge variant="outline">{prescribedPace.toFixed(1)}× pace</Badge>
              ) : null}
            </div>
          ) : null}
          {!compact && task.rationale ? (
            <p className="mt-2 text-xs text-muted-foreground/80">
              Why this: {task.rationale}
            </p>
          ) : null}
          {!compact && nextMilestone ? (
            <p className="mt-1 text-xs text-muted-foreground/80">
              Next milestone: {nextMilestone}
            </p>
          ) : null}
          {preparationWarning ? (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
            >
              {preparationWarning}
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            {practiceMinutes != null || reviewMinutes != null ? (
              <span>
                {practiceMinutes ? `Activity ${practiceMinutes} min` : null}
                {practiceMinutes && reviewMinutes ? " · " : null}
                {reviewMinutes ? `Review ${reviewMinutes} min` : null}
              </span>
            ) : (
              <>About {task.estimatedMinutes} min</>
            )}
          </div>
          {error ? (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error} This task remains on your plan.
            </p>
          ) : null}
        </div>
        {previewMode && !isDone && !isSkipped ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button size="sm" disabled>
              {awaitingReviewAttempt
                ? "Finish attempt first"
                : task.status === "partial" || task.status === "in_progress"
                  ? "Continue"
                  : task.taskType === "review"
                    ? "Review now"
                    : "Start"}
            </Button>
            {canSkip ? (
              <Button size="sm" variant="outline" disabled>
                Skip
              </Button>
            ) : null}
          </div>
        ) : isSkipped ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void unskipTask()}
            disabled={pendingAction != null}
          >
            {pendingAction === "unskip" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Undo2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Undo skip
          </Button>
        ) : !isDone ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              onClick={() => void startTask()}
              disabled={pendingAction != null || awaitingReviewAttempt}
            >
              {pendingAction === "start" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {awaitingReviewAttempt
                ? "Finish attempt first"
                : task.status === "partial" || task.status === "in_progress"
                  ? "Continue"
                  : task.taskType === "review"
                    ? "Review now"
                    : "Start"}
            </Button>
            {canSkip ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void skipTask()}
                disabled={pendingAction != null}
              >
                {pendingAction === "skip" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Skip
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <AlertDialog
        open={futureStartPromptOpen}
        onOpenChange={setFutureStartPromptOpen}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Your current plan still has work waiting
            </AlertDialogTitle>
            <AlertDialogDescription>
              {currentRecommendedTask
                ? `We recommend ${currentRecommendedTask.title} first so today’s plan stays coherent. You can still continue with this future task if that suits you better.`
                : "You still have work in your current plan. You can continue with this future task if that suits you better."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel disabled={pendingAction != null}>
              Not now
            </AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={pendingAction != null}
              onClick={() => void continueFutureTask()}
            >
              Continue with future task
            </Button>
            {currentRecommendedTask ? (
              <Button
                type="button"
                disabled={pendingAction != null}
                onClick={() => void startCurrentRecommendedTask()}
              >
                Start recommended task
              </Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.li>
  );
}

export function StudyPlanTaskList({
  tasks,
  compact = false,
  today,
  afterTasks,
  previewMode = false,
}: StudyPlanTaskListProps) {
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  return (
    <motion.ul
      className="space-y-3"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          compact={compact}
          today={today}
          variants={itemVariants}
          previewMode={previewMode}
          sourceTask={
            task.sourceTaskId
              ? (tasksById.get(task.sourceTaskId) ?? null)
              : null
          }
        />
      ))}
      {afterTasks ? (
        <motion.li variants={itemVariants} className="list-none">
          {afterTasks}
        </motion.li>
      ) : null}
    </motion.ul>
  );
}
