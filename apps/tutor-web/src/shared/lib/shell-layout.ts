const HIDE_NAVBAR_EXACT_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
]);

export function isInterviewFullscreenPath(pathname: string): boolean {
  return (
    /^\/interviews\/[^/]+\/print\/?$/.test(pathname) ||
    /^\/interviews\/rounds\/[^/]+\/(waiting|live)\/?$/.test(pathname)
  );
}

export function shouldHideNavbar(pathname: string): boolean {
  return (
    HIDE_NAVBAR_EXACT_PATHS.has(pathname) ||
    isInterviewFullscreenPath(pathname) ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/form/")
  );
}
