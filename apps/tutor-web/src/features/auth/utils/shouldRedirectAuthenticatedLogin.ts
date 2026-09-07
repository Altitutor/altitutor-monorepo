export function shouldRedirectAuthenticatedLogin(
  pathname: string,
  accessDenied: boolean,
): boolean {
  return pathname === "/login" && !accessDenied;
}
