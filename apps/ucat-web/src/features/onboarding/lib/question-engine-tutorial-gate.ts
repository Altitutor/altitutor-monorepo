export function buildQuestionEngineTutorialHref(returnTo: string): string {
  const safeReturnTo =
    returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/dashboard";
  return `/exam/tutorial?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function isQuestionEnginePath(pathname: string): boolean {
  return (
    pathname === "/exam" ||
    /^\/sessions\/[^/]+\/(sets|mocks)\/[^/]+$/.test(pathname)
  );
}
