import type { Tour } from "nextstepjs";

/**
 * Fixed full-viewport mount for nextstepjs when highlighting `position: fixed`
 * sidebar items. Without this, the default body portal scrolls with the page
 * while the sidebar stays pinned, so the spotlight drifts.
 *
 * @see https://nextstepjs.com/docs/nextjs/tour-steps — `viewportID`
 */
export const UCAT_NEXTSTEP_FIXED_VIEWPORT_ID = "ucat-nextstep-fixed-viewport";

/** Tour identifiers — keep stable; bump versions in `storage.ts` to re-show. */
export const UCAT_ONBOARDING_TOUR = "ucat-welcome";
export const UCAT_PRACTICE_TOUR = "ucat-practice-intro";
export const UCAT_PROGRESS_TOUR = "ucat-progress-intro";

const welcomeTour: Tour = {
  tour: UCAT_ONBOARDING_TOUR,
  steps: [
    {
      icon: <>👋</>,
      title: "Welcome to UCAT prep",
      content: (
        <p>
          Let&apos;s take a quick tour so you know where everything lives. You
          can replay it any time from Settings.
        </p>
      ),
      selector: "#ucat-onboarding-welcome",
      viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
      // Logo is flush to the top of the sidebar: plain `right` vertically
      // centres the card and clips above the viewport. Do **not** use
      // `right-top` / `right-bottom` here — nextstepjs `checkSideCutOff` treats
      // any side string containing "top" or "bottom" as a vertical hint and
      // can replace `right-top` with `right-bottom` when y < 256px, which
      // inverts arrow placement (arrow ends up on the wrong edge of the
      // card). `bottom` places the card *below* the logo with the arrow on the
      // top edge of the card pointing up — stable and matches the docs.
      side: "bottom",
      showControls: true,
      showSkip: true,
      pointerPadding: 8,
      pointerRadius: 14,
    },
    {
      icon: <>🏠</>,
      title: "Dashboard",
      content: (
        <p>
          Your home base — quick stats, your next session, and shortcuts to
          every tool.
        </p>
      ),
      selector: "[data-tour='nav-dashboard']",
      viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
      side: "right",
      showControls: true,
      showSkip: true,
      pointerPadding: 4,
      pointerRadius: 10,
    },
    {
      icon: <>📈</>,
      title: "Progress",
      content: (
        <p>
          Section-by-section accuracy, every question attempt, and every mock —
          all in one place.
        </p>
      ),
      selector: "[data-tour='nav-progress']",
      viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
      side: "right",
      showControls: true,
      showSkip: true,
      pointerPadding: 4,
      pointerRadius: 10,
    },
    {
      icon: <>📚</>,
      title: "Learn",
      content: (
        <p>
          Study notes and worked examples covering the theory behind each UCAT
          section.
        </p>
      ),
      selector: "[data-tour='nav-learn']",
      viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
      side: "right",
      showControls: true,
      showSkip: true,
      pointerPadding: 4,
      pointerRadius: 10,
    },
    {
      icon: <>🧠</>,
      title: "Practice",
      content: (
        <p>
          Drill individual questions — timed or untimed — and build the stamina
          UCAT day demands.
        </p>
      ),
      selector: "[data-tour='nav-practice']",
      viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
      side: "right",
      showControls: true,
      showSkip: true,
      pointerPadding: 4,
      pointerRadius: 10,
    },
    {
      icon: <>🗂️</>,
      title: "Sets",
      content: (
        <p>
          Curated question sets by section, plus a generator if you want a
          custom mix.
        </p>
      ),
      selector: "[data-tour='nav-sets']",
      viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
      side: "right",
      showControls: true,
      showSkip: true,
      pointerPadding: 4,
      pointerRadius: 10,
    },
    {
      icon: <>📝</>,
      title: "Mocks",
      content: (
        <p>
          Full-length, exam-style mocks. Recommended once you&apos;re
          comfortable in Practice.
        </p>
      ),
      selector: "[data-tour='nav-mocks']",
      viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
      // Near the bottom of the viewport: `right-bottom` is flipped to
      // `right-top` by nextstepjs when the target sits low, which misplaces the
      // arrow. `top` keeps the card above the row with the arrow on the bottom
      // edge of the card pointing down.
      side: "top",
      showControls: true,
      showSkip: true,
      pointerPadding: 4,
      pointerRadius: 10,
    },
    {
      icon: <>⚙️</>,
      title: "Settings",
      content: (
        <p>
          Manage your timezone and preferences. You can replay any tour from
          here at any time.
        </p>
      ),
      selector: "[data-tour='nav-settings']",
      viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
      side: "top",
      showControls: true,
      showSkip: false,
      pointerPadding: 4,
      pointerRadius: 10,
    },
  ],
};

