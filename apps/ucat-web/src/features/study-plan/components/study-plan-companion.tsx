"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Gauge,
  Loader2,
  NotebookText,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useStudyPlanCompanion } from "@/features/study-plan/context/study-plan-companion-context";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import { useStudyPlanTaskActions } from "@/features/study-plan/hooks/use-study-plan-task-actions";
import { StudyPlanExtraStudy } from "@/features/study-plan/components/study-plan-extra-study";
import {
  findNewlyCompletedTask,
  findNextStudyDate,
  getTodayStudyPlanProgress,
  isCarryOverStudyPlanTask,
  mapStudyPlanTaskStatuses,
  selectCurrentStudyPlanTasks,
  selectNextStudyPlanTask,
} from "@/features/study-plan/lib/companion";
import type { StudyPlanTask } from "@/features/study-plan/model/types";
import { cn } from "@/lib/utils";
import { useAppShellLayout } from "@/features/layout/context/app-shell-layout-context";

const ENTER_EASE = [0.32, 0.72, 0, 1] as const;
const EXPAND_DURATION = 0.22;

function StudyTaskIcon({
  task,
  className,
}: {
  task: StudyPlanTask;
  className?: string;
}) {
  if (task.taskType === "learn") return <BookOpen className={className} />;
  if (task.taskType === "mock") return <NotebookText className={className} />;
  if (task.taskType === "section_benchmark")
    return <Gauge className={className} />;
  if (task.taskType === "skill_trainer")
    return <Sparkles className={className} />;
  if (task.taskType === "review") return <RotateCcw className={className} />;
  return <BrainCircuit className={className} />;
}

function actionLabel(task: StudyPlanTask): string {
  if (task.taskType === "review") return "Review now";
  if (task.status === "partial" || task.status === "in_progress")
    return "Continue";
  return "Start next";
}

function formatStudyDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function taskStatusLabel(task: StudyPlanTask): string {
  if (task.status === "completed") return "Complete";
  if (task.status === "skipped") return "Skipped";
  if (task.status === "partial") return "In progress";
  if (task.status === "in_progress") return "Started";
  if (
    task.taskType === "review" &&
    task.launchConfig.awaitingAttempt !== false
  ) {
    return "After attempt";
  }
  return `${task.estimatedMinutes} min`;
}

