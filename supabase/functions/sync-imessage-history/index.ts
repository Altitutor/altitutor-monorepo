import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveWithSentry } from "../_shared/sentry.ts";
import { authenticateBearer } from "../_shared/imessage.ts";

serveWithSentry("sync-imessage-history", (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type, authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const expected = Deno.env.get("SYNC_API_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!authenticateBearer(req.headers.get("Authorization"), expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    error: "sync-imessage-history is deprecated",
    replacement:
      "The Mac connector must replay reconciliation-message events through imessage-inbound.",
  }, { status: 410 });
});
