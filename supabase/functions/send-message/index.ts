import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveWithSentry } from "../_shared/sentry.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import {
  loadMessageSendData,
  updateMessageStatus,
} from "../_shared/messages.ts";

type SendBody = { messageId: string };

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
    throw new Error(json?.message || "Twilio send error");
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

  let messageId: string | undefined;

  try {
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
    console.log("[send-message] Loaded data", {
      messageId: data.message.id,
      conversationId: data.conversation.id,
      provider: data.ownedNumber.provider,
      isGroupChat: data.conversation.is_group_chat,
    });

    const provider = data.ownedNumber.provider;
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
    if (messageId) {
      try {
        const supabase = createSupabaseClient();
        await updateMessageStatus(supabase, messageId, "FAILED", {
          error_message: msg,
        });
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