export function StudyPlanCompanion({
  hidden = false,
  placement = "floating",
  onVisibilityChange,
}: {
  hidden?: boolean;
  placement?: "floating" | "sidebar";
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const query = useStudyPlan();
  const { refetch } = query;
  const { livePractice } = useStudyPlanCompanion();
  const { bottomFloatingDockVisible } = useAppShellLayout();
  const [expanded, setExpanded] = useState(false);
  const [celebration, setCelebration] = useState<StudyPlanTask | null>(null);
  const previousStatusesRef = useRef<Map<
    string,
    StudyPlanTask["status"]
  > | null>(null);
  const generationIdRef = useRef<string | null>(null);
  const previousPathnameRef = useRef(pathname);
  const data = query.data;
  const currentTasks = useMemo(
    () => (data ? selectCurrentStudyPlanTasks(data.tasks, data.today) : []),
    [data],
  );
  const carryOverCount = useMemo(
    () =>
      data
        ? currentTasks.filter((task) =>
            isCarryOverStudyPlanTask(task, data.today),
          ).length
        : 0,
    [currentTasks, data],
  );
  const progress = useMemo(
    () => getTodayStudyPlanProgress(currentTasks),
    [currentTasks],
  );
  const nextTask = useMemo(
    () => selectNextStudyPlanTask(currentTasks),
    [currentTasks],
  );
  const nextStudyDate = data ? findNextStudyDate(data.tasks, data.today) : null;
  const actions = useStudyPlanTaskActions(nextTask);
  const forcedCollapsed =
    placement === "sidebar" ||
    pathname === "/practice/session" ||
    pathname.startsWith("/practice/stem/") ||
    /^\/skill-trainer\/[^/]+\/play$/.test(pathname);
  const floatingBottomOffset = bottomFloatingDockVisible
    ? "bottom-24"
    : "bottom-4";
  const expandTransition = {
    duration: reduceMotion ? 0 : EXPAND_DURATION,
    ease: ENTER_EASE,
  };

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    setExpanded(false);
    if (!hidden) void refetch();
  }, [hidden, pathname, refetch]);

  useEffect(() => {
    if (!data?.generation) return;
    const generationChanged = generationIdRef.current !== data.generation.id;
    if (generationChanged || !previousStatusesRef.current) {
      generationIdRef.current = data.generation.id;
      previousStatusesRef.current = mapStudyPlanTaskStatuses(data.tasks);
      return;
    }
    const completed = findNewlyCompletedTask(
      previousStatusesRef.current,
      data.tasks,
    );
    previousStatusesRef.current = mapStudyPlanTaskStatuses(data.tasks);
    if (completed) setCelebration(completed);
  }, [data]);

  useEffect(() => {
    if (!celebration || hidden) return;
    const timer = window.setTimeout(() => setCelebration(null), 2800);
    return () => window.clearTimeout(timer);
  }, [celebration, hidden]);

  useEffect(() => {
    if (forcedCollapsed) setExpanded(false);
  }, [forcedCollapsed]);

  const liveTask = livePractice?.studyPlanTaskId
    ? (data?.tasks.find((task) => task.id === livePractice.studyPlanTaskId) ??
      null)
    : null;
  const deliveredLiveTarget =
    livePractice && /^\d+$/.test(livePractice.totalQuestionLabel)
      ? Number(livePractice.totalQuestionLabel)
      : null;
  const liveTarget = deliveredLiveTarget ?? livePractice?.targetUnits ?? null;
  const livePercent =
    livePractice && liveTarget
      ? Math.min(
          100,
          Math.round((livePractice.answeredCount / liveTarget) * 100),
        )
      : null;
  const showExpanded = expanded && !forcedCollapsed && !celebration;
  const visible = Boolean(data?.profile && !query.isError && !hidden);
  const allTodayTasksComplete =
    !livePractice &&
    progress.total > 0 &&
    progress.completed === progress.total;

  useEffect(() => {
    onVisibilityChange?.(visible);
    return () => onVisibilityChange?.(false);
  }, [onVisibilityChange, visible]);

  if (!visible) return null;

  return (
    <aside
      className={cn(
        placement === "sidebar"
          ? "w-full min-w-0"
          : cn(
              "fixed right-3 z-40 transition-[width] duration-200 md:right-4 md:w-[min(390px,calc(100vw-2rem))]",
              showExpanded || celebration
                ? "w-[min(390px,calc(100vw-1.5rem))]"
                : "w-14",
            ),
        placement === "floating" && floatingBottomOffset,
      )}
      aria-label="Study plan companion"
    >
      <div
        className={cn(
          "overflow-hidden border border-border/60",
          placement === "sidebar"
            ? "rounded-xl bg-card shadow-sm"
            : cn(
                "bg-background/[0.97] shadow-[0_18px_55px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.03] backdrop-blur-xl dark:bg-background/[0.96] dark:ring-white/[0.06]",
                showExpanded || celebration
                  ? "rounded-2xl"
                  : "rounded-full md:rounded-2xl",
              ),
          celebration && "bg-muted/[0.97] dark:bg-muted/[0.96]",
        )}
      >
        {celebration ? (
          <div
            className="relative flex min-h-20 items-center gap-3 overflow-hidden px-4 py-3"
            aria-live="polite"
          >
            <motion.div
              initial={reduceMotion ? false : { scale: 0.5, rotate: -18 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <Check className="h-5 w-5" strokeWidth={3} />
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Task complete
              </p>
              <p className="truncate font-semibold text-muted-foreground line-through decoration-muted-foreground/60">
                {celebration.title}
              </p>
            </div>
            <Check
              className="h-5 w-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </div>
        ) : (
          <>
            {/* Collapsed + expanded stay mounted and crossfade height via grid 0fr/1fr
                (same pattern as sidebar) so the click responds immediately. */}
            <motion.div
              className="grid"
              initial={false}
              animate={{ gridTemplateRows: showExpanded ? "0fr" : "1fr" }}
              transition={expandTransition}
            >
              <div
                className={cn(
                  "min-h-0 overflow-hidden",
                  showExpanded && "pointer-events-none",
                )}
                aria-hidden={showExpanded}
              >
                <div
                  className={cn(
                    "flex items-center gap-2",
                    placement === "floating"
                      ? "min-h-14 p-1 md:min-h-20 md:p-2"
                      : "min-h-20 p-2",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => !forcedCollapsed && setExpanded(true)}
                    disabled={forcedCollapsed}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 text-left transition-colors enabled:hover:bg-muted/60",
                      placement === "floating"
                        ? "justify-center rounded-full p-0 md:justify-start md:rounded-xl md:px-2 md:py-1.5"
                        : "rounded-xl px-2 py-1.5",
                    )}
                    aria-expanded={false}
                    aria-label={
                      forcedCollapsed
                        ? "Study plan progress"
                        : "Expand Study plan companion"
                    }
                    tabIndex={showExpanded ? -1 : undefined}
                  >
                    <div
                      className={cn(
                        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                        allTodayTasksComplete
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {livePractice ? (
                        <BrainCircuit className="h-5 w-5" />
                      ) : allTodayTasksComplete ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Sparkles className="h-5 w-5" />
                      )}
                      <svg
                        className="absolute inset-0 -rotate-90"
                        viewBox="0 0 44 44"
                        aria-hidden
                      >
                        <circle
                          cx="22"
                          cy="22"
                          r="20.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={
                            allTodayTasksComplete
                              ? "text-muted-foreground/15"
                              : "text-primary/15"
                          }
                        />
                        <motion.circle
                          cx="22"
                          cy="22"
                          r="20.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          pathLength="100"
                          strokeDasharray="100"
                          initial={false}
                          animate={{
                            strokeDashoffset:
                              100 - (livePercent ?? progress.percent),
                          }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.45,
                            ease: ENTER_EASE,
                          }}
                        />
                      </svg>
                    </div>
                    <div
                      className={cn(
                        "min-w-0 flex-1",
                        placement === "floating" && "hidden md:block",
                      )}
                      aria-live="polite"
                    >
                      {livePractice ? (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-primary">
                            Practice in progress
                          </p>
                          <p className="truncate text-sm font-medium">
                            {liveTask?.title ?? livePractice.title}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span
                                key={livePractice.answeredCount}
                                initial={
                                  reduceMotion
                                    ? false
                                    : { y: -6, opacity: 0, scale: 1.15 }
                                }
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={
                                  reduceMotion
                                    ? undefined
                                    : { y: 5, opacity: 0 }
                                }
                                className="font-semibold tabular-nums text-foreground"
                              >
                                {livePractice.answeredCount}
                              </motion.span>
                            </AnimatePresence>
                            {liveTarget
                              ? `of ${liveTarget} answered`
                              : "answered"}
                          </p>
                        </>
                      ) : nextTask ? (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-primary">
                            {carryOverCount > 0
                              ? `${carryOverCount} still to do`
                              : `${progress.completed} of ${progress.total} today`}
                          </p>
                          <p className="truncate text-sm font-medium">
                            Next: {nextTask.title}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="h-3 w-3" /> About{" "}
                            {nextTask.estimatedMinutes} min
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                            All done
                          </p>
                          <p className="text-sm font-medium">
                            You’re finished for today
                          </p>
                          {nextStudyDate ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Next: {formatStudyDate(nextStudyDate)}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                    {!forcedCollapsed ? (
                      <ChevronUp
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground",
                          placement === "floating" && "hidden md:block",
                        )}
                      />
                    ) : null}
                  </button>
                  {!livePractice && nextTask && !forcedCollapsed ? (
                    <Button
                      size="sm"
                      onClick={() => void actions.startTask()}
                      disabled={actions.pendingAction != null}
                      className={cn(
                        "shrink-0",
                        placement === "floating" && "hidden md:inline-flex",
                      )}
                      tabIndex={showExpanded ? -1 : undefined}
                    >
                      {actions.pendingAction === "start" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Start"
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
            </motion.div>

            <motion.div
              className="grid"
              initial={false}
              animate={{ gridTemplateRows: showExpanded ? "1fr" : "0fr" }}
              transition={expandTransition}
            >
              <div
                className={cn(
                  "min-h-0 overflow-hidden",
                  !showExpanded && "pointer-events-none",
                )}
                aria-hidden={!showExpanded}
              >
                <div className="max-h-[min(620px,calc(100dvh-2rem))]">
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="flex w-full items-start justify-between gap-4 border-b border-border/60 px-4 py-4 text-left transition-colors hover:bg-muted/40"
                    aria-expanded
                    aria-label="Collapse Study plan companion"
                    tabIndex={showExpanded ? undefined : -1}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                        Today
                      </p>
                      <h2 className="mt-0.5 font-semibold">Your Study plan</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {carryOverCount > 0
                          ? `${carryOverCount} ${carryOverCount === 1 ? "task" : "tasks"} from an earlier study day`
                          : `${progress.completed} of ${progress.total} tasks complete`}
                      </p>
                    </div>
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </button>
                  <div className="h-1 bg-muted/70">
                    <motion.div
                      className="h-full rounded-r-full bg-primary"
                      initial={false}
                      animate={{ width: `${progress.percent}%` }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.45,
                        ease: ENTER_EASE,
                      }}
                    />
                  </div>
                  <div className="max-h-[360px] space-y-2 overflow-y-auto px-3 py-3">
                    {currentTasks.length ? (
                      currentTasks.map((task) => {
                        const complete = task.status === "completed";
                        const skipped = task.status === "skipped";
                        const isNext = nextTask?.id === task.id;
                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                              isNext && "bg-primary/8 ring-1 ring-primary/15",
                              (complete || skipped) && "opacity-60",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                isNext
                                  ? "bg-primary/12 text-primary"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {complete ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <StudyTaskIcon
                                  task={task}
                                  className="h-4 w-4"
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-sm font-medium",
                                  (complete || skipped) && "line-through",
                                )}
                              >
                                {task.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {data &&
                                isCarryOverStudyPlanTask(task, data.today)
                                  ? `From ${formatStudyDate(task.scheduledDate)} · ${taskStatusLabel(task)}`
                                  : taskStatusLabel(task)}
                              </p>
                            </div>
                            {isNext ? (
                              <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-6 text-center">
                        <CheckCircle2 className="mx-auto h-7 w-7 text-muted-foreground" />
                        <p className="mt-2 text-sm font-medium">
                          Nothing scheduled today
                        </p>
                        {nextStudyDate ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Next study day: {formatStudyDate(nextStudyDate)}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 border-t border-border/60 p-3">
                    {actions.error ? (
                      <p className="px-1 text-xs text-destructive">
                        {actions.error}
                      </p>
                    ) : null}
                    {!nextTask && query.data ? (
                      <StudyPlanExtraStudy plan={query.data} compact />
                    ) : null}
                    <div className="flex gap-2">
                      {nextTask ? (
                        <>
                          <Button
                            className="flex-1"
                            onClick={() => void actions.startTask()}
                            disabled={actions.pendingAction != null}
                            tabIndex={showExpanded ? undefined : -1}
                          >
                            {actions.pendingAction === "start" ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {actionLabel(nextTask)}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => void actions.skipTask()}
                            disabled={actions.pendingAction != null}
                            tabIndex={showExpanded ? undefined : -1}
                          >
                            {actions.pendingAction === "skip" ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Skip
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="outline"
                        asChild
                        className={cn(!nextTask && "flex-1")}
                        tabIndex={showExpanded ? undefined : -1}
                      >
                        <Link
                          href="/study-plan"
                          tabIndex={showExpanded ? undefined : -1}
                        >
                          Full plan
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </aside>
  );
}
