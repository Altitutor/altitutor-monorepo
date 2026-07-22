import type { Tour } from "nextstepjs";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Calculator,
  Flag,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  NotebookText,
  Navigation,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";
import { QuestionEngineShortcutTourContent } from "@/features/question-engine/components/question-engine-shortcut-tour-content";

export const UCAT_NEXTSTEP_FIXED_VIEWPORT_ID = "ucat-nextstep-fixed-viewport";

export const UCAT_ONBOARDING_TOUR = "ucat-welcome";
export const UCAT_PROGRESS_TOUR = "ucat-progress-intro";
export const UCAT_LEARN_TOUR = "ucat-learn-intro";
export const UCAT_SESSIONS_TOUR = "ucat-sessions-intro";
export const UCAT_SKILL_TRAINER_TOUR = "ucat-skill-trainer-intro";
export const UCAT_PRACTICE_TOUR = "ucat-practice-intro";
export const UCAT_SECTION_SETS_TOUR = "ucat-section-sets-intro";
export const UCAT_MOCKS_TOUR = "ucat-mocks-intro";
export const UCAT_QUESTION_ENGINE_TOUR = "ucat-question-engine-intro";
export const UCAT_SECTION_PROGRESS_TOUR = "ucat-section-progress-intro";
export const UCAT_ATTEMPT_REVIEW_TOUR = "ucat-attempt-review-intro";
export const UCAT_LEARNING_MODULE_TOUR = "ucat-learning-module-intro";

const iconClassName = "h-5 w-5";
const fixedViewport = { viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID } as const;
const standardStep = {
  showControls: true,
  showSkip: true,
  pointerPadding: 8,
  pointerRadius: 12,
} as const;

const welcomeTour: Tour = {
  tour: UCAT_ONBOARDING_TOUR,
  steps: [
    {
      icon: <LayoutDashboard className={iconClassName} />,
      title: "Start from the dashboard",
      content: (
        <p>
          The dashboard brings together your next class, recent work, and the
          areas you can continue. Use the sidebar whenever you want to switch
          tasks.
        </p>
      ),
      selector: "[data-tour='nav-dashboard']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
    },
    {
      icon: <BookOpen className={iconClassName} />,
      title: "Learn",
      content: (
        <p>Open learning modules for UCAT theory and worked examples.</p>
      ),
      selector: "[data-tour='nav-learn']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
    },
    {
      icon: <CalendarDays className={iconClassName} />,
      title: "Sessions",
      content: (
        <p>Find class resources linked by your tutor after each session.</p>
      ),
      selector: "[data-tour='nav-sessions']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
    },
    {
      icon: <Target className={iconClassName} />,
      title: "Skill trainer",
      content: <p>Use short drills to practise one UCAT skill at a time.</p>,
      selector: "[data-tour='nav-skill-trainer']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
    },
    {
      icon: <BrainCircuit className={iconClassName} />,
      title: "Practice questions",
      content: <p>Build a filtered question session with your own timing.</p>,
      selector: "[data-tour='nav-practice']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
    },
    {
      icon: <ListChecks className={iconClassName} />,
      title: "Work through sets",
      content: (
        <p>
          Sets group questions into section-based practice. Open Sets, choose a
          UCAT section, then select the set you want to attempt.
        </p>
      ),
      selector: "[data-tour='nav-sets']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
    },
    {
      icon: <NotebookText className={iconClassName} />,
      title: "Use mocks for exam practice",
      content: (
        <p>
          Mocks combine multiple sets into an exam-style attempt. Open one when
          you want to practise the full sequence.
        </p>
      ),
      selector: "[data-tour='nav-mocks']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
    },
    {
      icon: <TrendingUp className={iconClassName} />,
      title: "Progress",
      content: (
        <p>Review results across practice questions, sets, and mocks.</p>
      ),
      selector: "[data-tour='nav-progress']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
    },
    {
      icon: <Settings className={iconClassName} />,
      title: "Replay a guide",
      content: (
        <p>
          Settings includes App tours. Use it if you want to see this guide or a
          page guide again.
        </p>
      ),
      selector: "[data-tour='nav-settings']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
      showSkip: false,
    },
  ],
};

