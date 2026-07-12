export function buildQuestionEngineTutorialHref(returnTo: string): string {
  const safeReturnTo =
    returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/dashboard";
  return `/exam/tutorial?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function isQuestionEnginePath(pathname: string): boolean {
  return (
    pathname === "/exam/sets" ||
    pathname === "/exam/mocks" ||
    pathname === "/practice/session" ||
    pathname.startsWith("/practice/stem/") ||
    /^\/sessions\/[^/]+\/(sets|mocks)\/[^/]+$/.test(pathname)
  );
}
