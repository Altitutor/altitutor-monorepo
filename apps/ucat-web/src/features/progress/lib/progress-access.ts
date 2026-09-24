import type { SectionProgress } from "@altitutor/shared";

const PROGRESS_PATH_PATTERN = /^\/progress(?:\/|$)/;
const PROGRESS_PREVIEW_PATH_PATTERNS = [
  /^\/progress\/preview(?:\/|$)/,
  /^\/progress\/attempts\/preview(?:\/|$)/,
] as const;

/** Whether a real student progress route should require completed-question evidence. */
export function requiresCompletedQuestion(pathname: string): boolean {
  return (
    PROGRESS_PATH_PATTERN.test(pathname) &&
    !PROGRESS_PREVIEW_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  );
}

/** `maxScore` is positive for an attempted question, even when it was answered incorrectly. */
export function hasCompletedQuestion(sections: SectionProgress[]): boolean {
  return sections.some((section) => section.maxScore > 0);
}
