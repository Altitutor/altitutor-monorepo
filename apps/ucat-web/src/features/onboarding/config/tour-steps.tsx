import type { Step, Tour } from "nextstepjs";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Calculator,
  Flag,
  Keyboard,
  ListChecks,
  NotebookText,
  Navigation,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";
import { QuestionEngineShortcutTourContent } from "@/features/question-engine/components/question-engine-shortcut-tour-content";
import {
  UCAT_ATTEMPT_REVIEW_TOUR,
  UCAT_DASHBOARD_TOUR,
  UCAT_LEARN_TOUR,
  UCAT_MOCKS_TOUR,
  UCAT_PRACTICE_TOUR,
  UCAT_PROGRESS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
  UCAT_SECTION_PROGRESS_TOUR,
  UCAT_SETS_TOUR,
  UCAT_SKILL_TRAINER_TOUR,
  UCAT_STUDY_PLAN_TOUR,
} from "@/features/onboarding/config/tour-catalog";

export {
  getAutoStartTourForPathname,
  UCAT_ATTEMPT_REVIEW_TOUR,
  UCAT_DASHBOARD_TOUR,
  UCAT_LEARN_TOUR,
  UCAT_MOCKS_TOUR,
  UCAT_PRACTICE_TOUR,
  UCAT_PROGRESS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
  UCAT_SECTION_PROGRESS_TOUR,
  UCAT_SETS_TOUR,
  UCAT_SKILL_TRAINER_TOUR,
  UCAT_STUDY_PLAN_TOUR,
} from "@/features/onboarding/config/tour-catalog";

export const UCAT_NEXTSTEP_FIXED_VIEWPORT_ID = "ucat-nextstep-fixed-viewport";

const iconClassName = "h-5 w-5";
const fixedViewport = { viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID } as const;
const standardStep = {
  showControls: true,
  showSkip: true,
  blockKeyboardControl: true,
  pointerPadding: 8,
  pointerRadius: 12,
} as const;

export interface ContextualTourStep extends Step {
  /** Skip this step when its target is not rendered for the current student. */
  optional?: boolean;
  /** A real control the student must activate before the tutorial advances. */
  interactionSelector?: string;
}

interface ContextualTour extends Omit<Tour, "steps"> {
  steps: ContextualTourStep[];
}

const dashboardTour: ContextualTour = {
  tour: UCAT_DASHBOARD_TOUR,
  steps: [
    {
      icon: <TrendingUp className={iconClassName} />,
      title: "Your predicted score",
      content: (
        <p>
          Your predicted score trajectory will appear here once you have
          completed enough questions.
        </p>
      ),
      selector: "#tour-dashboard-predicted-score",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <Navigation className={iconClassName} />,
      title: "Your next step",
      content: (
        <p>
          This recommendation points you towards the most useful thing to do
          next, based on your Study plan or current progress.
        </p>
      ),
      selector: "[data-tour='dashboard-next-step']",
      side: "left",
      ...standardStep,
    },
    {
      icon: <ListChecks className={iconClassName} />,
      title: "Your activation checklist",
      content: (
        <p>
          These first milestones help you explore every section, create a Study
          plan, complete real work, and review your first result.
        </p>
      ),
      selector: "[data-tour='dashboard-activation-card']",
      side: "top",
      ...standardStep,
      optional: true,
    },
    {
      icon: <CalendarDays className={iconClassName} />,
      title: "This week",
      content: (
        <p>
          When you use a Study plan, this card shows how much of the current
          week you have completed and what remains.
        </p>
      ),
      selector: "[data-tour='dashboard-week-card']",
      side: "top",
      ...standardStep,
      optional: true,
    },
    {
      icon: <BrainCircuit className={iconClassName} />,
      title: "Your membership",
      content: (
        <p>
          See what your current access includes and how your practice is
          contributing to Altitutor UCAT.
        </p>
      ),
      selector: "[data-tour='dashboard-membership-card']",
      side: "top",
      ...standardStep,
      optional: true,
    },
    {
      icon: <NotebookText className={iconClassName} />,
      title: "Recent results",
      content: (
        <p>
          Return to your latest completed attempts to review answers,
          explanations, and timing.
        </p>
      ),
      selector: "[data-tour='dashboard-recent-attempts-card']",
      side: "top",
      ...standardStep,
      optional: true,
    },
    {
      icon: <BrainCircuit className={iconClassName} />,
      title: "Open your Study guidance",
      content: (
        <p>
          The orb keeps your recommended next activity close by. Open it now to
          see what it suggests; you can return to it throughout your study.
        </p>
      ),
      selector: "[data-tour='study-guidance-orb']",
      interactionSelector: "[data-tour='study-guidance-orb']",
      ...fixedViewport,
      side: "top",
      ...standardStep,
      showControls: false,
      optional: true,
    },
  ],
};

