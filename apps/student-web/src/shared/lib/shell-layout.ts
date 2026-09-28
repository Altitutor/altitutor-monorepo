const HIDE_NAVBAR_EXACT_PATHS = new Set([
  '/booking/trial-session',
  '/booking/subsidy',
  '/booking-success',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/mobile-auth',
  '/mobile-browser',
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
