/** Only the installed student app can be a production callback destination. */
export function nativeReturnUrl(value: string | null, development = false): string | null {
  if (!value || value.length > 512) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    if (
      url.protocol === "altitutor-student:" &&
      url.hostname === "auth-return" &&
      (url.pathname === "" || url.pathname === "/")
    )
      return url.toString();
    // Expo Go callbacks are accepted only by the local development server.
    if (
      development &&
      url.protocol === "exp:" &&
      url.pathname === "/--/auth-return" &&
      /^(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(
        url.hostname,
      )
    )
      return url.toString();
    return null;
  } catch {
    return null;
  }
}

export const validNativeNonce = (value: string | null): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
