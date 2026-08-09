"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Gauge,
  Flame,
  Loader2,
  MoveRight,
  NotebookText,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { createAndPersistPracticeSession } from "@/features/practice/api/create-practice-session";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import {
  saveStudyPlan,
  suggestAlternativeStudyGuidance,
} from "@/features/study-plan/api/study-plan";
import { useStudyPlanCompanion } from "@/features/study-plan/context/study-plan-companion-context";
import {
  describeAttemptReviewCompanionNotice,
  describeAttemptReviewCompanionStatus,
  selectCompanionSecondaryWhileReviewing,
  shouldDismissAttemptReviewPrompt,
} from "@/features/study-plan/lib/attempt-review-companion";
import { describeCompanionPrimaryChrome } from "@/features/study-plan/lib/companion-primary-chrome";
import {
  DASHBOARD_STUDY_PLAN_QUERY_KEY,
  STUDY_PLAN_QUERY_KEY,
  useStudyPlan,
} from "@/features/study-plan/hooks/use-study-plan";
import { useStudyPlanTaskActions } from "@/features/study-plan/hooks/use-study-plan-task-actions";
import { useStudyPlanExtraStudyDialog } from "@/features/study-plan/components/study-plan-extra-study";
import {
  findNewlyCompletedTask,
  getTodayStudyPlanProgress,
  mapStudyPlanTaskStatuses,
  selectCurrentStudyPlanTasks,
} from "@/features/study-plan/lib/companion";
import {
  isAlreadyOnSuggestedActivity,
  type StudyPlanCompanionMode,
} from "@/features/study-plan/lib/companion-mode";
import {
  defaultSkippedGoalProfileInput,
  hasStudyPlanGoal,
} from "@/features/study-plan/lib/default-study-profile";
import {
  describeStudyNextAction,
  resolveStudyNextAction,
  type StudyNextAction,
} from "@/features/study-plan/lib/next-action";
import {
  firstGuidanceTriggerKey,
  guidanceItemKey,
} from "@/features/study-plan/lib/next-step-guidance";
import { studyPlanActivityTypeLabel } from "@/features/study-plan/lib/activity-type-label";
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
import {
  UCAT_STUDY_ORB_INTRO_SEEN,
  UCAT_STUDY_PLAN_DECIDED,
} from "@/features/onboarding/lib/activation-milestones";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import { cn } from "@/lib/utils";
import { useUcatActivity } from "@/features/progress/hooks/use-ucat-activity";
import { buildPracticeStreak } from "@/features/streaks/lib/practice-streak";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";
import { useUcatInterfacePreferences } from "@/features/interface-preferences/hooks/use-ucat-interface-preferences";

const ENTER_EASE = [0.32, 0.72, 0, 1] as const;
const EXPAND_DURATION = 0.22;
const CELEBRATION_DURATION_MS = 4_500;
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
  activityTypeLabel: string;
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

function planDisplayItem(
  task: StudyPlanTask,
  sourceTask?: StudyPlanTask | null,
): GuidanceDisplayItem {
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
    activityTypeLabel: studyPlanActivityTypeLabel(task, sourceTask),
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
    activityTypeLabel: studyPlanActivityTypeLabel(item),
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

function sessionTimeLabel(session: {
  start_at: string | null;
  end_at: string | null;
}): string | null {
  if (!session.start_at || !session.end_at) return null;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide",
    hour: "numeric",
    minute: "2-digit",
  }).formatRange(new Date(session.start_at), new Date(session.end_at));
}

