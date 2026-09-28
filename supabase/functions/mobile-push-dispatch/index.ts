import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serveWithSentry } from "../_shared/sentry.ts";

type Delivery = {
  id: string;
  expo_push_token: string;
  notification_id: string;
  app_scope: "student_web" | "ucat_web";
  student_id: string;
  category: string;
  notification_type: string;
  expires_at: string | null;
  resolved_at: string | null;
  dismissed_at: string | null;
  preference_enabled: boolean;
};

type ReceiptClaim = {
  id: string;
  ticket_id: string;
  expo_push_token: string;
};

type ExpoResult = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const sendEndpoint = "https://exp.host/--/api/v2/push/send";
const receiptEndpoint = "https://exp.host/--/api/v2/push/getReceipts";

function payloadFor(delivery: Delivery) {
  if (delivery.app_scope === "student_web") {
    return delivery.category === "sessions"
      ? { title: "Session update", body: "A session update is available.", destination: "classes" }
      : { title: "Payment needs attention", body: "Open Altitutor to view an update.", destination: "billing" };
  }
  const copy: Record<string, { title: string; body: string }> = {
    payments: { title: "Payment update", body: "Open Altitutor UCAT to view a payment update." },
    referrals: { title: "Referral update", body: "Open Altitutor UCAT to view a referral update." },
    quota_grants: { title: "Quota updated", body: "Your UCAT allowance has been updated." },
    quota_limits: { title: "Quota alert", body: "Open Altitutor UCAT to view your allowance." },
    new_content: { title: "New UCAT content", body: "New practice content is available." },
  };
  return { ...copy[delivery.category], destination: "inbox" };
}

function expoHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = Deno.env.get("EXPO_ACCESS_TOKEN")?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function expoPost(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: expoHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Expo push service returned HTTP ${response.status}`);
  return response.json();
}

function isExpoResult(value: unknown): value is ExpoResult {
  return Boolean(value && typeof value === "object" && "status" in value
    && (value.status === "ok" || value.status === "error"));
}

serveWithSentry("mobile-push-dispatch", async (request, sentry) => {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const dispatchSecret = Deno.env.get("MOBILE_PUSH_DISPATCH_SECRET_KEY")?.trim();
  if (!dispatchSecret) return Response.json({ error: "Not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${dispatchSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !url) return Response.json({ error: "Not configured" }, { status: 500 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const update = async (id: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from("mobile_push_deliveries").update({
      ...values, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;
  };
  const retire = async (token: string) => {
    const { error } = await supabase.from("mobile_push_devices").delete().eq("expo_push_token", token);
    if (error) throw error;
  };
  const retry = async (id: string, error: string) => {
    const { data, error: lookupError } = await supabase.from("mobile_push_deliveries")
      .select("attempts").eq("id", id).single();
    if (lookupError) throw lookupError;
    const attempts = data.attempts as number;
    const exhausted = attempts >= 8;
    await update(id, {
      status: exhausted ? "failed" : "pending",
      next_attempt_at: new Date(Date.now() + Math.min(2 ** attempts * 60_000, 3_600_000)).toISOString(),
      lease_expires_at: null,
      ticket_id: null,
      receipt_due_at: null,
      last_error: error.slice(0, 500),
    });
  };

  try {
    const { data: claimed, error: claimError } = await supabase.rpc("claim_mobile_push_deliveries", { p_limit: 100 });
    if (claimError) throw claimError;
    const deliveries = (claimed ?? []) as Delivery[];
    const eligible: Delivery[] = [];
    const now = Date.now();
    for (const delivery of deliveries) {
      if (!delivery.preference_enabled || delivery.resolved_at || delivery.dismissed_at
          || (delivery.expires_at && Date.parse(delivery.expires_at) <= now)) {
        await update(delivery.id, { status: "skipped", lease_expires_at: null });
      } else {
        eligible.push(delivery);
      }
    }

    if (eligible.length > 0) {
      let response: unknown;
      try {
        response = await expoPost(sendEndpoint, eligible.map((delivery) => {
          const copy = payloadFor(delivery);
          return {
            to: delivery.expo_push_token,
            title: copy.title,
            body: copy.body,
            data: { destination: copy.destination },
            sound: "default",
            channelId: delivery.app_scope === "student_web" ? "student-updates" : "ucat-updates",
          };
        }));
        if (!response || typeof response !== "object" || !("data" in response)
            || !Array.isArray(response.data) || response.data.length !== eligible.length) {
          throw new Error("Expo push service returned an invalid ticket batch");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Expo push request failed";
        await Promise.all(eligible.map((delivery) => retry(delivery.id, message)));
        throw error;
      }
      const tickets = (response as { data: unknown[] }).data;
      await Promise.all(eligible.map(async (delivery, index) => {
        const ticket = tickets[index];
        if (!isExpoResult(ticket)) {
          await retry(delivery.id, "Expo returned an invalid ticket");
        } else if (ticket.status === "ok" && ticket.id) {
          await update(delivery.id, {
            status: "ticket",
            ticket_id: ticket.id,
            receipt_due_at: new Date(Date.now() + 15 * 60_000).toISOString(),
            lease_expires_at: null,
            last_error: null,
          });
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          await retire(delivery.expo_push_token);
        } else {
          await retry(delivery.id, ticket.details?.error ?? ticket.message ?? "Expo rejected the push");
        }
      }));
    }

    const { data: claimedReceipts, error: receiptClaimError } = await supabase.rpc("claim_mobile_push_receipts", { p_limit: 100 });
    if (receiptClaimError) throw receiptClaimError;
    const receipts = (claimedReceipts ?? []) as ReceiptClaim[];
    if (receipts.length > 0) {
      const result = await expoPost(receiptEndpoint, { ids: receipts.map((receipt) => receipt.ticket_id) });
      if (!result || typeof result !== "object" || !("data" in result)
          || !result.data || typeof result.data !== "object") {
        throw new Error("Expo push service returned invalid receipts");
      }
      const byId = result.data as Record<string, unknown>;
      await Promise.all(receipts.map(async (receipt) => {
        const value = byId[receipt.ticket_id];
        if (!isExpoResult(value)) {
          await update(receipt.id, {
            receipt_due_at: new Date(Date.now() + 5 * 60_000).toISOString(),
            lease_expires_at: null,
          });
        } else if (value.status === "ok") {
          await update(receipt.id, { status: "delivered", lease_expires_at: null, receipt_due_at: null });
        } else if (value.details?.error === "DeviceNotRegistered") {
          await retire(receipt.expo_push_token);
        } else {
          await retry(receipt.id, value.details?.error ?? value.message ?? "Expo receipt failed");
        }
      }));
    }
    return Response.json({ sent: eligible.length, receipts: receipts.length });
  } catch (error) {
    sentry.captureException(error);
    console.error("[mobile push] Dispatch failed", error);
    return Response.json({ error: "Mobile push dispatch failed" }, { status: 500 });
  }
});
