import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveWithSentry } from "../_shared/sentry.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createSupabaseClient } from "../_shared/supabase.ts";
import {
  findContactByIdentifier,
  findOrCreateContact,
} from "../_shared/contacts.ts";
import {
  addGroupChatParticipant,
  ensureConversation,
  ensureGroupChatConversation,
} from "../_shared/conversations.ts";
import {
  assertNever,
  authenticateBearer,
  extractChatIdentifier,
  firstString,
  isRecord,
  knownAppleService,
  monotonicAppleService,
  monotonicStatus,
  parseAppleService,
  type ParsedIMessageEvent,
  parseIMessageEvent,
} from "../_shared/imessage.ts";

interface OwnedNumber {
  id: string;
  phone_e164: string;
}

interface NormalizedMessage {
  guid: string;
  tempGuid: string | null;
  messageId: string | null;
  from: string | null;
  to: string | null;
  chatId: string | null;
  body: string;
  date: string;
  isFromMe: boolean;
  isGroup: boolean;
  groupName: string;
  isReaction: boolean;
  reactionType: string | null;
  associatedMessageGuid: string | null;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED" | "RECEIVED";
  deliveredAt: string | null;
  readAt: string | null;
  errorCode: string | null;
  appleService: "iMessage" | "SMS" | null;
  attachments: Array<{
    storage_url: string;
    filename: string | null;
    mime_type: string | null;
    size_bytes: number | null;
  }>;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function booleanValue(...values: unknown[]): boolean {
  return values.some((value) => value === true);
}

function stringOrNumber(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function rawEventData(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const rawPayload = isRecord(payload.RawPayload)
    ? payload.RawPayload
    : isRecord(payload.rawPayload)
    ? payload.rawPayload
    : null;
  return rawPayload && isRecord(rawPayload.data) ? rawPayload.data : {};
}

function outboundStatus(
  payload: Record<string, unknown>,
): NormalizedMessage["status"] {
  const state = firstString(payload.DeliveryState, payload.deliveryState)
    ?.toLowerCase();
  if (state === "read" || payload.IsRead === true) return "READ";
  if (state === "delivered") return "DELIVERED";
  if (state === "failed") return "FAILED";
  return "SENT";
}

function normalizeMessage(event: ParsedIMessageEvent): NormalizedMessage {
  const payload = event.payload;
  const guid = event.guid;
  if (!guid) throw new Error("MessageGuid/guid is required");
  const chatId = firstString(
    payload.chatId,
    payload.ChatId,
    extractChatIdentifier(payload.chatGuid),
    extractChatIdentifier(payload.ChatGuid),
  );
  const rawAttachments = Array.isArray(payload.attachments)
    ? payload.attachments
    : Array.isArray(payload.Attachments)
    ? payload.Attachments
    : [];
  const attachments = rawAttachments.flatMap((item) => {
    if (!isRecord(item)) return [];
    const storageUrl = firstString(item.storageUrl, item.url, item.path);
    if (!storageUrl) return [];
    const size = item.sizeBytes ?? item.size;
    return [{
      storage_url: storageUrl,
      filename: firstString(item.filename),
      mime_type: firstString(item.mimeType, item.type),
      size_bytes: typeof size === "number" && Number.isFinite(size)
        ? Math.trunc(size)
        : null,
    }];
  });
  return {
    guid,
    tempGuid: event.tempGuid,
    messageId: stringOrNumber(
      payload.messageId,
      payload.MessageId,
      payload.MessageSid,
    ),
    from: firstString(payload.from, payload.From, payload.sender),
    to: firstString(payload.to, payload.To, payload.recipient),
    chatId,
    body: firstString(payload.body, payload.Body, payload.text) ?? "",
    date: firstString(payload.date, payload.Date, payload.timestamp) ??
      new Date().toISOString(),
    isFromMe: booleanValue(payload.isFromMe, payload.IsFromMe),
    isGroup: booleanValue(payload.isGroupChat, payload.IsGroupChat) ||
      Boolean(chatId?.startsWith("chat")),
    groupName: firstString(
      payload.groupName,
      payload.chatDisplayName,
      payload.SenderName,
    ) ?? "Group Chat",
    isReaction: booleanValue(payload.isReaction, payload.IsReaction),
    reactionType: firstString(payload.reactionType, payload.ReactionType),
    associatedMessageGuid: firstString(
      payload.associatedMessageGuid,
      payload.AssociatedMessageGuid,
    ),
    status: booleanValue(payload.isFromMe, payload.IsFromMe)
      ? outboundStatus(payload)
      : "RECEIVED",
    deliveredAt: firstString(
      payload.dateDelivered,
      payload.DateDelivered,
    ),
    readAt: firstString(payload.dateRead, payload.DateRead),
    errorCode: stringOrNumber(payload.errorCode, payload.ErrorCode),
    appleService: parseAppleService({
      service: firstString(payload.Service, payload.service),
      chatGuid: firstString(payload.ChatGuid, payload.chatGuid),
    }),
    attachments,
  };
}

async function ownedNumber(supabase: SupabaseClient): Promise<OwnedNumber> {
  const { data, error } = await supabase
    .from("owned_numbers")
    .select("id, phone_e164")
    .eq("provider", "IMESSAGE")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    throw error ?? new Error("iMessage owned number not configured");
  }
  return data as OwnedNumber;
}

async function ensureMessageConversation(
  supabase: SupabaseClient,
  owned: OwnedNumber,
  message: NormalizedMessage,
): Promise<string> {
  if (message.isGroup) {
    if (!message.chatId) {
      throw new Error("Group message missing ChatGuid/ChatId");
    }
    const participant = message.isFromMe ? null : message.from;
    const participantId = participant
      ? await findOrCreateContact(
        supabase,
        participant.includes("@") ? undefined : participant,
        participant.includes("@") ? participant : undefined,
      )
      : null;
    return ensureGroupChatConversation(
      supabase,
      message.chatId,
      message.groupName,
      owned.id,
      participantId ? [participantId] : [],
    );
  }

  const identifier = message.isFromMe
    ? message.to ?? message.chatId
    : message.from ?? message.chatId;
  if (!identifier) {
    throw new Error("Individual message missing sender/recipient");
  }
  const contactId = await findOrCreateContact(
    supabase,
    identifier.includes("@") ? undefined : identifier,
    identifier.includes("@") ? identifier : undefined,
  );
  return ensureConversation(supabase, contactId, owned.id);
}

async function upsertAttachments(
  supabase: SupabaseClient,
  messageId: string,
  attachments: NormalizedMessage["attachments"],
): Promise<void> {
  if (attachments.length === 0) return;
  const { error } = await supabase.from("message_attachments").upsert(
    attachments.map((attachment) => ({ ...attachment, message_id: messageId })),
    { onConflict: "message_id,storage_url", ignoreDuplicates: true },
  );
  if (error) throw error;
}

/** Reconciliation overlap re-emits recent live traffic; only older catch-up is historical. */
const HISTORICAL_IMPORT_AGE_MS = 10 * 60 * 1000;

function isHistoricalImportEvent(
  sourceEventType: string,
  messageDateIso: string,
): boolean {
  if (sourceEventType !== "reconciliation-message") return false;
  const ts = Date.parse(messageDateIso);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts >= HISTORICAL_IMPORT_AGE_MS;
}

async function processMessage(
  supabase: SupabaseClient,
  owned: OwnedNumber,
  event: ParsedIMessageEvent,
): Promise<void> {
  const message = normalizeMessage(event);
  const fromLiveWebhook = event.sourceEventType === "new-message";
  const isHistoricalImport = isHistoricalImportEvent(
    event.sourceEventType,
    message.date,
  );
  const statusUpdatedAt = message.readAt ?? message.deliveredAt ?? message.date;
  const conversationId = await ensureMessageConversation(
    supabase,
    owned,
    message,
  );
  let existing: Record<string, unknown> | null = null;

  const { data: byGuid, error: guidError } = await supabase
    .from("messages")
    .select(
      "id, status, imessage_guid, imessage_temp_guid, is_historical_import, apple_service",
    )
    .eq("imessage_guid", message.guid)
    .maybeSingle();
  if (guidError) throw guidError;
  existing = byGuid;

  if (!existing && message.tempGuid) {
    const { data: byTempGuid, error: tempError } = await supabase
      .from("messages")
      .select(
        "id, status, imessage_guid, imessage_temp_guid, is_historical_import, apple_service",
      )
      .eq("imessage_temp_guid", message.tempGuid)
      .maybeSingle();
    if (tempError) throw tempError;
    existing = byTempGuid;
  }

  const incomingStatus = message.status;
  let messageId: string;
  const isNewRow = !existing;
  if (existing) {
    messageId = String(existing.id);
    const status = monotonicStatus(String(existing.status), incomingStatus);
    // Never upgrade a live row to historical via reconciliation overlap.
    // Live webhooks clear the flag if a missed webhook arrives after catch-up.
    const nextHistorical = fromLiveWebhook
      ? false
      : existing.is_historical_import === true;
    const currentAppleService = knownAppleService(existing.apple_service);
    const { error } = await supabase.from("messages").update({
      imessage_guid: message.guid,
      imessage_temp_guid: message.tempGuid ?? existing.imessage_temp_guid,
      message_sid: message.messageId,
      status,
      created_at: message.date,
      status_updated_at: statusUpdatedAt,
      sent_at: message.isFromMe ? message.date : undefined,
      received_at: message.isFromMe ? undefined : message.date,
      delivered_at: message.deliveredAt ?? undefined,
      read_at: message.readAt ?? undefined,
      provider_error_at: status === "FAILED" ? message.date : undefined,
      provider_error_code: status === "FAILED" ? message.errorCode : undefined,
      is_historical_import: nextHistorical,
      apple_service: monotonicAppleService(currentAppleService, message.appleService),
    }).eq("id", messageId);
    if (error) throw error;
  } else {
    const recipient = message.isFromMe
      ? message.to ?? message.chatId ?? owned.phone_e164
      : owned.phone_e164;
    const sender = message.isFromMe ? owned.phone_e164 : message.from;
    const { data, error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: message.isFromMe ? "OUTBOUND" : "INBOUND",
      body: message.body,
      created_at: message.date,
      from_number_e164: sender,
      to_number_e164: recipient,
      status: incomingStatus,
      status_updated_at: statusUpdatedAt,
      message_sid: message.messageId,
      imessage_guid: message.guid,
      imessage_temp_guid: message.tempGuid,
      is_reaction: message.isReaction,
      reaction_type: message.reactionType,
      associated_message_guid: message.associatedMessageGuid,
      sent_at: message.isFromMe ? message.date : null,
      received_at: message.isFromMe ? null : message.date,
      delivered_at: message.deliveredAt,
      read_at: message.readAt,
      provider_error_at: message.status === "FAILED" ? message.date : null,
      provider_error_code: message.errorCode,
      error_message: message.status === "FAILED"
        ? "iMessage delivery failed"
        : null,
      is_historical_import: isHistoricalImport,
      apple_service: message.appleService,
    }).select("id").single();
    if (error || !data) throw error ?? new Error("Message insert failed");
    messageId = String(data.id);
  }

