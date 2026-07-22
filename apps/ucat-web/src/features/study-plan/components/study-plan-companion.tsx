"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  Clock3,
  Gauge,
  Flame,
  Loader2,
  NotebookText,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAndPersistPracticeSession } from "@/features/practice/api/create-practice-session";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import { suggestAlternativeStudyGuidance } from "@/features/study-plan/api/study-plan";
import { useStudyPlanCompanion } from "@/features/study-plan/context/study-plan-companion-context";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import { useStudyPlanTaskActions } from "@/features/study-plan/hooks/use-study-plan-task-actions";
import {
  findNewlyCompletedTask,
  getTodayStudyPlanProgress,
  mapStudyPlanTaskStatuses,
  selectCurrentStudyPlanTasks,
  selectNextStudyPlanTask,
} from "@/features/study-plan/lib/companion";
import {
  isAlreadyOnSuggestedActivity,
  type StudyPlanCompanionMode,
} from "@/features/study-plan/lib/companion-mode";
import { guidanceItemKey } from "@/features/study-plan/lib/next-step-guidance";
import type {
  StudyGuidanceItem,
  StudyPlanTask,
  StudyPlanTaskType,
} from "@/features/study-plan/model/types";
import { useAppShellLayout } from "@/features/layout/context/app-shell-layout-context";
import {
  useCompleteOnboardingTour,
  useOnboardingProgress,
} from "@/features/onboarding/hooks/use-onboarding-progress";
import { UCAT_STUDY_ORB_INTRO_SEEN } from "@/features/onboarding/lib/activation-milestones";
import { cn } from "@/lib/utils";
import { useUcatActivity } from "@/features/progress/hooks/use-ucat-activity";
import { buildPracticeStreak } from "@/features/streaks/lib/practice-streak";

const ENTER_EASE = [0.32, 0.72, 0, 1] as const;
const EXPAND_DURATION = 0.22;
const CELEBRATION_DURATION_MS = 3_500;
const REDUCED_MOTION_CELEBRATION_DURATION_MS = 2_500;

type GuidanceDisplayItem = {
  id: string;
  suggestionKey: string;
  taskType: StudyPlanTaskType;
  title: string;
  description: string;
  rationale: string;
  estimatedMinutes: number;
  launchPath: string;
  launchConfig: Record<string, unknown>;
  planTask: StudyPlanTask | null;
};

type GuidanceNotice = {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
};

type OrbCelebration = {
  type: "task" | "streak";
  title: string;
  detail: string;
};

function TaskIcon({
  taskType,
  className,
}: {
  taskType: StudyPlanTaskType;
  className?: string;
}) {
  if (taskType === "learn") return <BookOpen className={className} />;
  if (taskType === "mock") return <NotebookText className={className} />;
  if (taskType === "section_benchmark") return <Gauge className={className} />;
  if (taskType === "skill_trainer") return <Sparkles className={className} />;
  if (taskType === "review") return <RotateCcw className={className} />;
  return <BrainCircuit className={className} />;
}

function planDisplayItem(task: StudyPlanTask): GuidanceDisplayItem {
  return {
    id: task.id,
    suggestionKey: guidanceItemKey(task),
    taskType: task.taskType,
    title: task.title,
    description: task.description,
    rationale: task.rationale,
    estimatedMinutes: task.estimatedMinutes,
    launchPath: task.launchPath,
    launchConfig: task.launchConfig,
    planTask: task,
  };
}

function nextStepDisplayItem(item: StudyGuidanceItem): GuidanceDisplayItem {
  return {
    id: item.id,
    suggestionKey: guidanceItemKey(item),
    taskType: item.taskType,
    title: item.title,
    description: item.description,
    rationale: item.rationale,
    estimatedMinutes: item.estimatedMinutes,
    launchPath: item.launchPath,
    launchConfig: item.launchConfig,
    planTask: null,
  };
}

