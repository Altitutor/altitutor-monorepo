import { getAuthCookieName, isAuthCookie } from "../auth-cookie";

const previous = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME;
afterEach(() => {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME;
  else process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME = previous;
});

it.each([undefined, "isolated.project-student-auth"])(
  "matches only this app's base and numbered cookie chunks (%s)",
  (override) => {
    if (override === undefined) delete process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME;
    else process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME = override;
    const expected = override || "student-auth";
    expect(getAuthCookieName()).toBe(expected);
    expect(isAuthCookie(expected)).toBe(true);
    expect(isAuthCookie(`${expected}.0`)).toBe(true);
    expect(isAuthCookie(`${expected}.12`)).toBe(true);
    expect(isAuthCookie(`${expected}.other`)).toBe(false);
    expect(isAuthCookie(`${expected}-other`)).toBe(false);
    expect(isAuthCookie("another-app-auth.0")).toBe(false);
    if (override) expect(isAuthCookie("student-auth.0")).toBe(false);
  },
);
