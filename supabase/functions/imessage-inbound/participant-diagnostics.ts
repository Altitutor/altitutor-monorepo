import {
  extractChatIdentifier,
  firstString,
  isRecord,
  type ParsedIMessageEvent,
} from "../_shared/imessage.ts";

/** Temporary failure-only probe. Remove after a real occurrence yields a regression fixture. */
export function reportMissingParticipants(
  event: ParsedIMessageEvent,
  message: {
    isFromMe: boolean;
    isGroup: boolean;
    from: string | null;
    to: string | null;
    chatId: string | null;
  },
  reason: "individual_participant_missing" | "group_chat_missing",
): void {
  try {
    const raw = isRecord(event.payload.RawPayload)
      ? event.payload.RawPayload
      : isRecord(event.payload.rawPayload)
      ? event.payload.rawPayload
      : null;
    const data = raw && isRecord(raw.data) ? raw.data : null;
    const handle = data && isRecord(data.handle) ? data.handle : null;
    // Every value is a boolean or fixed enum. Never copy raw strings, field
    // names, identifiers, message text, attachment URLs or arbitrary errors.
    console.error("[DEBUG-imessage-participants-v1]", {
      version: 1,
      event_type: event.eventType,
      source_event_type:
        ["message", "new-message", "reconciliation-message"].includes(
            event.sourceEventType,
          )
          ? event.sourceEventType
          : "other",
      reason,
      is_from_me: message.isFromMe,
      is_group: message.isGroup,
      has_guid: Boolean(event.guid),
      has_from: Boolean(message.from),
      has_to: Boolean(message.to),
      has_chat_id: Boolean(message.chatId),
      raw_data_present: Boolean(data),
      raw_has_handle_address: Boolean(firstString(handle?.address)),
      raw_has_from: Boolean(firstString(data?.from, data?.From, data?.sender)),
      raw_has_to: Boolean(firstString(data?.to, data?.To, data?.recipient)),
      raw_has_chat_id: Boolean(
        firstString(data?.chatId, extractChatIdentifier(data?.chatGuid)),
      ),
      raw_has_chat_entries: Array.isArray(data?.chats) && data.chats.length > 0,
    });
  } catch {
    // A diagnostic sink must not change ingestion/replay behavior.
  }
}
