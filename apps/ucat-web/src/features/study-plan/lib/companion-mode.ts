export type StudyPlanCompanionMode = "available" | "hidden" | "activity";

/**
 * The companion helps students choose what to do, then yields once they have
 * chosen an activity. Activity routes may reveal it again on their results UI.
 */
export function getStudyPlanCompanionMode(
  pathname: string,
): StudyPlanCompanionMode {
  if (/^\/skill-trainer\/[^/]+\/play$/.test(pathname)) {
    return "activity";
  }

  if (
    pathname.startsWith("/exam") ||
    pathname === "/practice/session" ||
    pathname.startsWith("/practice/stem/")
  ) {
    return "hidden";
  }

  return "available";
}
