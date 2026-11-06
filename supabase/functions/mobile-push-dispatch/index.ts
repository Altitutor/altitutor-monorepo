import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serveWithSentry } from "../_shared/sentry.ts";
import { batchPushDeliveries, messageFor, type PushRecipient } from "./messages.ts";

type Claim = {
  id: string;
  expo_push_token: string;
  lease_expires_at: string;
};

type Delivery = PushRecipient & Claim & {
  expires_at: string | null;
  resolved_at: string | null;
  dismissed_at: string | null;
  preference_enabled: boolean;
};

type ReceiptClaim = Claim & { ticket_id: string };

type ExpoResult = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const sendEndpoint = "https://exp.host/--/api/v2/push/send";
const receiptEndpoint = "https://exp.host/--/api/v2/push/getReceipts";

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
  const update = async (claim: Claim, values: Record<string, unknown>) => {
    const { error } = await supabase.from("mobile_push_deliveries").update({
      ...values, updated_at: new Date().toISOString(),
    }).eq("id", claim.id).eq("lease_expires_at", claim.lease_expires_at);
    if (error) throw error;
  };
  const retire = async (claim: Claim, status: "sending" | "ticket") => {
    const { error } = await supabase.rpc("retire_mobile_push_device", {
      p_delivery_id: claim.id,
      p_expo_push_token: claim.expo_push_token,
      p_status: status,
      p_lease_expires_at: claim.lease_expires_at,
    });
    if (error) throw error;
  };
  const retry = async (claim: Claim, error: string) => {
    const { data, error: lookupError } = await supabase.from("mobile_push_deliveries")
      .select("attempts").eq("id", claim.id)
      .eq("lease_expires_at", claim.lease_expires_at).maybeSingle();
    if (lookupError) throw lookupError;
    if (!data) return; // The device may have signed out or the delivery may have been reclaimed.
    const attempts = data.attempts as number;
    const exhausted = attempts >= 8;
    await update(claim, {
      status: exhausted ? "failed" : "pending",
      next_attempt_at: new Date(Date.now() + Math.min(2 ** attempts * 60_000, 3_600_000)).toISOString(),
      lease_expires_at: null,
      ticket_id: null,
      receipt_due_at: null,
      last_error: error.slice(0, 500),
    });
  };

  async function sendDeliveries() {
    const { data: claimed, error: claimError } = await supabase.rpc("claim_mobile_push_deliveries", { p_limit: 100 });
    if (claimError) throw claimError;
    const deliveries = (claimed ?? []) as Delivery[];
    const eligible: Delivery[] = [];
    const now = Date.now();
    for (const delivery of deliveries) {
      if (!delivery.preference_enabled || delivery.resolved_at || delivery.dismissed_at
          || (delivery.expires_at && Date.parse(delivery.expires_at) <= now)) {
        await update(delivery, { status: "skipped", lease_expires_at: null });
      } else {
        eligible.push(delivery);
      }
    }

    const sends = await Promise.allSettled(batchPushDeliveries(eligible).map(async (batch) => {
      let response: unknown;
      try {
        response = await expoPost(sendEndpoint, batch.map(messageFor));
        if (!response || typeof response !== "object" || !("data" in response)
            || !Array.isArray(response.data) || response.data.length !== batch.length) {
          throw new Error("Expo push service returned an invalid ticket batch");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Expo push request failed";
        await Promise.all(batch.map((delivery) => retry(delivery, message)));
        throw error;
      }
      const tickets = (response as { data: unknown[] }).data;
      await Promise.all(batch.map(async (delivery, index) => {
        const ticket = tickets[index];
        if (!isExpoResult(ticket)) {
          await retry(delivery, "Expo returned an invalid ticket");
        } else if (ticket.status === "ok" && ticket.id) {
          await update(delivery, {
            status: "ticket",
            ticket_id: ticket.id,
            receipt_due_at: new Date(Date.now() + 15 * 60_000).toISOString(),
            lease_expires_at: null,
            last_error: null,
          });
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          await retire(delivery, "sending");
        } else {
          await retry(delivery, ticket.details?.error ?? ticket.message ?? "Expo rejected the push");
        }
      }));
    }));
    const failedSend = sends.find((result) => result.status === "rejected");
    if (failedSend) throw failedSend.reason;
    return eligible.length;
  }

  async function pollReceipts() {
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
          await update(receipt, {
            receipt_due_at: new Date(Date.now() + 5 * 60_000).toISOString(),
            lease_expires_at: null,
          });
        } else if (value.status === "ok") {
          await update(receipt, { status: "delivered", lease_expires_at: null, receipt_due_at: null });
        } else if (value.details?.error === "DeviceNotRegistered") {
          await retire(receipt, "ticket");
        } else {
          await retry(receipt, value.details?.error ?? value.message ?? "Expo receipt failed");
        }
      }));
    }
    return receipts.length;
  }

  const [send, receipts] = await Promise.allSettled([sendDeliveries(), pollReceipts()]);
  if (send.status === "fulfilled" && receipts.status === "fulfilled") {
    return Response.json({ sent: send.value, receipts: receipts.value });
  }
  for (const [stage, result] of [["send", send], ["receipts", receipts]] as const) {
    if (result.status === "rejected") {
      sentry.captureException(result.reason);
      console.error(`[mobile push] ${stage} failed`, result.reason);
    }
  }
  return Response.json({ error: "Mobile push dispatch failed" }, { status: 500 });
});