function practiceStartInput(item: GuidanceDisplayItem) {
  const config = item.launchConfig;
  if (config.kind !== "practice" || typeof config.ucatSectionId !== "string")
    return null;
  const section = config.section;
  if (
    section !== "verbal_reasoning" &&
    section !== "decision_making" &&
    section !== "quantitative_reasoning" &&
    section !== "situational_judgement"
  )
    return null;
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
    timeSpeedMultiplier:
      typeof config.timeSpeedMultiplier === "number"
        ? config.timeSpeedMultiplier
        : 1,
    customTimeMinutes: null,
    questionCount:
      typeof config.questionCount === "number" ? config.questionCount : 10,
    timePerQuestionSeconds:
      typeof config.timePerQuestionSeconds === "number"
        ? config.timePerQuestionSeconds
        : null,
    reviewTiming:
      config.reviewTiming === "afterEachStem" ? "afterEachStem" : "atEnd",
  };
  return { payload, ucatSectionId: config.ucatSectionId };
}

function actionLabel(item: GuidanceDisplayItem): string {
  if (item.taskType === "review") return "Review now";
  if (
    item.planTask?.status === "partial" ||
    item.planTask?.status === "in_progress"
  )
    return "Continue";
  return "Start";
}

function activityTypeLabel(item: GuidanceDisplayItem): string {
  if (item.taskType === "learn") return "Learning module";
  if (item.taskType === "skill_trainer") return "Skill trainer";
  if (item.taskType === "review") return "Review";
  if (item.taskType === "section_benchmark") return "Timed set";
  if (item.taskType === "mock") return "Mock";
  const categories = item.launchConfig.categoryIds;
  return item.launchConfig.kind === "practice" &&
    Array.isArray(categories) &&
    categories.length
    ? "Filtered practice"
    : "Practice";
}