const practiceTour: Tour = {
  tour: UCAT_PRACTICE_TOUR,
  steps: [
    {
      icon: <>🧠</>,
      title: "Practice your way",
      content: (
        <p>
          Practice lets you drill questions stem-by-stem with instant feedback.
          A quick tour of the controls 👇
        </p>
      ),
      selector: "#tour-practice-header",
      side: "bottom",
      showControls: true,
      showSkip: true,
      pointerPadding: 8,
      pointerRadius: 12,
    },
    {
      icon: <>🎯</>,
      title: "Pick your filters",
      content: (
        <p>
          Choose a UCAT section, narrow by topic, and set your time controls.
          You can also filter by past performance to retry weak spots.
        </p>
      ),
      selector: "#tour-practice-filters",
      side: "top",
      showControls: true,
      showSkip: true,
      pointerPadding: 8,
      pointerRadius: 12,
    },
    {
      icon: <>🚀</>,
      title: "Hit start",
      content: (
        <p>
          When the preview looks right, start a session. Your attempts are
          saved automatically and show up in Progress.
        </p>
      ),
      selector: "[data-tour='practice-start']",
      side: "top",
      showControls: true,
      showSkip: false,
      pointerPadding: 8,
      pointerRadius: 12,
    },
  ],
};

const progressTour: Tour = {
  tour: UCAT_PROGRESS_TOUR,
  steps: [
    {
      icon: <>📊</>,
      title: "Your Progress hub",
      content: (
        <p>
          Everything you&apos;ve attempted is summarised here — by section, by
          attempt, and over time.
        </p>
      ),
      selector: "#tour-progress-header",
      side: "bottom",
      showControls: true,
      showSkip: true,
      pointerPadding: 8,
      pointerRadius: 12,
    },
    {
      icon: <>🔭</>,
      title: "Switch the lens",
      content: (
        <p>
          Use the mode selector to filter by time frame or by attempt type
          (practice / set / mock). The cards below react to your choice.
        </p>
      ),
      selector: "#tour-progress-mode",
      /**
       * The mode toolbar is `position: fixed` at the bottom of the viewport.
       * Without `viewportID`, the overlay portals into the document body —
       * its origin then shifts with page scroll, so the spotlight drifts away
       * from the fixed toolbar. Anchoring to the fixed overlay container keeps
       * the spotlight pinned to the toolbar exactly (same trick we use for the
       * sidebar steps).
       */
      viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
      /** Toolbar is fixed at the bottom — place the card above it (not below the fold). */
      side: "top",
      showControls: true,
      showSkip: false,
      pointerPadding: 8,
      pointerRadius: 12,
    },
  ],
};

/** Flat list passed to `<NextStep>`. */
export const ucatOnboardingTours: Tour[] = [
  welcomeTour,
  practiceTour,
  progressTour,
];

/** All known tour IDs (for bulk reset / iteration). */
export const ALL_UCAT_TOUR_IDS = [
  UCAT_ONBOARDING_TOUR,
  UCAT_PRACTICE_TOUR,
  UCAT_PROGRESS_TOUR,
] as const;

/**
 * Pathname → tour mapping for auto-start on first visit.
 * Add an entry here when introducing a new feature tour.
 */
const PATHNAME_TO_TOUR: Record<string, string> = {
  "/dashboard": UCAT_ONBOARDING_TOUR,
  "/practice": UCAT_PRACTICE_TOUR,
  "/progress": UCAT_PROGRESS_TOUR,
};

export function getTourForPathname(pathname: string): string | null {
  return PATHNAME_TO_TOUR[pathname] ?? null;
}
