import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parseTrackedResendEvent } from "./logic.ts";
import { capturePosthogEmailEvent } from "./posthog.ts";
import { verifyResendWebhook } from "./security.ts";

const MAX_WEBHOOK_BYTES = 256_000;

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET")?.trim();
  if (!webhookSecret) {
    console.error("[resend-webhooks] RESEND_WEBHOOK_SECRET is not configured");
    return json({ error: "Webhook is not configured" }, 500);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return json({ error: "Payload too large" }, 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) {
    return json({ error: "Payload too large" }, 413);
  }

  const providerEventId = request.headers.get("svix-id")?.trim() ?? "";
  let verifiedPayload: unknown;
  try {
    verifiedPayload = verifyResendWebhook(
      rawBody,
      {
        id: providerEventId,
        timestamp: request.headers.get("svix-timestamp")?.trim() ?? "",
        signature: request.headers.get("svix-signature")?.trim() ?? "",
      },
      webhookSecret,
    );
  } catch {
    return json({ error: "Invalid webhook signature" }, 400);
  }

  let event;
  try {
    event = parseTrackedResendEvent(verifiedPayload);
  } catch (error) {
    console.error(
      "[resend-webhooks] Invalid signed payload",
      error instanceof Error ? error.message : "Unknown error",
    );
    return json({ error: "Invalid webhook payload" }, 400);
  }

  if (!event) {
    return json({ received: true, tracked: false }, 202);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error("[resend-webhooks] Supabase service credentials are missing");
    return json({ error: "Webhook storage is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc(
    "record_ucat_resend_email_event",
    {
      p_provider_event_id: providerEventId,
      p_provider_message_id: event.providerMessageId,
      p_event_type: event.type,
      p_occurred_at: event.occurredAt,
      p_recipient_email: event.recipientEmail,
      p_payload_metadata: event.metadata,
    },
  );
  if (error) {
    console.error("[resend-webhooks] Could not store event", error.message);
    return json({ error: "Could not store webhook event" }, 500);
  }

  const result = Array.isArray(data) ? data[0] : data;
  let authUserId = typeof result?.auth_user_id === "string"
    ? result.auth_user_id
    : null;
  let campaignKey = typeof result?.campaign_key === "string"
    ? result.campaign_key
    : null;

  // Transactional emails use the outbox rather than the lifecycle ledger.
  // Resolve their student and template here so engagement keeps the same
  // stable PostHog identity and the durable event stream remains attributable.
  if (!authUserId || !campaignKey) {
    const { data: outbox } = await supabase
      .from("ucat_transactional_email_outbox")
      .select("student_id, template_key")
      .eq("provider_message_id", event.providerMessageId)
      .maybeSingle();
    if (outbox?.student_id) {
      const { data: student } = await supabase
        .from("students")
        .select("user_id")
        .eq("id", outbox.student_id)
        .maybeSingle();
      authUserId = student?.user_id ?? authUserId;
    }
    if (!authUserId && event.recipientEmail) {
      const { data: student } = await supabase
        .from("students")
        .select("user_id")
        .eq("email", event.recipientEmail)
        .maybeSingle();
      authUserId = student?.user_id ?? authUserId;
    }
    campaignKey = outbox?.template_key ??
      event.metadata.tag_campaign ??
      event.metadata.tag_template ??
      campaignKey;
    if (campaignKey) {
      await supabase
        .from("ucat_email_delivery_events")
        .update({ campaign_key: campaignKey })
        .eq("provider_event_id", providerEventId);
    }
  }

  if (result?.inserted) {
    await capturePosthogEmailEvent({
      event,
      providerEventId,
      authUserId,
      campaignKey,
    });
  }

  return json({
    received: true,
    tracked: true,
    duplicate: result?.inserted === false,
  });
});