  await upsertAttachments(supabase, messageId, message.attachments);
  const { error: conversationError } = await supabase.from("conversations")
    .update({
      last_message_at: message.date,
    }).eq("id", conversationId).or(
      `last_message_at.is.null,last_message_at.lt."${message.date}"`,
    );
  if (conversationError) throw conversationError;

  if (!message.isFromMe) {
    // New inserts sync unread/historical read state. Reconciliation updates of
    // already-imported rows must not re-mark chats read. Late live webhooks
    // clear unread after a prior historical insert.
    if (isNewRow || fromLiveWebhook) {
      const { error: readStateError } = await supabase.rpc(
        "sync_imessage_message_read_state",
        {
          p_conversation_id: conversationId,
          p_message_id: messageId,
          p_historical: isNewRow ? isHistoricalImport : false,
        },
      );
      if (readStateError) throw readStateError;
    }
  }
}

async function updateCorrelatedMessage(
  supabase: SupabaseClient,
  event: ParsedIMessageEvent,
  values: Record<string, unknown>,
): Promise<void> {
  if (!event.guid && !event.tempGuid) {
    throw new Error("Event requires guid or tempGuid");
  }
  let query = supabase.from("messages").update(values);
  query = event.guid
    ? query.eq("imessage_guid", event.guid)
    : query.eq("imessage_temp_guid", event.tempGuid);
  if (values.status === "FAILED") {
    query = query.in("status", ["QUEUED", "SENDING", "SENT", "AMBIGUOUS"]);
  } else if (values.status === "DELIVERED") {
    query = query.in("status", [
      "QUEUED",
      "SENDING",
      "FAILED",
      "AMBIGUOUS",
      "SENT",
      "DELIVERED",
    ]);
  }
  const { error } = await query;
  if (error) throw error;
}

