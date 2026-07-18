export type StudyPlanCompanionMode = "available" | "hidden" | "activity";

/**
 * The companion helps students choose what to do, then yields once they have
 * chosen an activity. Activity routes may reveal it again on their results UI.
 */
export function getStudyPlanCompanionMode(
  pathname: string,
): StudyPlanCompanionMode {
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/study-plan")) {
    return "hidden";
  }

  if (/^\/skill-trainer\/[^/]+\/play$/.test(pathname)) {
    return "activity";
  }

  if (
    pathname.startsWith("/exam") ||
    pathname === "/practice" ||
    pathname === "/practice/session" ||
    pathname.startsWith("/practice/stem/") ||
    /^\/skill-trainer\/[^/]+$/.test(pathname) ||
    /^\/mocks\/[^/]+$/.test(pathname) ||
    /^\/sets\/(?!sections(?:\/|$))[^/]+$/.test(pathname) ||
    /^\/sets\/sections\/[1-4]\/[^/]+$/.test(pathname) ||
    /^\/sessions\/[^/]+\/(?:sets|mocks)\/[^/]+$/.test(pathname)
  ) {
    return "hidden";
  }

  return "available";
}
