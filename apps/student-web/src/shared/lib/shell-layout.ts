const HIDE_NAVBAR_EXACT_PATHS = new Set([
  '/booking/trial-session',
  '/booking-success',
  '/login',
]);

export function shouldHideNavbar(pathname: string): boolean {
  return (
    HIDE_NAVBAR_EXACT_PATHS.has(pathname) ||
    pathname.startsWith('/register/')
  );
}