async function processGroupEvent(
  supabase: SupabaseClient,
  owned: OwnedNumber,
  event: ParsedIMessageEvent,
): Promise<void> {
  const rawData = rawEventData(event.payload);
  const chatId = firstString(
    event.payload.chatId,
    event.payload.ChatId,
    extractChatIdentifier(event.payload.chatGuid),
    extractChatIdentifier(event.payload.ChatGuid),
    rawData.chatId,
    extractChatIdentifier(rawData.chatGuid),
    extractChatIdentifier(rawData.guid),
  );
  if (!chatId) throw new Error("Group event missing ChatGuid/ChatId");
  const groupName = firstString(
    event.payload.groupName,
    event.payload.name,
    rawData.groupName,
    rawData.displayName,
    rawData.name,
    rawData.newName,
  );
  const conversationId = await ensureGroupChatConversation(
    supabase,
    chatId,
    groupName ?? "Group Chat",
    owned.id,
    [],
  );

  switch (event.eventType) {
    case "group-name-changed": {
      if (!groupName) return;
      const { error } = await supabase.from("conversations")
        .update({ group_chat_name: groupName })
        .eq("id", conversationId);
      if (error) throw error;
      return;
    }
    case "participant-added":
    case "participant-removed": {
      const rawHandle = isRecord(rawData.handle) ? rawData.handle : null;
      const rawParticipant = isRecord(rawData.participant)
        ? rawData.participant
        : null;
      const participant = firstString(
        event.payload.participant,
        event.payload.handle,
        rawData.participant,
        rawData.address,
        rawData.participantAddress,
        rawHandle?.address,
        rawParticipant?.address,
      );
      if (!participant) {
        if (event.sourceEventType === "participant-left") return;
        throw new Error("Participant event missing participant");
      }
      if (event.eventType === "participant-added") {
        const contactId = await findOrCreateContact(
          supabase,
          participant.includes("@") ? undefined : participant,
          participant.includes("@") ? participant : undefined,
        );
        await addGroupChatParticipant(supabase, conversationId, contactId);
      } else {
        const contactId = await findContactByIdentifier(supabase, participant);
        if (!contactId) return;
        const { error } = await supabase.from("group_chat_participants")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("contact_id", contactId);
        if (error) throw error;
      }
      return;
    }
    case "new-message":
    case "reconciliation-message":
    case "message-send-error":
    case "delivery":
    case "typing":
    case "read":
    case "server":
    case "system":
      throw new Error(`Invalid group event type: ${event.eventType}`);
    default:
      return assertNever(event.eventType);
  }
}

