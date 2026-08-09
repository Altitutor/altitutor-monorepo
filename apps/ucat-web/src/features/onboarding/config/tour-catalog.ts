export const UCAT_DASHBOARD_TOUR = "ucat-dashboard-intro";
export const UCAT_STUDY_PLAN_TOUR = "ucat-study-plan-intro";
export const UCAT_PROGRESS_TOUR = "ucat-progress-intro";
export const UCAT_LEARN_TOUR = "ucat-learn-intro";
export const UCAT_SKILL_TRAINER_TOUR = "ucat-skill-trainer-intro";
export const UCAT_PRACTICE_TOUR = "ucat-practice-intro";
export const UCAT_SETS_TOUR = "ucat-sets-intro";
export const UCAT_MOCKS_TOUR = "ucat-mocks-intro";
export const UCAT_QUESTION_ENGINE_TOUR = "ucat-question-engine-intro";
export const UCAT_SECTION_PROGRESS_TOUR = "ucat-section-progress-intro";
export const UCAT_ATTEMPT_REVIEW_TOUR = "ucat-attempt-review-intro";

const STATIC_AUTO_START_TOURS: Readonly<Record<string, string>> = {
  "/dashboard": UCAT_DASHBOARD_TOUR,
  "/study-plan": UCAT_STUDY_PLAN_TOUR,
  "/progress": UCAT_PROGRESS_TOUR,
  "/learn": UCAT_LEARN_TOUR,
  "/skill-trainer": UCAT_SKILL_TRAINER_TOUR,
  "/practice": UCAT_PRACTICE_TOUR,
  "/sets": UCAT_SETS_TOUR,
  "/mocks": UCAT_MOCKS_TOUR,
  "/exam/tutorial": UCAT_QUESTION_ENGINE_TOUR,
};

const SECTION_PROGRESS_PATH_PATTERN = /^\/progress\/sections\/[1-4]\/?$/;
const ATTEMPT_REVIEW_PATH_PATTERNS = [
  /^\/progress\/practice-sessions\/[^/]+\/?$/,
  /^\/progress\/(?:sections\/\d+\/)?set-attempts\/[^/]+\/?$/,
  /^\/progress\/mock-attempts\/[^/]+\/?$/,
  /^\/progress\/mock-attempts\/[^/]+\/sets\/[^/]+\/?$/,
  /^\/progress\/mocks\/mock-attempts\/[^/]+\/?$/,
  /^\/progress\/mocks\/mock-attempts\/[^/]+\/set-attempts\/[^/]+\/?$/,
];

/** Resolve the one contextual tutorial eligible to auto-start on a pathname. */
export function getAutoStartTourForPathname(pathname: string): string | null {
  if (SECTION_PROGRESS_PATH_PATTERN.test(pathname)) {
    return UCAT_SECTION_PROGRESS_TOUR;
  }
  if (ATTEMPT_REVIEW_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return UCAT_ATTEMPT_REVIEW_TOUR;
  }
  return STATIC_AUTO_START_TOURS[pathname.replace(/\/$/, "")] ?? null;
}
