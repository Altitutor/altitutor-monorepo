import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serveWithSentry } from "../_shared/sentry.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import {
  loadMessageSendData,
  updateMessageStatus,
} from "../_shared/messages.ts";

type SendBody = { messageId: string };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function authorize(request: Request): Promise<number> {
  const token = /^Bearer (.+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (!token) return 401;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return 200;
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return 503;

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc("is_adminstaff_active");
  return !error && data === true ? 200 : 403;
}

class TwilioSendError extends Error {
  constructor(message: string, readonly code: number | null) {
    super(message);
  }
}

class RecoveryOutcomeUnknownError extends Error {}

// ========================
// TWILIO HANDLER
// ========================

async function callTwilioSend(
  to: string,
  body: string,
  from?: string,
  messagingServiceSid?: string,
  statusCallback?: string,
) {
  const accountSidRaw = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const authTokenRaw = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const apiKeySidRaw = Deno.env.get("TWILIO_API_KEY_SID") || "";
  const apiKeySecretRaw = Deno.env.get("TWILIO_API_KEY_SECRET") || "";

  const accountSid = accountSidRaw.trim();
  const authToken = authTokenRaw.trim();
  const apiKeySid = apiKeySidRaw.trim();
  const apiKeySecret = apiKeySecretRaw.trim();

  if (!accountSid) {
    throw new Error("Twilio credentials missing (TWILIO_ACCOUNT_SID)");
  }

  const basicUser = apiKeySid || accountSid;
  const basicPass = apiKeySid ? apiKeySecret : authToken;
  if (!basicUser || !basicPass) {
    throw new Error("Twilio credentials missing (username/password)");
  }

  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("Body", body);
  if (statusCallback) form.set("StatusCallback", statusCallback);
  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid);
  } else if (from) {
    form.set("From", from);
  }

  console.log("[send-message] Twilio request", {
    to,
    usingMessagingService: !!messagingServiceSid,
    from: from || null,
    hasStatusCallback: !!statusCallback,
    authMode: apiKeySid ? "API_KEY" : "ACCOUNT",
    accountSidSuffix: accountSid.slice(-6),
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${basicUser}:${basicPass}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("[send-message] Twilio error", { status: res.status, json });
    throw new TwilioSendError(
      json?.message || "Twilio send error",
      Number.isInteger(json?.code) ? json.code : null,
    );
  }

  console.log("[send-message] Twilio success", {
    sid: json?.sid,
    status: json?.status,
  });
  return json; // includes sid, status, etc.
}

async function handleTwilio(
  supabase: ReturnType<typeof createSupabaseClient>,
  data: Awaited<ReturnType<typeof loadMessageSendData>>,
  messageId: string,
) {
  const { message, contact, ownedNumber } = data;

  if (!contact || !contact.phone_e164) {
    throw new Error("Contact phone number not found");
  }

  const { data: sendClaim, error: claimError } = await supabase.rpc(
    "claim_automation_message_send",
    { p_message_id: messageId, p_destination: contact.phone_e164 },
  );
  if (claimError) throw claimError;
  if (sendClaim?.blocked) {
    throw new TwilioSendError("Destination rejected (21211); staff recovery required", 21211);
  }
  if (sendClaim?.dispatch === false) return { success: true, queued: true };
  // Retain the actual attempted destination even when the provider rejects it.
  const { error: destinationError } = await supabase.from("messages")
    .update({ to_number_e164: contact.phone_e164 }).eq("id", messageId);
  if (destinationError) throw destinationError;

  // Determine from value based on sender type
  const fromValue = ownedNumber.sender_type === "ALPHANUMERIC"
    ? ownedNumber.alphanumeric_sender_id
    : ownedNumber.phone_e164;

  console.log("[send-message] Handling Twilio", {
    to: contact.phone_e164,
    sender_type: ownedNumber.sender_type,
    from: fromValue,
    messaging_service_sid: ownedNumber.messaging_service_sid || null,
  });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const statusCallback = new URL("/functions/v1/twilio-status", supabaseUrl)
    .toString();

  try {
  const tw = await callTwilioSend(
    contact.phone_e164,
    message.body,
    fromValue || undefined,
    ownedNumber.messaging_service_sid || undefined,
    statusCallback,
  );

  await updateMessageStatus(supabase, messageId, "SENDING", {
    message_sid: tw.sid,
    sent_at: new Date().toISOString(),
    from_number_e164: ownedNumber.sender_type === "PHONE"
      ? ownedNumber.phone_e164
      : null,
    to_number_e164: contact.phone_e164,
  });

  console.log("[send-message] Updated message to SENDING", {
    id: messageId,
    sid: tw.sid,
  });

  return { success: true, sid: tw.sid };
  } catch (error) {
    if ((sendClaim?.recovery || message.scheduled_at) && !(error instanceof TwilioSendError)) {
      throw new RecoveryOutcomeUnknownError(
        "Recovery outcome unconfirmed. Reconcile the provider outcome before sending again.",
      );
    }
    throw error;
  }
}

// ========================
// IMESSAGE HANDLER
// ========================