const studyPlanTour: ContextualTour = {
  tour: UCAT_STUDY_PLAN_TOUR,
  steps: [
    {
      icon: <CalendarDays className={iconClassName} />,
      title: "Your Study plan calendar",
      content: (
        <p>
          Your plan schedules tasks based on your predicted score and weaknesses to 
          get you ready for your UCAT test by your test date.
        </p>
      ),
      selector: "#tour-study-plan-calendar",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <ListChecks className={iconClassName} />,
      title: "Today’s plan",
      content: (
        <p>
          Today’s tasks appear here. Click on a task to start the activity. 
          On a rest day, you can choose extra study instead.
        </p>
      ),
      selector: "#tour-study-plan-tasks",
      side: "top",
      ...standardStep,
    },
  ],
};

const progressTour: ContextualTour = {
  tour: UCAT_PROGRESS_TOUR,
  steps: [
    {
      icon: <TrendingUp className={iconClassName} />,
      title: "Your predicted score",
      content: (
        <p>
          This graph shows your overall predicted score and percentile once you&apos;ve done enough questions.
          Your score should improve over time as you practice more.
        </p>
      ),
      selector: "#tour-progress-predicted-score",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <CalendarDays className={iconClassName} />,
      title: "Your activity",
      content: (
        <p>
          See which days you have studied on and your practice consistency.
        </p>
      ),
      selector: "#tour-progress-activity",
      side: "top",
      ...standardStep,
    },
    {
      icon: <Target className={iconClassName} />,
      title: "Score by section",
      content: (
        <p>
          Your predicted and target section scores appear here once you have
          completed enough questions.
        </p>
      ),
      selector: "#tour-progress-sections",
      side: "top",
      ...standardStep,
    },
    {
      icon: <ListChecks className={iconClassName} />,
      title: "Questions completed",
      content: (
        <p>
          Track the total number of questions you have completed in each
          section.
        </p>
      ),
      selector: "#tour-progress-questions-completed",
      side: "top",
      ...standardStep,
    },
  ],
};

const learnTour: ContextualTour = {
  tour: UCAT_LEARN_TOUR,
  steps: [
    {
      icon: <BookOpen className={iconClassName} />,
      title: "Learning modules",
      content: (
        <p>
          Learning modules teach UCAT concepts, techniques, and worked examples
          before you apply them in practice.
        </p>
      ),
      selector: "#tour-learn-page",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <BookOpen className={iconClassName} />,
      title: "Choose an area",
      content: (
        <p>
          Select general for introductory modules, or any section to browse its
          learning modules.
        </p>
      ),
      selector: "[data-tour='learn-options']",
      side: "top",
      ...standardStep,
    },
  ],
};

