import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCommandRequest } from "../_shared/imessage.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization) return json({ error: "authorization required" }, 401);
  if (!supabaseUrl || !anonKey) {
    return json({ error: "function is not configured" }, 503);
  }

  try {
    const command = validateCommandRequest(await request.json());
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data, error } = await supabase.rpc("enqueue_imessage_command", {
      p_command_type: command.commandType,
      p_message_id: command.messageId,
      p_conversation_id: command.conversationId,
      p_payload: command.payload,
      p_reason: command.reason,
      p_idempotency_key: command.idempotencyKey,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : 400;
      return json({ error: error.message, code: error.code }, status);
    }
    const commandValue = Array.isArray(data) ? data[0] : data;
    const commandData = commandValue && typeof commandValue === "object"
      ? commandValue as Record<string, unknown>
      : {};
    return json({
      commandId: commandData.id,
      status: commandData.status,
      command: data,
    }, 202);
  } catch (error: unknown) {
    return json({
      error: error instanceof Error ? error.message : "invalid request",
    }, 400);
  }
});