const progressTour: Tour = {
  tour: UCAT_PROGRESS_TOUR,
  steps: [
    {
      icon: <TrendingUp className={iconClassName} />,
      title: "Review your progress",
      content: (
        <p>
          This page summarises the work you have completed and how your results
          change over time.
        </p>
      ),
      selector: "#tour-progress-header",
      side: "bottom",
      ...standardStep,
    },
    {
      icon: <TrendingUp className={iconClassName} />,
      title: "Open a section",
      content: (
        <p>Click a section card to view progress for that UCAT section.</p>
      ),
      selector: "#tour-progress-sections",
      side: "top",
      ...standardStep,
      showSkip: false,
    },
  ],
};

const sessionsTour: Tour = {
  tour: UCAT_SESSIONS_TOUR,
  steps: [
    {
      icon: <CalendarDays className={iconClassName} />,
      title: "Find your class resources",
      content: (
        <p>
          Sessions are ordered by date. After a class has run, open it to find
          the sets, mocks, and other resources linked by your tutor.
        </p>
      ),
      selector: "#tour-sessions-page",
      side: "bottom",
      ...standardStep,
      showSkip: false,
    },
  ],
};

const skillTrainerTour: Tour = {
  tour: UCAT_SKILL_TRAINER_TOUR,
  steps: [
    {
      icon: <Target className={iconClassName} />,
      title: "Practice one skill at a time",
      content: (
        <p>
          Trainers are grouped by UCAT section. Choose the specific skill you
          want to improve, then start its short timed drill.
        </p>
      ),
      selector: "#tour-skill-trainer-page",
      side: "bottom",
      ...standardStep,
      showSkip: false,
    },
  ],
};

const practiceTour: Tour = {
  tour: UCAT_PRACTICE_TOUR,
  steps: [
    {
      icon: <BrainCircuit className={iconClassName} />,
      title: "Build a practice session",
      content: (
        <p>
          Work through the setup steps to choose the section, topics, number of
          questions, and timing that fit what you want to practise today.
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
      title: "Continue through the setup",
      content: (
        <p>
          Use Next to finish the filters, then Start practice. Each attempt is
          saved to Progress automatically.
        </p>
      ),
      selector: "[data-tour='practice-primary-action']",
      side: "top",
      ...standardStep,
      showSkip: false,
    },
  ],
};

const sectionSetsTour: Tour = {
  tour: UCAT_SECTION_SETS_TOUR,
  steps: [
    {
      icon: <ListChecks className={iconClassName} />,
      title: "Choose a section set",
      content: (
        <p>
          This list contains sets for the section you selected. Search or filter
          the list, then open a set to review its timing before starting.
        </p>
      ),
      selector: "#tour-section-sets-page",
      side: "bottom",
      ...standardStep,
      showSkip: false,
    },
  ],
};

const mocksTour: Tour = {
  tour: UCAT_MOCKS_TOUR,
  steps: [
    {
      icon: <NotebookText className={iconClassName} />,
      title: "Choose a mock exam",
      content: (
        <p>
          Open a mock to review its sections and timing before you begin. Your
          completed attempt will be available in Progress.
        </p>
      ),
      selector: "#tour-mocks-page",
      side: "bottom",
      ...standardStep,
      showSkip: false,
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
          Settings includes Lag mode, which lets you practise with the short
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

const sectionProgressTour: Tour = {
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
      showSkip: false,
    },
  ],
};

const attemptReviewTour: Tour = {
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
          Select a question or graph bar to move directly to that question in
          the reviewer.
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
          Review the original question, your answer, and the correct answer.
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
      showSkip: false,
    },
  ],
};

const learningModuleTour: Tour = {
  tour: UCAT_LEARNING_MODULE_TOUR,
  steps: [
    {
      icon: <BookOpen className={iconClassName} />,
      title: "Lesson content",
      content: (
        <p>
          Work through the lesson blocks in order. Your progress is saved as you
          complete them.
        </p>
      ),
      selector: "#tour-learning-content",
      side: "right",
      ...standardStep,
    },
    {
      icon: <Navigation className={iconClassName} />,
      title: "Lesson navigation",
      content: (
        <p>
          Use the contents panel to see completion and jump to an available
          block. Move between lessons with the previous and next controls.
        </p>
      ),
      selector: "#tour-learning-navigation",
      side: "left",
      ...standardStep,
      showSkip: false,
    },
  ],
};