const skillTrainerTour: ContextualTour = {
  tour: UCAT_SKILL_TRAINER_TOUR,
  steps: [
    {
      icon: <Target className={iconClassName} />,
      title: "Practice one skill at a time",
      content: (
        <p>
          Trainers are short, timed drills that target a specific UCAT skill - 
          for example, speed reading or mental maths.
        </p>
      ),
      selector: "#tour-skill-trainer-page",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <Target className={iconClassName} />,
      title: "Choose a trainer",
      content: (
        <p>
          Select a trainer to see instructions on how to play, and begin.
        </p>
      ),
      selector: "[data-tour='skill-trainer-options']",
      side: "top",
      ...standardStep,
    },
  ],
};

const practiceTour: ContextualTour = {
  tour: UCAT_PRACTICE_TOUR,
  steps: [
    {
      icon: <BrainCircuit className={iconClassName} />,
      title: "Practice questions",
      content: (
        <p>
          Practice questions allow you to do a targeted, filtered set of questions.
          You can choose a specific question type to practice, or do a full section.
        </p>
      ),
      // Compact header target — highlighting the full filters panel (tall /
      // often taller than the viewport) makes nextstepjs loop scrollIntoView
      // and jitter the page via OnboardingScrollRepaint.
      selector: "#tour-practice-header",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <BrainCircuit className={iconClassName} />,
      title: "Begin setting up practice",
      content: (
        <p>
          Select a section and optionally specific categories, 
          then press next to select filters and begin practicing.
        </p>
      ),
      selector: "[data-tour='practice-setup']",
      side: "top",
      ...standardStep,
    },
  ],
};

const setsTour: ContextualTour = {
  tour: UCAT_SETS_TOUR,
  steps: [
    {
      icon: <ListChecks className={iconClassName} />,
      title: "Question sets",
      content: (
        <p>
          A set is a single, full-length UCAT section. 
          They can be done timed or untimed.
        </p>
      ),
      selector: "#tour-sets-page",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <ListChecks className={iconClassName} />,
      title: "Choose a section",
      content: (
        <p>
          Select a UCAT section to browse its available sets.
        </p>
      ),
      selector: "[data-tour='sets-options']",
      side: "top",
      ...standardStep,
    },
  ],
};

const mocksTour: ContextualTour = {
  tour: UCAT_MOCKS_TOUR,
  steps: [
    {
      icon: <NotebookText className={iconClassName} />,
      title: "Choose a mock exam",
      content: (
        <p>
          Mocks reproduce a full UCAT exam. In each mock, you will complete each of 
          the 4 sections back to back under timed conditions.
        </p>
      ),
      selector: "#tour-mocks-page",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <NotebookText className={iconClassName} />,
      title: "Choose a mock",
      content: (
        <p>
          Select a mock to review its structure
          before you begin.
        </p>
      ),
      selector: "[data-tour='mock-options']",
      side: "top",
      ...standardStep,
      optional: true,
    },
  ],
};

