const HIDE_NAVBAR_EXACT_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
]);

export function shouldHideNavbar(pathname: string): boolean {
  return (
    HIDE_NAVBAR_EXACT_PATHS.has(pathname) ||
    pathname.startsWith('/invite/')
  );
}
