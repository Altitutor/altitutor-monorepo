import {
  isAuthSessionMissingError,
  type SupabaseClient,
} from "@supabase/supabase-js";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function createApiClient(
  auth: Pick<SupabaseClient["auth"], "getSession" | "getUser">,
  webUrl: (path: string) => string,
  request: typeof fetch = fetch,
) {
  return async function api<T>(
    path: string,
    options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
  ): Promise<T> {
    const { data, error } = await auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Please sign in to continue.");
    const response = await request(webUrl(`/api/ucat${path}`), {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal ?? AbortSignal.timeout(30000),
      credentials: "omit",
    });
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      if (response.status === 401 || body.error === "Failed to get user") {
        // Some UCAT routes report rejected sessions as a generic 500. Verify
        // against Auth before treating the failure as a sign-out. getUser()
        // clears revoked sessions and emits SIGNED_OUT, but retains sessions
        // on temporary server/network errors. Never replay a failed mutation.
        const verification = await auth.getUser();
        if (isAuthSessionMissingError(verification.error)) {
          throw new ApiError(
            "Your session has ended. Please sign in again.",
            401,
            body,
          );
        }
      }
      const message =
        body.code === "QUOTA_EXCEEDED"
          ? "You have reached your plan’s allowance for this activity."
          : typeof body.error === "string"
            ? body.error
            : "Unable to connect. Please try again.";
      throw new ApiError(message, response.status, body);
    }
    return body as T;
  };
}