async function handleIMessage(
  supabase: ReturnType<typeof createSupabaseClient>,
  data: Awaited<ReturnType<typeof loadMessageSendData>>,
  messageId: string,
) {
  const { conversation, contact, ownedNumber } = data;

  if (ownedNumber.provider !== "IMESSAGE") {
    throw new Error("Owned number is not an iMessage number");
  }

  if (conversation.is_group_chat) {
    if (!conversation.group_chat_id) {
      throw new Error("Group chat conversation missing group_chat_id");
    }
  } else {
    if (!conversation.contact_id || !contact?.phone_e164 && !contact?.email) {
      throw new Error("Contact has no phone or email");
    }
  }

  const { data: command, error } = await supabase.rpc(
    "ensure_imessage_send_command",
    {
      p_message_id: messageId,
    },
  );
  if (error) throw error;

  return {
    success: true,
    queued: true,
    commandId: (command as { id?: string } | null)?.id,
    messageId,
  };
}

// ========================
// MAIN HANDLER
// ========================

serveWithSentry("send-message", async (req: Request, sentry) => {
  if (req.method === "OPTIONS") {
    const acrh = req.headers.get("access-control-request-headers") || "";
    const requestHeaders = (
      acrh ||
      "authorization, x-client-info, apikey, content-type, x-supabase-authorization"
    ).toLowerCase();
    console.log("[send-message] CORS preflight", { acrh });
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": requestHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin, Access-Control-Request-Headers",
      },
    });
  }

  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { headers: cors, status: 405 });

  let messageId: string | undefined;
  let canMarkFailed = false;
  let dispatchLoaded = false;

  try {
    const access = await authorize(req);
    if (access !== 200) {
      return Response.json({ error: "Send not authorized" }, { headers: cors, status: access });
    }
    const body = (await req.json()) as SendBody;
    messageId = body.messageId;
    console.log("[send-message] Entry", { messageId });

    if (!messageId) {
      return new Response(
        JSON.stringify({ error: "messageId required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers":
              "content-type, authorization, x-client-info, apikey",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          },
        },
      );
    }

    const supabase = createSupabaseClient();

    // Load all required data
    const data = await loadMessageSendData(supabase, messageId);
    dispatchLoaded = true;
    console.log("[send-message] Loaded data", {
      messageId: data.message.id,
      conversationId: data.conversation.id,
      provider: data.ownedNumber.provider,
      isGroupChat: data.conversation.is_group_chat,
    });

    const provider = data.ownedNumber.provider;
    if (data.message.scheduled_at) {
      // Repeated cron requests and simultaneous invocations must claim the same
      // message only once, and only after its scheduled time.
      const now = new Date().toISOString();
      const { data: claimed, error } = await supabase.from("messages")
        .update({ status: "SENDING", status_updated_at: now })
        .eq("id", messageId)
        .eq("status", "SCHEDULED")
        .lte("scheduled_at", now)
        .select("id");
      if (error) throw error;
      if (!claimed?.length) return Response.json({ success: true, queued: true }, {
        headers: cors,
      });
      canMarkFailed = true;

      const address = data.message.to_number_e164;
      if (data.contact?.is_opted_out || (data.conversation.is_group_chat
          ? address !== data.conversation.group_chat_id
          : address !== data.contact?.phone_e164
            && (provider !== "IMESSAGE" || address !== data.contact?.email))) {
        throw new Error("The scheduled recipient changed or opted out. Review the recipient before sending.");
      }
    }
    canMarkFailed = true;
    let result: {
      success: boolean;
      sid?: string;
      messageId?: string;
      queued?: boolean;
      commandId?: string;
    };

    switch (provider) {
      case "IMESSAGE":
        result = await handleIMessage(supabase, data, messageId);
        break;
      case "TWILIO":
        result = await handleTwilio(supabase, data, messageId);
        break;
      default: {
        const exhaustive: never = provider;
        throw new Error(
          `Unsupported or missing messaging provider: ${String(exhaustive)}`,
        );
      }
    }

    if (data.message.scheduled_at && data.message.created_by_staff_id) {
      const { error } = await supabase.from("conversations")
        .update({ assigned_staff_id: null })
        .eq("id", data.conversation.id)
        .eq("assigned_staff_id", data.message.created_by_staff_id);
      if (error) console.warn("[send-message] Could not clear assignment after scheduled send", error);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin, Access-Control-Request-Headers",
      },
    });
  } catch (e: unknown) {
    sentry.captureException(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-message] Error", msg);

    // Best effort: if we have messageId (captured before error), mark message as failed
    if (messageId && (canMarkFailed || !dispatchLoaded)) {
      try {
        const supabase = createSupabaseClient();
        if (canMarkFailed) {
          await updateMessageStatus(supabase, messageId, e instanceof RecoveryOutcomeUnknownError ? "AMBIGUOUS" : "FAILED", {
            error_message: msg,
            ...(e instanceof TwilioSendError ? { error_code: e.code } : {}),
          });
        } else {
          // Preserve the immediate-send failure status without changing a
          // scheduled message that has not been claimed by this invocation.
          const { error } = await supabase.from("messages")
            .update({ status: "FAILED", error_message: msg, status_updated_at: new Date().toISOString() })
            .eq("id", messageId)
            .is("scheduled_at", null);
          if (error) throw error;
        }
      } catch (updateErr) {
        console.error(
          "[send-message] Failed to update message status",
          updateErr,
        );
      }
    }

    return new Response(JSON.stringify({ error: msg || "Unknown error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin, Access-Control-Request-Headers",
      },
    });
  }
});
