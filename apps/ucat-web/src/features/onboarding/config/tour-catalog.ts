export const UCAT_DASHBOARD_TOUR = "ucat-dashboard-intro";
export const UCAT_STUDY_PLAN_TOUR = "ucat-study-plan-intro";
export const UCAT_PROGRESS_TOUR = "ucat-progress-intro";
export const UCAT_LEARN_TOUR = "ucat-learn-intro";
export const UCAT_SKILL_TRAINER_TOUR = "ucat-skill-trainer-intro";
export const UCAT_PRACTICE_TOUR = "ucat-practice-intro";
export const UCAT_SETS_TOUR = "ucat-sets-intro";
export const UCAT_MOCKS_TOUR = "ucat-mocks-intro";
export const UCAT_QUESTION_ENGINE_TOUR = "ucat-question-engine-intro";
export const UCAT_QUESTION_ENGINE_CONTROLS_TOUR =
  "ucat-question-engine-controls-intro";
export const UCAT_SECTION_PROGRESS_TOUR = "ucat-section-progress-intro";
export const UCAT_ATTEMPT_REVIEW_TOUR = "ucat-attempt-review-intro";

export interface AutoStartTourEntry {
  tourId: string;
  startStep: number;
}

const STATIC_AUTO_START_TOURS: Readonly<Record<string, AutoStartTourEntry>> = {
  "/dashboard": { tourId: UCAT_DASHBOARD_TOUR, startStep: 0 },
  "/study-plan": { tourId: UCAT_STUDY_PLAN_TOUR, startStep: 0 },
  "/progress": { tourId: UCAT_PROGRESS_TOUR, startStep: 0 },
  "/learn": { tourId: UCAT_LEARN_TOUR, startStep: 0 },
  "/skill-trainer": { tourId: UCAT_SKILL_TRAINER_TOUR, startStep: 0 },
  "/practice": { tourId: UCAT_PRACTICE_TOUR, startStep: 0 },
  "/sets": { tourId: UCAT_SETS_TOUR, startStep: 0 },
  "/mocks": { tourId: UCAT_MOCKS_TOUR, startStep: 0 },
  "/exam/tutorial": { tourId: UCAT_QUESTION_ENGINE_TOUR, startStep: 0 },
  "/exam/controls-tutorial": {
    tourId: UCAT_QUESTION_ENGINE_CONTROLS_TOUR,
    startStep: 0,
  },
};

const SECTION_PROGRESS_PATH_PATTERN = /^\/progress\/sections\/[1-4]\/?$/;
const LEARN_AREA_PATH_PATTERNS = [
  /^\/learn\/general\/?$/,
  /^\/learn\/sections\/[1-4]\/?$/,
];
const SKILL_TRAINER_DETAIL_PATH_PATTERN = /^\/skill-trainer\/[^/]+\/?$/;
const SET_SECTION_PATH_PATTERN = /^\/sets\/sections\/[1-4]\/?$/;
const SET_DETAIL_PATH_PATTERNS = [
  /^\/sets\/sections\/[1-4]\/[^/]+\/?$/,
  /^\/sets\/[^/]+\/?$/,
];
const MOCK_DETAIL_PATH_PATTERN = /^\/mocks\/[^/]+\/?$/;
const ATTEMPT_REVIEW_PATH_PATTERNS = [
  /^\/progress\/practice-sessions\/[^/]+\/?$/,
  /^\/progress\/(?:sections\/\d+\/)?set-attempts\/[^/]+\/?$/,
  /^\/progress\/mock-attempts\/[^/]+\/?$/,
  /^\/progress\/mock-attempts\/[^/]+\/sets\/[^/]+\/?$/,
  /^\/progress\/mocks\/mock-attempts\/[^/]+\/?$/,
  /^\/progress\/mocks\/mock-attempts\/[^/]+\/set-attempts\/[^/]+\/?$/,
];

/** Resolve the contextual tutorial and route-specific entry step. */
export function getAutoStartTourEntryForPathname(
  pathname: string,
): AutoStartTourEntry | null {
  if (SECTION_PROGRESS_PATH_PATTERN.test(pathname)) {
    return { tourId: UCAT_PROGRESS_TOUR, startStep: 4 };
  }
  if (LEARN_AREA_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { tourId: UCAT_LEARN_TOUR, startStep: 2 };
  }
  if (SKILL_TRAINER_DETAIL_PATH_PATTERN.test(pathname)) {
    return { tourId: UCAT_SKILL_TRAINER_TOUR, startStep: 2 };
  }
  if (ATTEMPT_REVIEW_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { tourId: UCAT_ATTEMPT_REVIEW_TOUR, startStep: 0 };
  }
  if (SET_SECTION_PATH_PATTERN.test(pathname)) {
    return { tourId: UCAT_SETS_TOUR, startStep: 2 };
  }
  if (SET_DETAIL_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return { tourId: UCAT_SETS_TOUR, startStep: 3 };
  }
  if (MOCK_DETAIL_PATH_PATTERN.test(pathname)) {
    return { tourId: UCAT_MOCKS_TOUR, startStep: 2 };
  }
  return STATIC_AUTO_START_TOURS[pathname.replace(/\/$/, "")] ?? null;
}

/** Backwards-compatible tour-only resolver for callers that do not need a step. */
export function getAutoStartTourForPathname(pathname: string): string | null {
  return getAutoStartTourEntryForPathname(pathname)?.tourId ?? null;
}
