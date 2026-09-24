import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveWithSentry } from "../_shared/sentry.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import {
  authenticateBearer,
  firstString,
  isRecord,
} from "../_shared/imessage.ts";
import { connectorOutcome } from "../_shared/imessage-connector.ts";

type ConnectorAction = "claim" | "complete" | "heartbeat";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function connectorAction(value: unknown): ConnectorAction {
  if (value === "claim" || value === "complete" || value === "heartbeat") {
    return value;
  }
  throw new Error("action must be claim, complete, or heartbeat");
}

function normalizePrintHeartbeat(
  value: unknown,
): { status: "healthy" | "degraded" | "offline" | "paused"; metrics: Record<string, number | boolean> } {
  if (!isRecord(value)) {
    return { status: "healthy", metrics: {} };
  }
  const status = value.status;
  if (
    status === "healthy" ||
    status === "degraded" ||
    status === "offline" ||
    status === "paused"
  ) {
    const metrics: Record<string, number | boolean> = {};
    if (isRecord(value.metrics)) {
      for (const [key, metricValue] of Object.entries(value.metrics)) {
        if (typeof metricValue === "number" || typeof metricValue === "boolean") {
          metrics[key] = metricValue;
        }
      }
    }
    return { status, metrics };
  }
  return { status: "healthy", metrics: {} };
}

function normalizePrintResult(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  const cupsJobId = firstString(value.cupsJobId, value.cups_job_id);
  return {
    ...value,
    ...(cupsJobId ? { cupsJobId } : {}),
  };
}

serveWithSentry("print-connector", async (request: Request, sentry) => {
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const secret = Deno.env.get("PRINT_CONNECTOR_SECRET") ??
    Deno.env.get("CONNECTOR_SECRET") ??
    Deno.env.get("IMESSAGE_WEBHOOK_SECRET") ??
    "";
  if (!secret) {
    return json({ error: "connector authentication is not configured" }, 503);
  }
  if (!authenticateBearer(request.headers.get("Authorization"), secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) return json({ error: "body must be an object" }, 400);
    const action = connectorAction(body.action);
    const connectorId = firstString(body.connectorId);
    if (!connectorId || !/^[A-Za-z0-9._-]{1,100}$/.test(connectorId)) {
      return json({ error: "valid connectorId required" }, 400);
    }
    const supabase = createSupabaseClient();

    switch (action) {
      case "claim": {
        const limit = typeof body.limit === "number"
          ? Math.trunc(body.limit)
          : 5;
        if (limit < 1 || limit > 20) {
          return json({ error: "limit must be between 1 and 20" }, 400);
        }
        const { data, error } = await supabase.rpc("claim_print_jobs", {
          p_connector_id: connectorId,
          p_limit: limit,
        });
        if (error) throw error;
        return json({ jobs: data ?? [] });
      }
      case "complete": {
        const jobId = firstString(body.jobId, body.commandId);
        const outcome = connectorOutcome(body.outcome) ??
          connectorOutcome(body.status);
        if (!jobId || !outcome) {
          return json({
            error:
              "jobId and outcome (succeeded, failed, or ambiguous) required",
          }, 400);
        }
        const result = normalizePrintResult(body.result);
        const { data, error } = await supabase.rpc("complete_print_job", {
          p_job_id: jobId,
          p_connector_id: connectorId,
          p_status: outcome,
          p_result: result,
          p_error: firstString(body.error),
        });
        if (error) throw error;
        const jobValue = Array.isArray(data) ? data[0] : data;
        const job = isRecord(jobValue) ? jobValue : {};
        return json({
          jobId: firstString(job.id) ?? jobId,
          status: firstString(job.status) ?? outcome,
          job: data,
        });
      }
      case "heartbeat": {
        const heartbeat = normalizePrintHeartbeat(body.status);
        const { data, error } = await supabase.rpc(
          "heartbeat_print_connector",
          {
            p_connector_id: connectorId,
            p_status: heartbeat.status,
            p_app_version: firstString(body.appVersion),
            p_host_label: firstString(body.hostLabel),
            p_capabilities: ["cups", "office-print"],
            p_metrics: heartbeat.metrics,
            p_last_error_code: firstString(body.lastErrorCode),
          },
        );
        if (error) throw error;
        return json({
          connectorId,
          status: heartbeat.status,
          connector: data,
        });
      }
      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  } catch (error: unknown) {
    sentry.captureException(error);
    console.error("[print-connector] request failed", error);
    return json({
      error: error instanceof Error ? error.message : "internal error",
    }, 500);
  }
});
