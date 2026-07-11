import type { Tour } from "nextstepjs";
import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  NotebookText,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";

export const UCAT_NEXTSTEP_FIXED_VIEWPORT_ID = "ucat-nextstep-fixed-viewport";

export const UCAT_ONBOARDING_TOUR = "ucat-welcome";
export const UCAT_PROGRESS_TOUR = "ucat-progress-intro";
export const UCAT_LEARN_TOUR = "ucat-learn-intro";
export const UCAT_SESSIONS_TOUR = "ucat-sessions-intro";
export const UCAT_SKILL_TRAINER_TOUR = "ucat-skill-trainer-intro";
export const UCAT_PRACTICE_TOUR = "ucat-practice-intro";
export const UCAT_SECTION_SETS_TOUR = "ucat-section-sets-intro";
export const UCAT_MOCKS_TOUR = "ucat-mocks-intro";

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
      icon: <TrendingUp className={iconClassName} />,
      title: "Review completed work",
      content: (
        <p>
          Progress shows your results across practice questions, sets, and
          mocks. Return here to decide what needs more work.
        </p>
      ),
      selector: "[data-tour='nav-progress']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
    },
    {
      icon: <BookOpen className={iconClassName} />,
      title: "Learn before you practise",
      content: (
        <p>
          Learn contains the course material. Sessions, directly below it,
          holds resources linked to your classes.
        </p>
      ),
      selector: "[data-tour='nav-learn']",
      ...fixedViewport,
      side: "right",
      ...standardStep,
    },
    {
      icon: <BrainCircuit className={iconClassName} />,
      title: "Choose how to practise",
      content: (
        <p>
          Skill trainer focuses on one skill at a time. Practice questions lets
          you build a filtered question session with your own timing.
        </p>
      ),
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
      side: "top",
      ...standardStep,
    },
    {
      icon: <Settings className={iconClassName} />,
      title: "Replay a guide",
      content: (
        <p>
          Settings includes App tours. Use it if you want to see this guide or
          a page guide again.
        </p>
      ),
      selector: "[data-tour='nav-settings']",
      ...fixedViewport,
      side: "top",
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
      title: "Change the view",
      content: (
        <p>
          Use these controls to change the time period or attempt type. The
          results on the page update to match your selection.
        </p>
      ),
      selector: "#tour-progress-mode",
      ...fixedViewport,
      side: "top",
      ...standardStep,
      showSkip: false,
    },
  ],
};

const learnTour: Tour = {
  tour: UCAT_LEARN_TOUR,
  steps: [
    {
      icon: <BookOpen className={iconClassName} />,
      title: "Choose a learning module",
      content: (
        <p>
          Modules are grouped by UCAT section. Open a topic to work through its
          lessons and examples, then return here to continue.
        </p>
      ),
      selector: "#tour-learn-page",
      side: "bottom",
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
      title: "Practise one skill at a time",
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
          Choose the section, topics, number of questions, and timing that fit
          what you want to practise today.
        </p>
      ),
      selector: "#tour-practice-filters",
      side: "top",
      ...standardStep,
    },
    {
      icon: <BrainCircuit className={iconClassName} />,
      title: "Start when the setup is ready",
      content: (
        <p>
          Start practice opens the session using your selected filters. Each
          attempt is saved to Progress automatically.
        </p>
      ),
      selector: "[data-tour='practice-start']",
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
          This list contains sets for the section you selected. Search or
          filter the list, then open a set to review its timing before starting.
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

export const ucatOnboardingTours: Tour[] = [
  welcomeTour,
  progressTour,
  learnTour,
  sessionsTour,
  skillTrainerTour,
  practiceTour,
  sectionSetsTour,
  mocksTour,
];

export const ALL_UCAT_TOUR_IDS = [
  UCAT_ONBOARDING_TOUR,
  UCAT_PROGRESS_TOUR,
  UCAT_LEARN_TOUR,
  UCAT_SESSIONS_TOUR,
  UCAT_SKILL_TRAINER_TOUR,
  UCAT_PRACTICE_TOUR,
  UCAT_SECTION_SETS_TOUR,
  UCAT_MOCKS_TOUR,
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
] as const;

const PATHNAME_TO_TOUR: Record<string, string> = {
  "/dashboard": UCAT_ONBOARDING_TOUR,
  "/progress": UCAT_PROGRESS_TOUR,
  "/learn": UCAT_LEARN_TOUR,
  "/sessions": UCAT_SESSIONS_TOUR,
  "/skill-trainer": UCAT_SKILL_TRAINER_TOUR,
  "/practice": UCAT_PRACTICE_TOUR,
  "/mocks": UCAT_MOCKS_TOUR,
};

const SECTION_SETS_PATH_PATTERN = /^\/sets\/sections\/[1-4]\/?$/;

export function getTourForPathname(pathname: string): string | null {
  if (SECTION_SETS_PATH_PATTERN.test(pathname)) return UCAT_SECTION_SETS_TOUR;
  return PATHNAME_TO_TOUR[pathname] ?? null;
}

export function getFirstSelectorForTour(tourId: string): string | null {
  return (
    ucatOnboardingTours.find((tour) => tour.tour === tourId)?.steps[0]
      ?.selector ?? null
  );
}