const questionEngineTour: Tour = {
  tour: UCAT_QUESTION_ENGINE_TOUR,
  steps: [
    {
      icon: <ListChecks className={iconClassName} />,
      title: "The exam menu",
      content: (
        <p>
          Open this menu to leave your attempt, contact Altitutor, or report a
          problem. Your progress is saved if you leave a live attempt.
        </p>
      ),
      selector: "[data-tour='question-engine-menu']",
      ...fixedViewport,
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <Settings className={iconClassName} />,
      title: "Question settings",
      content: (
        <p>
          Settings includes Lag mode, which lets you practice with the short
          delays that can occur in the official exam interface.
        </p>
      ),
      selector: "[data-tour='question-engine-settings']",
      ...fixedViewport,
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <Calculator className={iconClassName} />,
      title: "Open the calculator",
      content: (
        <div className="space-y-2">
          <p>Open the calculator from the toolbar or press Alt+C.</p>
          <p className="font-medium">Select Calculator to continue.</p>
        </div>
      ),
      selector: "[data-tour='question-engine-calculator']",
      side: "bottom",
      ...standardStep,
      showControls: false,
    },
    {
      icon: <Calculator className={iconClassName} />,
      title: "Try the calculator",
      content: (
        <div className="space-y-2">
          <p>
            Use the calculator buttons or keyboard. It stays fixed in place
            during this tutorial.
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-muted p-2 text-xs">
            <span>
              <kbd className="font-mono font-semibold">0–9</kbd> → 0–9
            </span>
            <span>
              <kbd className="font-mono font-semibold">.</kbd> → decimal
            </span>
            <span>
              <kbd className="font-mono font-semibold">+</kbd> → +
            </span>
            <span>
              <kbd className="font-mono font-semibold">-</kbd> → −
            </span>
            <span>
              <kbd className="font-mono font-semibold">*</kbd> → ×
            </span>
            <span>
              <kbd className="font-mono font-semibold">/</kbd> → ÷
            </span>
            <span>
              <kbd className="font-mono font-semibold">X</kbd> → √
            </span>
            <span>
              <kbd className="font-mono font-semibold">%</kbd> → %
            </span>
            <span>
              <kbd className="font-mono font-semibold">Enter / =</kbd> → =
            </span>
            <span>
              <kbd className="font-mono font-semibold">C</kbd> → MRC
            </span>
            <span>
              <kbd className="font-mono font-semibold">P</kbd> → M+
            </span>
            <span>
              <kbd className="font-mono font-semibold">M</kbd> → M−
            </span>
            <span>
              <kbd className="font-mono font-semibold">Backspace</kbd> → ON/C
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Use the on-screen buttons for +/−. Calculations are left-to-right
            (no BODMAS).
          </p>
          <p className="font-medium">Close the calculator to continue.</p>
        </div>
      ),
      selector: "[data-tour='question-engine-calculator-panel']",
      side: "left",
      ...standardStep,
      showControls: false,
    },
    {
      icon: <Flag className={iconClassName} />,
      title: "Flag questions to revisit",
      content: (
        <div className="space-y-2">
          <p>
            Flag a question when you want to return to it from the navigator or
            review screen. Press Alt+F to toggle the flag.
          </p>
          <p className="font-medium">Select Flag for Review to continue.</p>
        </div>
      ),
      selector: "[data-tour='question-engine-flag']",
      side: "bottom",
      ...standardStep,
      showControls: false,
    },
    {
      icon: <BookOpen className={iconClassName} />,
      title: "Read the question stem",
      content: (
        <p>
          In Verbal Reasoning, the passage stays in the left column while you
          move through the questions linked to it.
        </p>
      ),
      selector: "[data-tour='question-engine-stem']",
      side: "right",
      ...standardStep,
    },
    {
      icon: <ListChecks className={iconClassName} />,
      title: "Answer the question",
      content: (
        <div className="space-y-2">
          <p>
            The active question and its answer options appear in the right
            column. Select an option with the mouse or its letter key.
          </p>
          <p className="font-medium">Select any answer to continue.</p>
        </div>
      ),
      selector: "[data-tour='question-engine-question']",
      side: "left",
      ...standardStep,
      showControls: false,
    },
    {
      icon: <ArrowRight className={iconClassName} />,
      title: "Go to the next question",
      content: (
        <div className="space-y-2">
          <p>Use Next or press Alt+N to move forward one question.</p>
          <p className="font-medium">Select Next to continue.</p>
        </div>
      ),
      selector: "[data-tour='question-engine-next']",
      side: "top",
      ...standardStep,
      showControls: false,
    },
    {
      icon: <ArrowLeft className={iconClassName} />,
      title: "Go to the previous question",
      content: (
        <div className="space-y-2">
          <p>Use Previous or press Alt+P to move back one question.</p>
          <p className="font-medium">Select Previous to continue.</p>
        </div>
      ),
      selector: "[data-tour='question-engine-previous']",
      side: "top",
      ...standardStep,
      showControls: false,
    },
    {
      icon: <Navigation className={iconClassName} />,
      title: "Open the navigator",
      content: (
        <div className="space-y-2">
          <p>The navigator shows which questions are incomplete or flagged.</p>
          <p className="font-medium">Select Navigator to continue.</p>
        </div>
      ),
      selector: "[data-tour='question-engine-navigator']",
      side: "top",
      ...standardStep,
      showControls: false,
    },
    {
      icon: <Navigation className={iconClassName} />,
      title: "Use the navigator",
      content: (
        <div className="space-y-2">
          <p>Double-click a question to go directly to that question.</p>
          <p className="font-medium">
            Double-click a question or select Close to continue.
          </p>
        </div>
      ),
      selector: "[data-tour='question-engine-navigator-panel']",
      side: "bottom",
      ...standardStep,
      showControls: false,
    },
    {
      icon: <Keyboard className={iconClassName} />,
      title: "Keyboard shortcuts",
      content: <QuestionEngineShortcutTourContent />,
      ...standardStep,
      showSkip: false,
    },
    {
      icon: <ListChecks className={iconClassName} />,
      title: "Open the review screen",
      content: (
        <div className="space-y-2">
          <p>
            Review appears when you reach the last question. Select it to check
            incomplete and flagged questions before finishing an exam.
          </p>
          <p className="font-medium">Select Review to continue.</p>
        </div>
      ),
      selector: "[data-tour='question-engine-next']",
      side: "top",
      ...standardStep,
      showControls: false,
    },
    {
      icon: <Flag className={iconClassName} />,
      title: "Finish the tutorial",
      content: (
        <div className="space-y-2">
          <p>
            In a real attempt, this control finishes the practice session or
            exam.
          </p>
          <p className="font-medium">
            Select Finish tutorial to complete the tutorial.
          </p>
        </div>
      ),
      selector: "[data-tour='question-engine-finish-tutorial']",
      side: "top",
      ...standardStep,
      showControls: false,
      showSkip: false,
    },
  ],
};

