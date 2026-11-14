import * as Sentry from "@sentry/nextjs";

let windowStarted = 0;
let captures = 0;

function boundedMilliseconds(value: number) {
  return Number.isFinite(value)
    ? Math.min(3600000, Math.max(0, Math.round(value)))
    : null;
}

/** Evidence only: never changes consent, retries, or exposes reporting data. */
export function captureReportingAuditDiagnostic(input: {
  code: string;
  verifiedAt: unknown;
  queryMs: number;
  auditMs: number;
}) {
  try {
    const client = Sentry.getClient();
    if (!client || client.getOptions().enabled === false) return;
    const now = Date.now();
    // At most ten events per minute per server process, with constant memory.
    if (now - windowStarted >= 60000 || now < windowStarted) {
      windowStarted = now;
      captures = 0;
    }
    if (captures >= 10) return;
    captures++;
    const evidence = {
      schema: 1,
      stage: "reporting_audit",
      code: ["42501", "PGRST301"].includes(input.code) ? input.code : "unknown",
      verified_request_age_ms:
        typeof input.verifiedAt === "number"
          ? boundedMilliseconds(now - input.verifiedAt)
          : null,
      query_ms: boundedMilliseconds(input.queryMs),
      audit_ms: boundedMilliseconds(input.auditMs),
    };
    const diagnosticScope = new Sentry.Scope();
    diagnosticScope.setClient(client);
    Sentry.withScope(diagnosticScope, (scope) => {
      // Allowlist the whole event, excluding inherited auth, request and SQL data.
      scope.addEventProcessor((event) => ({
        event_id: event.event_id,
        timestamp: event.timestamp,
        release: event.release,
        environment: event.environment,
        message: "Admin MCP reporting audit diagnostic",
        level: "info",
        contexts: { reporting_audit: evidence },
      }));
      Sentry.captureEvent({ message: "Admin MCP reporting audit diagnostic" });
    });
  } catch {
    // Telemetry must not change the reporting tool's response or enforcement.
  }
}