export function StudyPlanCompanion({
  hidden = false,
  mode = "available",
  placement = "floating",
}: {
  hidden?: boolean;
  mode?: StudyPlanCompanionMode;
  placement?: "floating" | "sidebar";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const query = useStudyPlan();
  const activityQuery = useUcatActivity();
  const { activityComplete, activityCompletion, consumeActivityCompletion } =
    useStudyPlanCompanion();
  const { bottomFloatingDockVisible } = useAppShellLayout();
  const onboardingProgress = useOnboardingProgress();
  const completeMilestone = useCompleteOnboardingTour();
  const orbIntroSeen = onboardingProgress.isCompleted(
    UCAT_STUDY_ORB_INTRO_SEEN,
  );
  const [expanded, setExpanded] = useState(false);
  const [orbIntroVisible, setOrbIntroVisible] = useState(false);
  const [guidancePending, setGuidancePending] = useState(false);
  const [guidanceError, setGuidanceError] = useState<string | null>(null);
  const [latestNotice, setLatestNotice] = useState<GuidanceNotice | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const [celebration, setCelebration] = useState<OrbCelebration | null>(null);
  const [alternativePending, setAlternativePending] = useState(false);
  const [alternativeState, setAlternativeState] = useState<{
    guidanceKey: string;
    item: GuidanceDisplayItem;
    excludedKeys: string[];
  } | null>(null);
  const previousStatusesRef = useRef<Map<
    string,
    StudyPlanTask["status"]
  > | null>(null);
  const previousGuidanceKeyRef = useRef<string | null>(null);
  const orbIntroHandledRef = useRef(false);
  const practicedTodayRef = useRef<boolean | null>(null);
  const suppressNextGuidancePromptRef = useRef(false);
  const pendingCelebrationRef = useRef<OrbCelebration | null>(null);
  const explicitCompletionAtRef = useRef<number | null>(null);
  const processedActivityCompletionRef = useRef<number | null>(null);
  const data = query.data;
  const planEnabled = data?.profile?.studyPlanEnabled ?? false;
  const currentPlanTasks = useMemo(
    () => (data ? selectCurrentStudyPlanTasks(data.tasks, data.today) : []),
    [data],
  );
  const actionablePlanTasks = useMemo(
    () =>
      currentPlanTasks.filter(
        (task) => task.status !== "completed" && task.status !== "skipped",
      ),
    [currentPlanTasks],
  );
  const primaryPlanTask = selectNextStudyPlanTask(currentPlanTasks);
  const secondaryPlanTask = actionablePlanTasks.find(
    (task) => task.id !== primaryPlanTask?.id,
  );
  const baseItems = useMemo<GuidanceDisplayItem[]>(() => {
    if (planEnabled) {
      return [primaryPlanTask, secondaryPlanTask]
        .filter((task): task is StudyPlanTask => Boolean(task))
        .map(planDisplayItem);
    }
    return (data?.nextSteps ?? []).map(nextStepDisplayItem);
  }, [data?.nextSteps, planEnabled, primaryPlanTask, secondaryPlanTask]);
  const guidanceKey = planEnabled
    ? (baseItems[0]?.id ?? `plan-complete:${data?.today ?? ""}`)
    : (data?.nextSteps[0]?.triggerKey ?? null);
  const activeAlternative =
    alternativeState?.guidanceKey === guidanceKey
      ? alternativeState.item
      : null;
  const items = useMemo(() => {
    if (!activeAlternative) return baseItems;
    const secondary = baseItems.find(
      (item) => item.suggestionKey !== activeAlternative.suggestionKey,
    );
    return [activeAlternative, secondary].filter(
      (item): item is GuidanceDisplayItem => Boolean(item),
    );
  }, [activeAlternative, baseItems]);
  const primary = items[0] ?? null;
  const secondary = items[1] ?? null;
  const progress = useMemo(
    () => getTodayStudyPlanProgress(currentPlanTasks),
    [currentPlanTasks],
  );
  const planActions = useStudyPlanTaskActions(primary?.planTask ?? null);
  const secondaryPlanActions = useStudyPlanTaskActions(
    secondary?.planTask ?? null,
  );
  const activityInProgress = mode === "activity" && !activityComplete;
  const suggestionsEnabled = Boolean(
    data?.profile?.studySuggestionsEnabled && !query.isError && !hidden,
  );
  // Stay mounted through completion celebrations on activity routes, then
  // hide again until the activity finishes (or the student leaves).
  const visible = Boolean(
    suggestionsEnabled && (!activityInProgress || celebration != null),
  );
  const floatingBottom = bottomFloatingDockVisible ? "bottom-24" : "bottom-4";
  const expandTransition = {
    duration: reduceMotion ? 0 : EXPAND_DURATION,
    ease: ENTER_EASE,
  };
  const activityInProgressRef = useRef(activityInProgress);
  const primaryLaunchPathRef = useRef(primary?.launchPath ?? null);
  const pathnameRef = useRef(pathname);
  activityInProgressRef.current = activityInProgress;
  primaryLaunchPathRef.current = primary?.launchPath ?? null;
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!activityQuery.data) return;
    const streak = buildPracticeStreak(
      activityQuery.data.days,
      activityQuery.data.timezone,
    );
    const previous = practicedTodayRef.current;
    practicedTodayRef.current = streak.practicedToday;
    if (previous !== false || !streak.practicedToday) return;
    setExpanded(false);
    setPromptVisible(false);
    setCelebration({
      type: "streak",
      title: `${streak.current} day streak`,
      detail: "Today’s first question keeps your momentum going.",
    });
  }, [activityQuery.data]);

  useEffect(() => {
    if (!activityCompletion) return;
    if (processedActivityCompletionRef.current === activityCompletion.id)
      return;
    processedActivityCompletionRef.current = activityCompletion.id;
    explicitCompletionAtRef.current = Date.now();
    suppressNextGuidancePromptRef.current = true;
    setExpanded(false);
    setPromptVisible(false);
    const directCelebration: OrbCelebration = {
      type: "task",
      title: activityCompletion.title,
      detail: activityCompletion.detail ?? "Nice work—keep it going.",
    };
    if (celebration?.type === "streak") {
      pendingCelebrationRef.current = directCelebration;
    } else {
      setCelebration(directCelebration);
    }
    consumeActivityCompletion(activityCompletion.id);
  }, [activityCompletion, celebration?.type, consumeActivityCompletion]);

  useEffect(() => {
    if (!celebration || !visible) return;
    const timer = window.setTimeout(
      () => {
        const nextCelebration = pendingCelebrationRef.current;
        pendingCelebrationRef.current = null;
        if (nextCelebration) {
          setCelebration(nextCelebration);
          return;
        }
        setCelebration(null);
        suppressNextGuidancePromptRef.current = false;
        const launchPath = primaryLaunchPathRef.current;
        const alreadyOnNext =
          launchPath != null &&
          isAlreadyOnSuggestedActivity(pathnameRef.current, launchPath);
        // Stay silent while still inside an unfinished activity, or when the
        // suggested next step is the page we just landed on (e.g. attempt review).
        if (activityInProgressRef.current || alreadyOnNext) {
          setPromptVisible(false);
          return;
        }
        setPromptVisible(true);
      },
      reduceMotion
        ? REDUCED_MOTION_CELEBRATION_DURATION_MS
        : CELEBRATION_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [celebration, reduceMotion, visible]);

  useEffect(() => {
    if (!activityInProgress) return;
    setExpanded(false);
    setPromptVisible(false);
  }, [activityInProgress]);

  useEffect(() => {
    if (!data || !data.generation) return;
    if (!previousStatusesRef.current) {
      previousStatusesRef.current = mapStudyPlanTaskStatuses(data.tasks);
      return;
    }
    const completed = findNewlyCompletedTask(
      previousStatusesRef.current,
      data.tasks,
    );
    previousStatusesRef.current = mapStudyPlanTaskStatuses(data.tasks);
    if (!completed) return;
    const notice: GuidanceNotice = {
      id: `completed:${completed.id}:${completed.completedAt ?? "now"}`,
      eyebrow: "Nice work",
      title: `${completed.title} complete`,
      detail: primary
        ? `Next: ${primary.title}`
        : "You’re caught up for today.",
    };
    suppressNextGuidancePromptRef.current = true;
    setExpanded(false);
    setLatestNotice(notice);
    setPromptVisible(false);
    const taskCelebration: OrbCelebration = {
      type: "task",
      title: "Task complete",
      detail: completed.title,
    };
    const followsExplicitCompletion =
      explicitCompletionAtRef.current != null &&
      Date.now() - explicitCompletionAtRef.current < 10_000;
    explicitCompletionAtRef.current = null;
    if (followsExplicitCompletion) {
      return;
    }
    if (celebration?.type === "streak") {
      pendingCelebrationRef.current = taskCelebration;
    } else {
      setCelebration(taskCelebration);
    }
  }, [celebration, data, primary]);

  useEffect(() => {
    if (!guidanceKey || planEnabled) return;
    if (activityInProgress) return;
    if (previousGuidanceKeyRef.current === guidanceKey) return;
    const hadPreviousGuidance = previousGuidanceKeyRef.current != null;
    previousGuidanceKeyRef.current = guidanceKey;
    if (suppressNextGuidancePromptRef.current) {
      suppressNextGuidancePromptRef.current = false;
      return;
    }
    if (!primary) return;
    if (isAlreadyOnSuggestedActivity(pathname, primary.launchPath)) return;
    const notice: GuidanceNotice = {
      id: `guidance:${guidanceKey}`,
      eyebrow: hadPreviousGuidance
        ? "Suggested next task"
        : "Ready when you are",
      title: primary.title,
      detail: primary.rationale,
    };
    setLatestNotice(notice);
    setPromptVisible(true);
  }, [activityInProgress, guidanceKey, pathname, planEnabled, primary]);

  useEffect(() => {
    setExpanded(false);
    if (!hidden) void query.refetch();
    // Route changes are the refresh boundary after completing or reviewing work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!visible || onboardingProgress.isLoading || orbIntroSeen) return;
    if (orbIntroHandledRef.current) return;
    orbIntroHandledRef.current = true;
    setPromptVisible(false);
    setOrbIntroVisible(true);
  }, [onboardingProgress.isLoading, orbIntroSeen, visible]);

  function dismissOrbIntro(openOrb = false) {
    setOrbIntroVisible(false);
    if (openOrb) setExpanded(true);
    if (!completeMilestone.isPending) {
      completeMilestone.mutate(UCAT_STUDY_ORB_INTRO_SEEN);
    }
  }

  async function startGuidanceItem(item: GuidanceDisplayItem) {
    if (item.planTask) {
      if (item.id === secondary?.id) await secondaryPlanActions.startTask();
      else await planActions.startTask();
      return;
    }
    setGuidancePending(true);
    setGuidanceError(null);
    try {
      const practice = practiceStartInput(item);
      if (practice) {
        await createAndPersistPracticeSession(practice);
        router.push("/practice/session");
        return;
      }
      router.push(item.launchPath);
    } catch (caught) {
      setGuidanceError(
        caught instanceof Error
          ? caught.message
          : "Could not start this activity.",
      );
    } finally {
      setGuidancePending(false);
    }
  }

  async function requestAlternative() {
    if (!guidanceKey || alternativePending) return;
    setAlternativePending(true);
    setGuidanceError(null);
    try {
      const existingExcluded =
        alternativeState?.guidanceKey === guidanceKey
          ? alternativeState.excludedKeys
          : [];
      const excludedKeys = [
        ...new Set([
          ...baseItems.map((item) => item.suggestionKey),
          ...existingExcluded,
          ...(activeAlternative ? [activeAlternative.suggestionKey] : []),
        ]),
      ];
      const suggestion = await suggestAlternativeStudyGuidance({
        excludedKeys,
        currentTaskTypes: items.map((item) => item.taskType),
      });
      const item = nextStepDisplayItem(suggestion);
      setAlternativeState({
        guidanceKey,
        item,
        excludedKeys: [...excludedKeys, item.suggestionKey],
      });
    } catch (caught) {
      setGuidanceError(
        caught instanceof Error
          ? caught.message
          : "Could not suggest another activity.",
      );
    } finally {
      setAlternativePending(false);
    }
  }

  if (!visible) return null;

  return (
    <aside
      className={cn(
        placement === "floating"
          ? cn(
              "fixed right-3 z-40 transition-[width] duration-200 md:right-4",
              expanded ? "w-[min(390px,calc(100vw-1.5rem))]" : "w-14",
              floatingBottom,
            )
          : cn(
              "relative ml-auto transition-[width] duration-200",
              expanded ? "w-full" : "w-14",
            ),
      )}
      aria-label="Study guidance"
      data-activity-complete={activityComplete || undefined}
    >
      <AnimatePresence>
        {celebration && !expanded && !orbIntroVisible ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 1.03 }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: ENTER_EASE }}
            className="absolute bottom-16 right-0 w-[min(300px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-amber-400/40 bg-background/95 p-4 shadow-[0_18px_55px_rgba(245,158,11,0.22)] backdrop-blur-xl"
            role="status"
          >
            {!reduceMotion
              ? [0, 1, 2, 3, 4].map((particle) => (
                  <motion.span
                    key={particle}
                    className="absolute h-2 w-2 rounded-full bg-amber-400"
                    style={{ left: `${12 + particle * 19}%` }}
                    initial={{ y: 45, opacity: 0, scale: 0 }}
                    animate={{
                      y: [-2, -28],
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0.5],
                    }}
                    transition={{ duration: 1.15, delay: particle * 0.1 }}
                    aria-hidden
                  />
                ))
              : null}
            <div className="relative flex items-center gap-3">
              <motion.span
                initial={reduceMotion ? false : { scale: 0.5, rotate: -18 }}
                animate={
                  reduceMotion
                    ? { scale: 1 }
                    : { scale: [0.5, 1.2, 1], rotate: [-18, 8, 0] }
                }
                transition={{
                  duration: reduceMotion ? 0 : 0.55,
                  ease: ENTER_EASE,
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-lg shadow-amber-400/25"
              >
                {celebration.type === "streak" ? (
                  <Flame className="h-5 w-5 fill-current" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
              </motion.span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-amber-600 dark:text-amber-400">
                  Nice work
                </p>
                <p className="mt-0.5 font-semibold">{celebration.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {celebration.detail}
                </p>
              </div>
            </div>
            <span className="absolute -bottom-2 right-5 h-4 w-4 rotate-45 border-b border-r border-amber-400/40 bg-background/95" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {orbIntroVisible && !expanded ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{
              duration: reduceMotion ? 0 : 0.28,
              ease: ENTER_EASE,
            }}
            className="absolute bottom-16 right-0 w-[min(330px,calc(100vw-1.5rem))] rounded-2xl border border-border/70 bg-background/95 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-xl"
            role="dialog"
            aria-label="Meet your Study orb"
          >
            <motion.span
              initial={reduceMotion ? false : { rotate: -12, scale: 0.8 }}
              animate={
                reduceMotion
                  ? { rotate: 0, scale: 1 }
                  : { rotate: [0, 8, -5, 0], scale: [1, 1.08, 1.02, 1] }
              }
              transition={{ duration: reduceMotion ? 0 : 0.8, delay: 0.12 }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
            </motion.span>
            <p className="mt-3 font-semibold">Meet your Study orb</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {planEnabled
                ? "Your Study plan lives here. Open the orb to see today’s work and what comes next."
                : "The orb suggests your next useful activity whenever you want a clear place to start."}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => dismissOrbIntro(false)}
              >
                Got it
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => dismissOrbIntro(true)}
              >
                Show me
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
            <span className="absolute -bottom-2 right-5 h-4 w-4 rotate-45 border-b border-r border-border/70 bg-background/95" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {promptVisible &&
        latestNotice &&
        !celebration &&
        !expanded &&
        !orbIntroVisible ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: ENTER_EASE }}
            className="absolute bottom-16 right-0 w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-border/70 bg-background/95 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-xl"
            role="status"
          >
            <button
              type="button"
              onClick={() => setPromptVisible(false)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Dismiss study update"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPromptVisible(false);
                if (orbIntroVisible) dismissOrbIntro(false);
                setExpanded(true);
              }}
              className="block w-full pr-7 text-left"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {latestNotice.eyebrow}
              </p>
              <p className="mt-1 font-semibold">{latestNotice.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {latestNotice.detail}
              </p>
            </button>
            <span className="absolute -bottom-2 right-5 h-4 w-4 rotate-45 border-b border-r border-border/70 bg-background/95" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className={cn(
          "overflow-hidden border border-border/70 bg-background/95 shadow-[0_18px_55px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.03] backdrop-blur-xl transition-[border-radius] duration-200",
          expanded ? "rounded-2xl" : "rounded-full",
        )}
      >
        <motion.div
          className="grid"
          initial={false}
          animate={{ gridTemplateRows: expanded ? "0fr" : "1fr" }}
          transition={expandTransition}
        >
          <div
            className={cn(
              "min-h-0 overflow-hidden",
              expanded && "pointer-events-none",
            )}
            aria-hidden={expanded}
          >
            <button
              type="button"
              onClick={() => {
                setPromptVisible(false);
                setExpanded(true);
              }}
              className="ml-auto flex h-14 w-14 items-center justify-center"
              aria-label="Open study guidance"
              aria-expanded={false}
              tabIndex={expanded ? -1 : undefined}
            >
              <motion.span
                animate={
                  celebration && !reduceMotion
                    ? { scale: [1, 1.22, 0.96, 1], rotate: [0, 8, -6, 0] }
                    : { scale: 1, rotate: 0 }
                }
                transition={{ duration: 0.75, ease: ENTER_EASE }}
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
              >
                <Sparkles className="h-5 w-5" />
                {promptVisible || orbIntroVisible ? (
                  <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                ) : null}
              </motion.span>
            </button>
          </div>
        </motion.div>

        <motion.div
          className="grid"
          initial={false}
          animate={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
          transition={expandTransition}
        >
          <div
            className={cn(
              "min-h-0 overflow-hidden",
              !expanded && "pointer-events-none",
            )}
            aria-hidden={!expanded}
          >
            <div className="max-h-[min(620px,calc(100dvh-2rem))]">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex w-full items-start justify-between gap-4 border-b border-border/60 px-4 py-4 text-left transition-colors hover:bg-muted/40"
                aria-expanded
                aria-label="Collapse study guidance"
                tabIndex={expanded ? undefined : -1}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                    {planEnabled ? "Today" : "What to do next"}
                  </p>
                  <h2 className="mt-0.5 font-semibold">
                    {planEnabled ? "Your Study plan" : "Suggested next task"}
                  </h2>
                  {planEnabled ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {progress.total
                        ? `${progress.completed} of ${progress.total} tasks complete`
                        : "Nothing scheduled today"}
                    </p>
                  ) : null}
                </div>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </button>

              {planEnabled && progress.total ? (
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
              ) : null}

              <div className="max-h-[min(430px,calc(100dvh-13rem))] space-y-3 overflow-y-auto p-3">
                {primary ? (
                  <motion.div
                    key={primary.id}
                    initial={
                      reduceMotion ? false : { opacity: 0, y: 5, scale: 0.99 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.18,
                      ease: ENTER_EASE,
                    }}
                    className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                        <TaskIcon
                          taskType={primary.taskType}
                          className="h-4 w-4"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">
                          {activityTypeLabel(primary)}
                        </p>
                        <p className="mt-1 font-semibold">{primary.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {primary.description}
                        </p>
                        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3 w-3" /> About{" "}
                          {primary.estimatedMinutes} min
                        </p>
                      </div>
                    </div>
                    <Button
                      className="mt-4 w-full"
                      onClick={() => void startGuidanceItem(primary)}
                      disabled={
                        guidancePending || planActions.pendingAction != null
                      }
                      tabIndex={expanded ? undefined : -1}
                    >
                      {guidancePending ||
                      planActions.pendingAction === "start" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {actionLabel(primary)}
                    </Button>
                  </motion.div>
                ) : (
                  <div className="rounded-xl border p-6 text-center">
                    <Check className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-2 font-medium">You’re caught up</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Open the orb later for your next useful step.
                    </p>
                  </div>
                )}

                {secondary ? (
                  <button
                    type="button"
                    onClick={() => void startGuidanceItem(secondary)}
                    className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    disabled={
                      guidancePending ||
                      secondaryPlanActions.pendingAction != null
                    }
                    tabIndex={expanded ? undefined : -1}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <TaskIcon
                        taskType={secondary.taskType}
                        className="h-4 w-4"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Another option · {activityTypeLabel(secondary)}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-medium">
                        {secondary.title}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ) : null}

                {guidanceError ||
                planActions.error ||
                secondaryPlanActions.error ? (
                  <p className="px-1 text-xs text-destructive">
                    {guidanceError ??
                      planActions.error ??
                      secondaryPlanActions.error}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-3">
                {primary ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void requestAlternative()}
                    disabled={alternativePending}
                    tabIndex={expanded ? undefined : -1}
                  >
                    {alternativePending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Suggest something else
                  </Button>
                ) : (
                  <span />
                )}
                {planEnabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    tabIndex={expanded ? undefined : -1}
                  >
                    <Link
                      href="/study-plan"
                      tabIndex={expanded ? undefined : -1}
                    >
                      Full plan
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </aside>
  );
}