const sectionProgressTour: ContextualTour = {
  tour: UCAT_SECTION_PROGRESS_TOUR,
  steps: [
    {
      icon: <Target className={iconClassName} />,
      title: "Predicted section score",
      content: (
        <p>
          Your current estimated UCAT score for this section, with a simplified
          trajectory based on weighted attempt evidence.
        </p>
      ),
      selector: "#tour-section-predicted-score",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <TrendingUp className={iconClassName} />,
      title: "Section statistics",
      content: (
        <p>
          These three cards summarise accuracy, completed questions, and timing
          for this section.
        </p>
      ),
      selector: "#tour-section-stats",
      side: "top",
      ...standardStep,
    },
    {
      icon: <BrainCircuit className={iconClassName} />,
      title: "Practice sessions",
      content: (
        <p>
          Review your practice history. Use the graph control to change its
          y-axis metric, which also changes the selected table column.
        </p>
      ),
      selector: "#tour-section-practice-attempts",
      side: "top",
      ...standardStep,
    },
    {
      icon: <ListChecks className={iconClassName} />,
      title: "Set attempts",
      content: (
        <p>
          Review completed sets and change the graph y-axis or corresponding
          table metric to compare different results.
        </p>
      ),
      selector: "#tour-section-set-attempts",
      side: "top",
      ...standardStep,
    },
  ],
};