async function dispatchEvent(
  supabase: SupabaseClient,
  event: ParsedIMessageEvent,
): Promise<void> {
  switch (event.eventType) {
    case "new-message":
    case "reconciliation-message":
      return processMessage(supabase, await ownedNumber(supabase), event);
    case "message-send-error": {
      const incomingApple = parseAppleService({
        service: firstString(event.payload.Service, event.payload.service),
        chatGuid: firstString(event.payload.ChatGuid, event.payload.chatGuid),
      });
      return updateCorrelatedMessage(supabase, event, {
        status: "FAILED",
        status_updated_at: new Date().toISOString(),
        provider_error_at: new Date().toISOString(),
        provider_error_code: stringOrNumber(
          event.payload.errorCode,
          event.payload.code,
          event.payload.ErrorCode,
        ),
        error_message:
          firstString(event.payload.error, event.payload.message) ??
            "iMessage send failed",
        ...(incomingApple ? { apple_service: incomingApple } : {}),
      });
    }
    case "delivery":
      return processMessage(supabase, await ownedNumber(supabase), event);
    case "read": {
      if (!event.guid && !event.tempGuid) return;
      return updateCorrelatedMessage(supabase, event, {
        status: "READ",
        status_updated_at: new Date().toISOString(),
        read_at: firstString(
          event.payload.DateRead,
          event.payload.dateRead,
          event.payload.Date,
          event.payload.date,
          event.payload.timestamp,
        ) ?? new Date().toISOString(),
      });
    }
    case "group-name-changed":
    case "participant-added":
    case "participant-removed":
      return processGroupEvent(supabase, await ownedNumber(supabase), event);
    case "typing":
    case "server":
    case "system":
      return;
    default:
      return assertNever(event.eventType);
  }
}

