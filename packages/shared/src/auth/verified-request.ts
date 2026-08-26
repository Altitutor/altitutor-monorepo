/**
 * Private request metadata written by portal middleware after Supabase has
 * verified the session. Middleware must always overwrite or remove this
 * header so a value supplied by a browser can never become authoritative.
 */
export const VERIFIED_USER_ID_HEADER =
  "x-altitutor-verified-user-id" as const;

export function headersWithVerifiedUser(
  source: Headers,
  userId: string | null,
): Headers {
  const headers = new Headers(source);
  headers.delete(VERIFIED_USER_ID_HEADER);
  if (userId) headers.set(VERIFIED_USER_ID_HEADER, userId);
  return headers;
}
