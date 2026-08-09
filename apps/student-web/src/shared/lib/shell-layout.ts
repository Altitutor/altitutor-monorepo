const HIDE_NAVBAR_EXACT_PATHS = new Set([
  '/booking/trial-session',
  '/booking-success',
  '/login',
  '/forgot-password',
  '/reset-password',
]);

export function shouldHideNavbar(pathname: string): boolean {
  return (
    HIDE_NAVBAR_EXACT_PATHS.has(pathname) ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/b/') ||
    pathname.startsWith('/register/') ||
    pathname.startsWith('/form/')
  );
}