function nextActionTriggerKey(action: StudyNextAction | null): string | null {
  if (!action) return null;
  switch (action.kind) {
    case "session":
      return `session:${action.session.session_id}:${action.live ? "live" : "soon"}`;
    case "task":
      return action.task.id;
    case "guidance":
      return firstGuidanceTriggerKey([
        action.primary,
        ...(action.secondary ? [action.secondary] : []),
      ]);
    case "caught_up":
      return `caught_up:${action.hadTasksToday ? "done" : "rest"}:${action.nextStudyDate ?? "none"}`;
    case "plan_setup":
      return "plan_setup";
    case "goal_setup":
      return "goal_setup";
    case "plan_error":
      return "plan_error";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
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
  const { preferences } = useUcatInterfacePreferences();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const query = useStudyPlan();
  const activityQuery = useUcatActivity();
  const sessionsQuery = useStudentUcatSessions();
  const { activityComplete, activityCompletion, consumeActivityCompletion, attemptReviewGuidance } =
    useStudyPlanCompanion();
  const { bottomFloatingDockVisible } = useAppShellLayout();
  const openExtraStudy = useStudyPlanExtraStudyDialog();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const onboardingProgress = useOnboardingProgress();
  const completeMilestone = useCompleteOnboardingTour();
  const orbIntroSeen = onboardingProgress.isCompleted(
    UCAT_STUDY_ORB_INTRO_SEEN,
  );
  const studyPlanDecided = onboardingProgress.isCompleted(
    UCAT_STUDY_PLAN_DECIDED,
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
  const [now, setNow] = useState(() => new Date());
  const [setupPending, setSetupPending] = useState(false);
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
  const reviewPromptDismissedRef = useRef(false);
  const pageReviewActiveRef = useRef(false);
  const pageReviewNoticeRef = useRef<GuidanceNotice | null>(null);
  const data = query.data;
  const planEnabled = data?.profile?.studyPlanEnabled ?? false;
  const actionReady =
    !query.isLoading &&
    !onboardingProgress.isLoading &&
    (data != null || query.isError || query.isFetched);
  const sessions = useMemo(
    () => sessionsQuery.data ?? [],
    [sessionsQuery.data],
  );
  const hasGoal = hasStudyPlanGoal(data?.profile);
  const nextAction = useMemo(() => {
    if (!actionReady) return null;
    return resolveStudyNextAction({
      now,
      sessions,
      plan: data,
      planLoadFailed: query.isError,
      studyPlanDecided,
      hasGoal,
    });
  }, [
    actionReady,
    data,
    hasGoal,
    now,
    query.isError,
    sessions,
    studyPlanDecided,
  ]);
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
  const guidanceKey = nextActionTriggerKey(nextAction);
  const baseItems = useMemo<GuidanceDisplayItem[]>(() => {
    if (!nextAction) return [];
    if (nextAction.kind === "task") {
      const sourceTask = nextAction.task.sourceTaskId
        ? (data?.tasks.find(
            (task) => task.id === nextAction.task.sourceTaskId,
          ) ?? null)
        : null;
      const primary = planDisplayItem(nextAction.task, sourceTask);
      const secondaryTask = actionablePlanTasks.find(
        (task) => task.id !== nextAction.task.id,
      );
      return secondaryTask
        ? [
            primary,
            planDisplayItem(
              secondaryTask,
              secondaryTask.sourceTaskId
                ? (data?.tasks.find(
                    (task) => task.id === secondaryTask.sourceTaskId,
                  ) ?? null)
                : null,
            ),
          ]
        : [primary];
    }
    if (nextAction.kind === "guidance") {
      return [
        nextStepDisplayItem(nextAction.primary),
        ...(nextAction.secondary
          ? [nextStepDisplayItem(nextAction.secondary)]
          : []),
      ];
    }
    return [];
  }, [actionablePlanTasks, data?.tasks, nextAction]);
  const activeAlternative =
    guidanceKey && alternativeState?.guidanceKey === guidanceKey
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
  const pageReviewActive = Boolean(
    attemptReviewGuidance &&
      attemptReviewGuidance.remainingCount > 0 &&
      attemptReviewGuidance.requiredCount > 0,
  );
  const reviewSecondary = useMemo(
    () =>
      pageReviewActive
        ? selectCompanionSecondaryWhileReviewing({
            pathname,
            items,
          })
        : null,
    [items, pageReviewActive, pathname],
  );
  const secondary = pageReviewActive ? reviewSecondary : (items[1] ?? null);
  const pageReviewNotice = useMemo(
    () =>
      pageReviewActive && attemptReviewGuidance
        ? describeAttemptReviewCompanionNotice({
            remainingCount: attemptReviewGuidance.remainingCount,
          })
        : null,
    [attemptReviewGuidance, pageReviewActive],
  );
  const pageReviewStatus = useMemo(
    () =>
      pageReviewActive && attemptReviewGuidance
        ? describeAttemptReviewCompanionStatus({
            viewedCount: attemptReviewGuidance.viewedCount,
            requiredCount: attemptReviewGuidance.requiredCount,
          })
        : null,
    [attemptReviewGuidance, pageReviewActive],
  );
  const primaryChrome = useMemo(() => {
    if (!primary) return null;
    return describeCompanionPrimaryChrome({
      taskType: primary.taskType,
      planTaskStatus: primary.planTask?.status ?? null,
      fromEarlierStudyDay:
        nextAction?.kind === "task" ? nextAction.fromEarlierStudyDay : false,
      isAlternative: Boolean(activeAlternative),
    });
  }, [activeAlternative, nextAction, primary]);
  const progress = useMemo(
    () => getTodayStudyPlanProgress(currentPlanTasks),
    [currentPlanTasks],
  );
  const planActions = useStudyPlanTaskActions(primary?.planTask ?? null);
  const secondaryPlanActions = useStudyPlanTaskActions(
    secondary?.planTask ?? null,
  );
  const actionContent = useMemo(() => {
    if (!nextAction) return null;
    return describeStudyNextAction(nextAction, {
      sessionTimeLabel:
        nextAction.kind === "session"
          ? sessionTimeLabel(nextAction.session)
          : null,
    });
  }, [nextAction]);
  const activityInProgress = mode === "activity" && !activityComplete;
  const suggestionsEnabled = Boolean(
    preferences.studySuggestionsVisible && !hidden,
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
  pageReviewActiveRef.current = pageReviewActive;
  pageReviewNoticeRef.current = pageReviewNotice;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
        if (
          pageReviewActiveRef.current &&
          pageReviewNoticeRef.current &&
          !reviewPromptDismissedRef.current
        ) {
          setLatestNotice(pageReviewNoticeRef.current);
          setPromptVisible(true);
          return;
        }
        const launchPath = primaryLaunchPathRef.current;
        const alreadyOnNext =
          launchPath != null &&
          isAlreadyOnSuggestedActivity(pathnameRef.current, launchPath);
        // Stay silent while still inside an unfinished activity, or when the
        // suggested next step is the page we just landed on (e.g. attempt review
        // with nothing left to guide in-page).
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
        : actionContent?.title ?? "You’re caught up for today.",
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
  }, [actionContent?.title, celebration, data, primary]);

  useEffect(() => {
    if (!guidanceKey || !nextAction || !actionContent) return;
    if (activityInProgress) return;
    if (pageReviewActive) return;
    if (previousGuidanceKeyRef.current === guidanceKey) return;
    const hadPreviousGuidance = previousGuidanceKeyRef.current != null;
    previousGuidanceKeyRef.current = guidanceKey;
    if (suppressNextGuidancePromptRef.current) {
      suppressNextGuidancePromptRef.current = false;
      return;
    }
    if (
      nextAction.kind === "caught_up" ||
      nextAction.kind === "plan_error"
    ) {
      return;
    }
    if (
      primary &&
      isAlreadyOnSuggestedActivity(pathname, primary.launchPath)
    ) {
      return;
    }
    const notice: GuidanceNotice = {
      id: `guidance:${guidanceKey}`,
      eyebrow: hadPreviousGuidance
        ? actionContent.eyebrow
        : nextAction.kind === "session" ||
            nextAction.kind === "task" ||
            nextAction.kind === "guidance"
          ? "Ready when you are"
          : actionContent.eyebrow,
      title: actionContent.title,
      detail: actionContent.rationale ?? actionContent.description,
    };
    setLatestNotice(notice);
    setPromptVisible(true);
  }, [
    actionContent,
    activityInProgress,
    guidanceKey,
    nextAction,
    pageReviewActive,
    pathname,
    primary,
  ]);

  useEffect(() => {
    if (!pageReviewActive || !pageReviewNotice || !attemptReviewGuidance) {
      return;
    }

    if (
      shouldDismissAttemptReviewPrompt({
        landingQuestionIndex: attemptReviewGuidance.landingQuestionIndex,
        selectedQuestionIndex: attemptReviewGuidance.selectedQuestionIndex,
      })
    ) {
      reviewPromptDismissedRef.current = true;
      setPromptVisible(false);
      return;
    }

    if (celebration || reviewPromptDismissedRef.current) return;

    setLatestNotice(pageReviewNotice);
    setPromptVisible(true);
  }, [
    attemptReviewGuidance,
    celebration,
    pageReviewActive,
    pageReviewNotice,
  ]);

  useEffect(() => {
    setExpanded(false);
    reviewPromptDismissedRef.current = false;
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
        router.push("/exam");
        return;
      }
      router.push(item.launchPath);
    } catch (caught) {
      if (caught instanceof QuotaExceededError) {
        openQuotaLimit(caught.payload, {
          dismissAction: item.planTask
            ? { href: "/study-plan", label: "Back to Study plan" }
            : { label: "Dismiss", variant: "dismiss" },
        });
        return;
      }
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

  async function handleSkipGoal() {
    setSetupPending(true);
    setGuidanceError(null);
    try {
      const nextPlan = await saveStudyPlan(defaultSkippedGoalProfileInput());
      queryClient.setQueryData(DASHBOARD_STUDY_PLAN_QUERY_KEY, nextPlan);
      queryClient.setQueryData(STUDY_PLAN_QUERY_KEY, nextPlan);
      await queryClient.invalidateQueries({ queryKey: STUDY_PLAN_QUERY_KEY });
    } catch (caught) {
      setGuidanceError(
        caught instanceof Error
          ? caught.message
          : "Could not continue without a goal.",
      );
    } finally {
      setSetupPending(false);
    }
  }

  async function handlePrimaryAction() {
    if (!nextAction) return;
    switch (nextAction.kind) {
      case "task":
      case "guidance":
        if (primary) await startGuidanceItem(primary);
        return;
      case "caught_up":
        openExtraStudy();
        return;
      case "plan_error":
        void query.refetch();
        return;
      case "session":
      case "plan_setup":
      case "goal_setup":
        return;
      default: {
        const _exhaustive: never = nextAction;
        return _exhaustive;
      }
    }
  }

  function handleStartPageReview() {
    if (!attemptReviewGuidance) return;
    reviewPromptDismissedRef.current = true;
    setPromptVisible(false);
    setExpanded(false);
    attemptReviewGuidance.startReviewing();
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
              onClick={() => {
                reviewPromptDismissedRef.current = true;
                setPromptVisible(false);
              }}
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
                    Suggested next step
                  </p>
                  <h2 className="mt-0.5 font-semibold">
                    {planEnabled ? "Your Study plan" : "What to do next"}
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
                {pageReviewActive && pageReviewStatus ? (
                  <motion.div
                    key={`review-status:${pageReviewStatus.detail}`}
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
                        <TaskIcon taskType="review" className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">
                          Review
                        </p>
                        <p className="mt-1 font-semibold">
                          {pageReviewStatus.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {pageReviewStatus.detail}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="mt-4 w-full"
                      onClick={handleStartPageReview}
                      tabIndex={expanded ? undefined : -1}
                    >
                      {pageReviewStatus.actionLabel}
                      <MoveRight className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.div>
                ) : !actionReady || !nextAction || !actionContent ? (
                  <div className="flex items-center justify-center rounded-xl border p-8">
                    <Loader2
                      className="h-5 w-5 animate-spin text-muted-foreground"
                      aria-label="Loading next step"
                    />
                  </div>
                ) : primary ? (
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
                          {primaryChrome?.eyebrow ?? actionContent.eyebrow} ·{" "}
                          {primary.activityTypeLabel}
                        </p>
                        <p className="mt-1 font-semibold">{primary.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {primary.description}
                        </p>
                        {primary.rationale ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {primary.rationale}
                          </p>
                        ) : null}
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
                      {primaryChrome?.primaryLabel ?? actionContent.primaryLabel}
                    </Button>
                  </motion.div>
                ) : (
                  <div className="rounded-xl border p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                        {nextAction.kind === "session" ? (
                          <CalendarDays className="h-4 w-4" />
                        ) : nextAction.kind === "goal_setup" ? (
                          <Target className="h-4 w-4" />
                        ) : nextAction.kind === "caught_up" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">
                          {actionContent.eyebrow}
                        </p>
                        <p className="mt-1 font-semibold">{actionContent.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {actionContent.description}
                        </p>
                        {actionContent.rationale ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {actionContent.rationale}
                          </p>
                        ) : null}
                        {actionContent.meta ? (
                          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="h-3 w-3" />
                            {actionContent.meta}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      {actionContent.primaryHref ? (
                        <Button className="w-full" asChild tabIndex={expanded ? undefined : -1}>
                          <Link
                            href={actionContent.primaryHref}
                            tabIndex={expanded ? undefined : -1}
                          >
                            {actionContent.primaryLabel}
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => void handlePrimaryAction()}
                          disabled={
                            setupPending ||
                            (nextAction.kind === "plan_error" && query.isFetching)
                          }
                          tabIndex={expanded ? undefined : -1}
                        >
                          {setupPending ||
                          (nextAction.kind === "plan_error" &&
                            query.isFetching) ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          {actionContent.primaryLabel}
                        </Button>
                      )}
                      {nextAction.kind === "goal_setup" ? (
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => void handleSkipGoal()}
                          disabled={setupPending}
                          tabIndex={expanded ? undefined : -1}
                        >
                          Skip for now
                        </Button>
                      ) : null}
                      {nextAction.kind === "caught_up" && planEnabled ? (
                        <Button
                          className="w-full"
                          variant="outline"
                          asChild
                          tabIndex={expanded ? undefined : -1}
                        >
                          <Link href="/study-plan" tabIndex={expanded ? undefined : -1}>
                            View Study plan
                          </Link>
                        </Button>
                      ) : null}
                    </div>
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
                        Another option · {secondary.activityTypeLabel}
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
