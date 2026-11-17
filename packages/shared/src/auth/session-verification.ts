const ENDED_SESSION_CODES = new Set([
  "refresh_token_already_used",
  "refresh_token_not_found",
  "session_expired",
  "session_not_found",
]);

function field(error: unknown, key: string) {
  if (typeof error !== "object" || error === null) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/** Auth outcomes that mean the browser no longer has a usable session. */
export function isUnauthenticatedSessionError(error: unknown) {
  if (!error) return false;
  if (field(error, "name") === "AuthSessionMissingError") return true;

  const code = field(error, "code");
  if (code && ENDED_SESSION_CODES.has(code)) return true;

  const message = field(error, "message")?.toLowerCase();
  return (
    message?.includes("refresh token") === true &&
    ["already used", "expired", "invalid", "missing", "not found"].some(
      (reason) => message.includes(reason),
    )
  );
}

/** Exact, retryable clock-skew failure returned while verifying a JWT. */
export function isJwtIssuedInFutureError(error: unknown) {
  return field(error, "message")?.includes("JWT issued at future") === true;
}

type ClaimsResult = { error: unknown | null };

/**
 * Retries JWT verification once after a bounded wait when Supabase reports
 * that the JWT was issued in the future. Validation is always performed by
 * Supabase again; this never accepts or decodes the token locally.
 */
export async function getClaimsWithJwtIssuedInFutureRetry<
  TResult extends ClaimsResult,
>(
  operation: () => Promise<TResult>,
  waitBeforeRetry: () => Promise<unknown>,
  onRecovered: (initialError: unknown) => void,
) {
  let first: TResult;
  try {
    first = await operation();
  } catch (error) {
    if (!isJwtIssuedInFutureError(error)) throw error;
    await waitBeforeRetry();
    const retry = await operation();
    if (!retry.error) onRecovered(error);
    return retry;
  }

  if (!isJwtIssuedInFutureError(first.error)) return first;
  await waitBeforeRetry();
  const retry = await operation();
  if (!retry.error) onRecovered(first.error);
  return retry;
}

/** A verified getUser rejection, rather than a failure to reach Auth. */
export function isUnauthenticatedUserError(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error
    ? error.status : null;
  if (
    (typeof status === "number" && (status === 429 || status >= 500)) ||
    ["AuthRetryableFetchError", "AuthUnknownError", "AbortError", "TimeoutError"].includes(field(error, "name") ?? "") ||
    isJwtIssuedInFutureError(error)
  ) return false;
  if (isUnauthenticatedSessionError(error)) return true;
  return ["bad_jwt", "invalid_jwt", "user_not_found"].includes(
    field(error, "code") ?? "",
  );
}

/** Normalise returned and thrown Auth verification failures at one boundary. */
export async function getUserVerification<TUser>(
  operation: () => Promise<{ data: { user: TUser | null }; error: unknown }>,
): Promise<{ user: TUser | null; error: unknown }> {
  try {
    const { data, error } = await operation();
    return { user: data.user, error };
  } catch (error) {
    return { user: null, error };
  }
}
