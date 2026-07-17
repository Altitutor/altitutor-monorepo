import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import {
  authenticateBearer,
  firstString,
  isRecord,
} from "../_shared/imessage.ts";
import {
  connectorOutcome,
  normalizeCompletionResult,
  normalizeHeartbeatStatus,
} from "../_shared/imessage-connector.ts";

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

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  const secret = Deno.env.get("CONNECTOR_SECRET") ?? "";
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
          : 10;
        if (limit < 1 || limit > 100) {
          return json({ error: "limit must be between 1 and 100" }, 400);
        }
        const { data, error } = await supabase.rpc("claim_imessage_commands", {
          p_connector_id: connectorId,
          p_limit: limit,
        });
        if (error) throw error;
        return json({ commands: data ?? [] });
      }
      case "complete": {
        const commandId = firstString(body.commandId);
        const outcome = connectorOutcome(body.outcome) ??
          connectorOutcome(body.status);
        if (!commandId || !outcome) {
          return json({
            error:
              "commandId and outcome (succeeded, failed, or ambiguous) required",
          }, 400);
        }
        const result = normalizeCompletionResult(body.result);
        const { data, error } = await supabase.rpc(
          "complete_imessage_command",
          {
            p_command_id: commandId,
            p_connector_id: connectorId,
            p_status: outcome,
            p_result: result,
            p_error: firstString(body.error),
          },
        );
        if (error) throw error;
        const commandValue = Array.isArray(data) ? data[0] : data;
        const command = isRecord(commandValue) ? commandValue : {};
        return json({
          commandId: firstString(command.id) ?? commandId,
          status: firstString(command.status) ?? outcome,
          command: data,
        });
      }
      case "heartbeat": {
        const heartbeat = normalizeHeartbeatStatus(body.status);
        const { data, error } = await supabase.rpc(
          "heartbeat_imessage_connector",
          {
            p_connector_id: connectorId,
            p_status: heartbeat.status,
            p_app_version: null,
            p_host_label: null,
            p_capabilities: heartbeat.capabilities,
            p_metrics: heartbeat.metrics,
            p_last_error_code: null,
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
    console.error("[imessage-connector] request failed", error);
    return json({
      error: error instanceof Error ? error.message : "internal error",
    }, 500);
  }
});
