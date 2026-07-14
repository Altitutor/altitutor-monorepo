"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Button } from "@altitutor/ui";
import {
  BookOpen,
  BrainCircuit,
  Check,
  Clock3,
  Gauge,
  Loader2,
  NotebookText,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { createAndPersistPracticeSession } from "@/features/practice/api/create-practice-session";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import { updateStudyPlanTask } from "@/features/study-plan/api/study-plan";
import type { StudyPlanTask } from "@/features/study-plan/model/types";
import { cn } from "@/lib/utils";

type StudyPlanTaskListProps = {
  tasks: StudyPlanTask[];
  compact?: boolean;
};

function TaskIcon({ task }: { task: StudyPlanTask }) {
  const className = "h-4 w-4";
  if (task.taskType === "learn") return <BookOpen className={className} />;
  if (task.taskType === "mock") return <NotebookText className={className} />;
  if (task.taskType === "section_benchmark") return <Gauge className={className} />;
  if (task.taskType === "skill_trainer") return <Sparkles className={className} />;
  return <BrainCircuit className={className} />;
}

function practiceStartInput(task: StudyPlanTask) {
  const config = task.launchConfig;
  if (config.kind !== "practice" || typeof config.ucatSectionId !== "string") return null;
  const section = config.section;
  if (
    section !== "verbal_reasoning" &&
    section !== "decision_making" &&
    section !== "quantitative_reasoning" &&
    section !== "situational_judgement"
  ) return null;
  const payload: PracticeSelectionInput & {
    reviewTiming: "afterEachStem" | "atEnd";
  } = {
    section,
    unansweredOnly: false,
    incorrectOnly: false,
    categoryIds: Array.isArray(config.categoryIds)
      ? config.categoryIds.filter((id): id is string => typeof id === "string")
      : [],
    timeMode: config.timeMode === "off" ? "off" : "speed",
    timeSpeedMultiplier: typeof config.timeSpeedMultiplier === "number"
      ? config.timeSpeedMultiplier
      : 1,
    customTimeMinutes: null,
    questionCount: typeof config.questionCount === "number" ? config.questionCount : 10,
    timePerQuestionSeconds: typeof config.timePerQuestionSeconds === "number"
      ? config.timePerQuestionSeconds
      : null,
    reviewTiming: config.reviewTiming === "afterEachStem" ? "afterEachStem" : "atEnd",
  };
  return { payload, ucatSectionId: config.ucatSectionId };
}

function TaskRow({ task, compact }: { task: StudyPlanTask; compact: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<"start" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDone = task.status === "completed";
  const isSkipped = task.status === "skipped";

  async function startTask() {
    setPendingAction("start");
    setError(null);
    try {
      const practiceInput = practiceStartInput(task);
      if (practiceInput) {
        await createAndPersistPracticeSession(practiceInput);
        await updateStudyPlanTask(task.id, "start");
        await queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
        router.push("/practice/session");
        return;
      }
      await updateStudyPlanTask(task.id, "start");
      await queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
      router.push(task.launchPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start this task.");
      setPendingAction(null);
    }
  }

  async function skipTask() {
    setPendingAction("skip");
    setError(null);
    try {
      await updateStudyPlanTask(task.id, "skip");
      await queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not skip this task.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <li className={cn(
      "rounded-xl border p-4 transition-colors",
      isDone && "border-emerald-500/20 bg-emerald-500/5",
      isSkipped && "border-border/40 bg-muted/20 opacity-60",
      !isDone && !isSkipped && "border-border/60 bg-background/45",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isDone ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary",
        )}>
          {isDone ? <Check className="h-4 w-4" /> : <TaskIcon task={task} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-medium", (isDone || isSkipped) && "line-through")}>{task.title}</p>
            {task.status === "partial" ? <Badge variant="secondary">In progress</Badge> : null}
            {isSkipped ? <Badge variant="outline">Skipped</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
          {!compact && task.rationale ? (
            <p className="mt-2 text-xs text-muted-foreground/80">Why this: {task.rationale}</p>
          ) : null}
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            About {task.estimatedMinutes} min
          </div>
          {error ? (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error} This task remains on your plan.
            </p>
          ) : null}
        </div>
        {!isDone && !isSkipped ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button size="sm" onClick={() => void startTask()} disabled={pendingAction != null}>
              {pendingAction === "start" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {task.status === "partial" || task.status === "in_progress" ? "Continue" : "Start"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void skipTask()}
              disabled={pendingAction != null}
              aria-label={`Skip ${task.title}`}
            >
              {pendingAction === "skip" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function StudyPlanTaskList({ tasks, compact = false }: StudyPlanTaskListProps) {
  return (
    <ul className="space-y-3">
      {tasks.map((task) => <TaskRow key={task.id} task={task} compact={compact} />)}
    </ul>
  );
}
