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
