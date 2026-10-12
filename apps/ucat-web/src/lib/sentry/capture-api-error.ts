import * as Sentry from "@sentry/nextjs";

export function captureApiError(
  error: unknown,
  route: string,
  extra?: Record<string, unknown>,
) {
  if (error == null) return;
  if (
    typeof error === "object" &&
    "digest" in error &&
    error.digest === "DYNAMIC_SERVER_USAGE"
  ) {
    return;
  }

  const client = Sentry.getClient();
  // This route first reads its task through instrumented supabaseAdmin, so the
  // SDK reports this exact RPC failure before the route receives the response.
  // Keep the automatic report; avoid a second generic group for the same failure.
  if (
    route === "/api/ucat/study-plan/tasks/[taskId]" &&
    process.env.NEXT_PUBLIC_SENTRY_DSN &&
    client && client.getOptions().enabled !== false &&
    typeof error === "object" &&
    "code" in error && error.code === "42501" &&
    "message" in error && error.message ===
      "permission denied for function ucat_study_plan_task_has_active_work"
  ) return;

  Sentry.captureException(error, {
    extra,
    tags: {
      "api.handled": "true",
      "api.route": route,
    },
  });
}

export function captureApiErrorResponse<Response>(
  error: unknown,
  route: string,
  response: Response,
  extra?: Record<string, unknown>,
) {
  captureApiError(error, route, extra);
  return response;
}
