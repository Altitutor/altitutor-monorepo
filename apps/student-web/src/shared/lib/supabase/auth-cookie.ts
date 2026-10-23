export function getAuthCookieName(): string {
  return process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME || "student-auth";
}

export function isAuthCookie(name: string): boolean {
  const base = getAuthCookieName();
  return name === base ||
    (name.startsWith(`${base}.`) && /^\d+$/.test(name.slice(base.length + 1)));
}
