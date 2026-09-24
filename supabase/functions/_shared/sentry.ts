import * as Sentry from "npm:@sentry/deno@10.65.0";

const FLUSH_TIMEOUT_MS = 2_000;
const sentryDsn = Deno.env.get("SENTRY_DSN")?.trim();

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: Deno.env.get("SENTRY_ENVIRONMENT")?.trim() || "unknown",
  release: Deno.env.get("DENO_DEPLOYMENT_ID")?.trim() || undefined,
  defaultIntegrations: false,
  sendDefaultPii: false,
});

export type EdgeFunctionSentry = {
  captureException(error: unknown): void;
};

type EdgeFunctionHandler = (
  request: Request,
  sentry: EdgeFunctionSentry,
) => Response | Promise<Response>;

const disabledReporter: EdgeFunctionSentry = {
  captureException: () => {},
};

function setRequestContext(scope: Sentry.Scope, functionName: string): void {
  scope.setTag("supabase.function", functionName);
  scope.setTag("runtime", "supabase-edge");

  const region = Deno.env.get("SB_REGION")?.trim();
  if (region) scope.setTag("supabase.region", region);

  const executionId = Deno.env.get("SB_EXECUTION_ID")?.trim();
  if (executionId) scope.setTag("supabase.execution_id", executionId);
}

/**
 * Runs a Supabase Edge Function in a request-local Sentry scope.
 *
 * Supabase can reuse a Deno isolate across requests, while the Sentry Deno SDK
 * does not isolate Deno.serve scopes automatically. Keeping all request tags
 * inside withScope prevents context from leaking between invocations.
 */
export function serveWithSentry(
  functionName: string,
  handler: EdgeFunctionHandler,
): void {
  if (!sentryDsn) {
    Deno.serve((request: Request) => handler(request, disabledReporter));
    return;
  }

  Deno.serve((request: Request) =>
    Sentry.withScope(async (scope) => {
      setRequestContext(scope, functionName);
      let eventRecorded = false;
      const reporter: EdgeFunctionSentry = {
        captureException(error: unknown) {
          eventRecorded = true;
          Sentry.captureException(error);
        },
      };

      try {
        const response = await handler(request, reporter);
        if (response.status >= 500 && !eventRecorded) {
          eventRecorded = true;
          scope.setFingerprint([
            "supabase-edge-5xx",
            functionName,
            String(response.status),
          ]);
          Sentry.captureMessage(
            `Supabase Edge Function returned ${response.status}`,
            {
              level: "error",
              extra: { method: request.method, status: response.status },
            },
          );
        }
        if (eventRecorded) await Sentry.flush(FLUSH_TIMEOUT_MS);
        return response;
      } catch (error: unknown) {
        scope.setExtra("method", request.method);
        reporter.captureException(error);
        await Sentry.flush(FLUSH_TIMEOUT_MS);
        throw error;
      }
    })
  );
}
