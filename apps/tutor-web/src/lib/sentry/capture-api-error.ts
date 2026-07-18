import * as Sentry from "@sentry/nextjs";

export function captureApiError(error: unknown, route: string) {
  if (error == null) return;
  if (
    typeof error === "object" &&
    "digest" in error &&
    error.digest === "DYNAMIC_SERVER_USAGE"
  ) {
    return;
  }

  Sentry.captureException(error, {
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
) {
  captureApiError(error, route);
  return response;
}
