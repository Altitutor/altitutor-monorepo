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
