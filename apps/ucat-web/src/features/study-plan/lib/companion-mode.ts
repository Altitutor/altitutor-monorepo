export type StudyPlanCompanionMode = "available" | "hidden" | "activity";

const LEARN_CATALOG_SEGMENTS = new Set(["sections"]);

function isLearningModuleRoute(pathname: string): boolean {
  const sectionModule = pathname.match(
    /^\/learn\/sections\/([1-4])\/([^/]+)$/,
  );
  if (sectionModule) return true;

  const legacyModule = pathname.match(/^\/learn\/([^/]+)$/);
  if (!legacyModule) return false;
  return !LEARN_CATALOG_SEGMENTS.has(legacyModule[1] ?? "");
}

/**
 * The companion helps students choose what to do, then yields once they have
 * chosen an activity. Activity routes may reveal it again on completion.
 *
 * - `hidden`: fullscreen engines (exam / practice session) — no orb at all
 * - `activity`: in-progress work — silent until complete (then celebrate / suggest)
 * - `available`: browsing / dashboard / attempt review — free to suggest the next step
 *
 * Attempt review stays available so the orb can guide in-page review of
 * incorrect answers without disappearing while the student is on results.
 */
export function getStudyPlanCompanionMode(
  pathname: string,
): StudyPlanCompanionMode {
  if (/^\/skill-trainer\/[^/]+\/play$/.test(pathname)) {
    return "activity";
  }

  if (isLearningModuleRoute(pathname)) {
    return "activity";
  }

  if (pathname.startsWith("/exam")) {
    return "hidden";
  }

  // Attempt review and other browse routes keep the orb available.
  return "available";
}

/** True when the student is already on the suggested next activity. */
export function isAlreadyOnSuggestedActivity(
  pathname: string,
  launchPath: string,
): boolean {
  const suggestionPath = (launchPath.split("?")[0] ?? "").replace(/\/$/, "");
  if (!suggestionPath || suggestionPath === "/") return false;

  if (
    pathname === suggestionPath ||
    pathname.startsWith(`${suggestionPath}/`)
  ) {
    return true;
  }

  const suggestionSegments = suggestionPath.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  const suggestionLeaf = suggestionSegments.at(-1);
  if (!suggestionLeaf || suggestionLeaf.length < 8) return false;
  if (pathSegments.at(-1) !== suggestionLeaf) return false;

  const isReviewRoute = (segments: string[]) =>
    segments.includes("set-attempts") ||
    segments.includes("mock-attempts") ||
    segments.includes("practice-sessions");

  return isReviewRoute(suggestionSegments) && isReviewRoute(pathSegments);
}