export const ucatOnboardingTours: Tour[] = [
  welcomeTour,
  progressTour,
  sessionsTour,
  skillTrainerTour,
  practiceTour,
  sectionSetsTour,
  mocksTour,
  questionEngineTour,
  sectionProgressTour,
  attemptReviewTour,
  learningModuleTour,
];

export const ALL_UCAT_TOUR_IDS = [
  UCAT_ONBOARDING_TOUR,
  UCAT_PROGRESS_TOUR,
  UCAT_SESSIONS_TOUR,
  UCAT_SKILL_TRAINER_TOUR,
  UCAT_PRACTICE_TOUR,
  UCAT_SECTION_SETS_TOUR,
  UCAT_MOCKS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
  UCAT_SECTION_PROGRESS_TOUR,
  UCAT_ATTEMPT_REVIEW_TOUR,
  UCAT_LEARNING_MODULE_TOUR,
] as const;

export const UCAT_TOUR_REPLAY_OPTIONS = [
  { tourId: UCAT_ONBOARDING_TOUR, label: "App tour", href: "/dashboard" },
  { tourId: UCAT_PROGRESS_TOUR, label: "Progress", href: "/progress" },
  { tourId: UCAT_LEARN_TOUR, label: "Learn", href: "/learn" },
  { tourId: UCAT_SESSIONS_TOUR, label: "Sessions", href: "/sessions" },
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
    tourId: UCAT_SECTION_SETS_TOUR,
    label: "Section sets",
    href: "/sets/sections/1",
  },
  { tourId: UCAT_MOCKS_TOUR, label: "Mocks", href: "/mocks" },
  {
    tourId: UCAT_QUESTION_ENGINE_TOUR,
    label: "Question interface",
    href: "/exam/tutorial?replay=1&returnTo=%2Fsettings%2Fapp",
  },
] as const;

const PATHNAME_TO_TOUR: Record<string, string> = {
  "/dashboard": UCAT_ONBOARDING_TOUR,
  "/progress": UCAT_PROGRESS_TOUR,
  "/learn": UCAT_LEARN_TOUR,
  "/sessions": UCAT_SESSIONS_TOUR,
  "/skill-trainer": UCAT_SKILL_TRAINER_TOUR,
  "/practice": UCAT_PRACTICE_TOUR,
  "/mocks": UCAT_MOCKS_TOUR,
  "/exam/tutorial": UCAT_QUESTION_ENGINE_TOUR,
};

const SECTION_SETS_PATH_PATTERN = /^\/sets\/sections\/[1-4]\/?$/;
const SECTION_PROGRESS_PATH_PATTERN = /^\/progress\/sections\/[1-4]\/?$/;
const LEARNING_MODULE_PATH_PATTERN = /^\/learn\/[^/]+\/?$/;
const ATTEMPT_REVIEW_PATH_PATTERNS = [
  /^\/progress\/practice-sessions\/[^/]+\/?$/,
  /^\/progress\/(?:sections\/\d+\/)?set-attempts\/[^/]+\/?$/,
  /^\/progress\/mock-attempts\/[^/]+\/?$/,
  /^\/progress\/mock-attempts\/[^/]+\/sets\/[^/]+\/?$/,
];
export function getTourForPathname(pathname: string): string | null {
  if (SECTION_SETS_PATH_PATTERN.test(pathname)) return UCAT_SECTION_SETS_TOUR;
  if (SECTION_PROGRESS_PATH_PATTERN.test(pathname))
    return UCAT_SECTION_PROGRESS_TOUR;
  if (LEARNING_MODULE_PATH_PATTERN.test(pathname))
    return UCAT_LEARNING_MODULE_TOUR;
  if (ATTEMPT_REVIEW_PATH_PATTERNS.some((pattern) => pattern.test(pathname)))
    return UCAT_ATTEMPT_REVIEW_TOUR;
  return PATHNAME_TO_TOUR[pathname] ?? null;
}

export function getFirstSelectorForTour(tourId: string): string | null {
  return (
    ucatOnboardingTours.find((tour) => tour.tour === tourId)?.steps[0]
      ?.selector ?? null
  );
}