const attemptReviewTour: ContextualTour = {
  tour: UCAT_ATTEMPT_REVIEW_TOUR,
  steps: [
    {
      icon: <Target className={iconClassName} />,
      title: "Score",
      content: (
        <p>
          This card summarises the result, including scaled score or points
          where available.
        </p>
      ),
      selector: "#tour-attempt-score",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <TrendingUp className={iconClassName} />,
      title: "Timing",
      content: (
        <p>
          Compare time taken and pace with the available set, mock, or practice
          timing.
        </p>
      ),
      selector: "#tour-attempt-timing",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <Navigation className={iconClassName} />,
      title: "Question navigator",
      content: (
        <p>
          Select a question to move directly to it. Switch between the simple
          navigator and timing graph to inspect the attempt from either view.
        </p>
      ),
      selector: "#tour-attempt-navigator",
      side: "top",
      ...standardStep,
    },
    {
      icon: <BookOpen className={iconClassName} />,
      title: "Question reviewer",
      content: (
        <p>
          Review the original question, your answer, and the correct answer. Use
          Previous and Next to move through the attempt, and rate the question
          if its content needs attention.
        </p>
      ),
      selector: "#tour-attempt-reviewer",
      side: "top",
      ...standardStep,
    },
    {
      icon: <Flag className={iconClassName} />,
      title: "Answer explanation",
      content: (
        <p>
          Read the explanation for the selected question. Use the upvote or
          downvote controls if the explanation needs attention.
        </p>
      ),
      selector: "#tour-attempt-explanation",
      side: "top",
      ...standardStep,
    },
    {
      icon: <TrendingUp className={iconClassName} />,
      title: "Question timing and properties",
      content: (
        <p>
          Compare your time with the available benchmark and inspect the
          question properties used to describe this item.
        </p>
      ),
      selector: "#tour-attempt-question-properties",
      side: "top",
      ...standardStep,
      optional: true,
    },
  ],
};

export const ucatOnboardingTours: Tour[] = [
  dashboardTour,
  studyPlanTour,
  progressTour,
  learnTour,
  skillTrainerTour,
  practiceTour,
  setsTour,
  mocksTour,
  questionEngineTour,
  sectionProgressTour,
  attemptReviewTour,
];

export const ALL_UCAT_TOUR_IDS = [
  UCAT_DASHBOARD_TOUR,
  UCAT_STUDY_PLAN_TOUR,
  UCAT_PROGRESS_TOUR,
  UCAT_LEARN_TOUR,
  UCAT_SKILL_TRAINER_TOUR,
  UCAT_PRACTICE_TOUR,
  UCAT_SETS_TOUR,
  UCAT_MOCKS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
  UCAT_SECTION_PROGRESS_TOUR,
  UCAT_ATTEMPT_REVIEW_TOUR,
] as const;

export const UCAT_TOUR_REPLAY_OPTIONS = [
  { tourId: UCAT_DASHBOARD_TOUR, label: "Dashboard", href: "/dashboard" },
  {
    tourId: UCAT_STUDY_PLAN_TOUR,
    label: "Study plan",
    href: "/study-plan",
  },
  { tourId: UCAT_PROGRESS_TOUR, label: "Progress", href: "/progress" },
  { tourId: UCAT_LEARN_TOUR, label: "Learn", href: "/learn" },
  {
    tourId: UCAT_SKILL_TRAINER_TOUR,
    label: "Skill trainer",
    href: "/skill-trainer",
  },
  {
    tourId: UCAT_PRACTICE_TOUR,
    label: "Practice questions",
    href: "/practice",
  },
  {
    tourId: UCAT_SETS_TOUR,
    label: "Sets",
    href: "/sets",
  },
  { tourId: UCAT_MOCKS_TOUR, label: "Mocks", href: "/mocks" },
  {
    tourId: UCAT_QUESTION_ENGINE_TOUR,
    label: "Question interface",
    href: "/exam/tutorial?replay=1&returnTo=%2Fsettings%2Fapp",
  },
] as const;

export function getTourStep(
  tourId: string | null,
  stepIndex: number,
): ContextualTourStep | null {
  if (!tourId) return null;
  const tour = ucatOnboardingTours.find(
    (candidate) => candidate.tour === tourId,
  );
  return (tour?.steps[stepIndex] as ContextualTourStep | undefined) ?? null;
}

export function getFirstSelectorForTour(tourId: string): string | null {
  return (
    ucatOnboardingTours.find((tour) => tour.tour === tourId)?.steps[0]
      ?.selector ?? null
  );
}