async function saveInbox(
  supabase: SupabaseClient,
  event: ParsedIMessageEvent,
): Promise<{ id: string; processed: boolean }> {
  const { data, error } = await supabase.from("imessage_events").insert({
    event_key: event.eventKey,
    event_type: event.sourceEventType,
    connector_id: event.connectorId,
    imessage_guid: event.guid,
    temp_guid: event.tempGuid,
    payload: event.payload,
  }).select("id, processed_at").single();
  if (!error && data) {
    return { id: String(data.id), processed: Boolean(data.processed_at) };
  }
  if (error?.code !== "23505") throw error;
  const { data: existing, error: existingError } = await supabase.from(
    "imessage_events",
  )
    .select("id, processed_at")
    .eq("event_key", event.eventKey)
    .single();
  if (existingError || !existing) {
    throw existingError ?? new Error("Inbox lookup failed");
  }
  return { id: String(existing.id), processed: Boolean(existing.processed_at) };
}

serveWithSentry("imessage-inbound", async (request: Request, sentry) => {
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  const secret = Deno.env.get("IMESSAGE_WEBHOOK_SECRET") ?? "";
  if (!secret) {
    return json({ error: "webhook authentication is not configured" }, 503);
  }
  if (!authenticateBearer(request.headers.get("Authorization"), secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  let inboxId: string | null = null;
  try {
    const event = parseIMessageEvent(await request.json());
    const supabase = createSupabaseClient();
    const inbox = await saveInbox(supabase, event);
    inboxId = inbox.id;
    if (inbox.processed) return json({ ok: true, duplicate: true });

    const { error: attemptError } = await supabase.from("imessage_events")
      .update({ processing_attempts: 1, processing_error: null })
      .eq("id", inbox.id)
      .eq("processing_attempts", 0);
    if (attemptError) throw attemptError;

    await dispatchEvent(supabase, event);
    const { error } = await supabase.from("imessage_events").update({
      processed_at: new Date().toISOString(),
      processing_error: null,
    }).eq("id", inbox.id);
    if (error) throw error;
    return json({ ok: true, eventId: inbox.id });
  } catch (error: unknown) {
    sentry.captureException(error);
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[imessage-inbound] processing failed", { inboxId, message });
    if (inboxId) {
      const supabase = createSupabaseClient();
      await supabase.from("imessage_events").update({
        processing_error: message.slice(0, 2000),
      }).eq("id", inboxId);
    }
    return json({ error: message, eventId: inboxId }, 500);
  }
});

export { dispatchEvent, normalizeMessage };
