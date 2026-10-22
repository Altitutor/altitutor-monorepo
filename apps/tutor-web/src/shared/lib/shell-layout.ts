const HIDE_NAVBAR_EXACT_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
]);

/** DEV-8 throwaway live workspace; retains the protected tutor route boundary. */
export function isInterviewPrototypeFullscreenPath(pathname: string): boolean {
  return process.env.NODE_ENV !== 'production' && pathname === '/interviews/prototype';
}

export function shouldHideNavbar(pathname: string): boolean {
  return (
    HIDE_NAVBAR_EXACT_PATHS.has(pathname) ||
    isInterviewPrototypeFullscreenPath(pathname) ||
    pathname.startsWith('/invite/') ||
    pathname.startsWith('/form/')
  );
}
