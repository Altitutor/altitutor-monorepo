import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  firstString,
  isRecord,
  parseAppleService,
  type ParsedIMessageEvent,
} from "../_shared/imessage.ts";

type DeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";

const STATUS_PREDECESSORS: Record<DeliveryStatus, string[]> = {
  SENT: ["QUEUED", "SENDING", "FAILED", "AMBIGUOUS", "SENT"],
  DELIVERED: [
    "QUEUED",
    "SENDING",
    "FAILED",
    "AMBIGUOUS",
    "SENT",
    "DELIVERED",
  ],
  READ: [
    "QUEUED",
    "SENDING",
    "FAILED",
    "AMBIGUOUS",
    "SENT",
    "DELIVERED",
    "READ",
  ],
  FAILED: ["QUEUED", "SENDING", "SENT", "AMBIGUOUS", "FAILED"],
};

function eventData(event: ParsedIMessageEvent): Record<string, unknown> {
  const rawPayload = isRecord(event.payload.RawPayload)
    ? event.payload.RawPayload
    : isRecord(event.payload.rawPayload)
    ? event.payload.rawPayload
    : null;
  return rawPayload && isRecord(rawPayload.data) ? rawPayload.data : {};
}

function dateValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      const milliseconds = value < 10_000_000_000 ? value * 1_000 : value;
      const parsed = new Date(milliseconds);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  return null;
}

function errorCode(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function deliveryStatus(
  event: ParsedIMessageEvent,
  data: Record<string, unknown>,
): DeliveryStatus {
  const state = firstString(
    event.payload.DeliveryState,
    event.payload.deliveryState,
    data.DeliveryState,
    data.deliveryState,
    data.status,
  )?.toLowerCase();
  if (
    state === "read" || event.payload.IsRead === true ||
    event.payload.isRead === true || data.IsRead === true ||
    data.isRead === true ||
    dateValue(
      event.payload.DateRead,
      event.payload.dateRead,
      data.DateRead,
      data.dateRead,
    )
  ) return "READ";
  if (
    state === "delivered" ||
    dateValue(
      event.payload.DateDelivered,
      event.payload.dateDelivered,
      data.DateDelivered,
      data.dateDelivered,
    )
  ) return "DELIVERED";
  if (state === "failed" || state === "error") return "FAILED";
  return "SENT";
}

/**
 * Applies a provider delivery observation to an existing canonical message.
 * A delivery event never has enough identity to create a contact, conversation,
 * or message; an unknown GUID is therefore a durable, harmless no-op.
 */
export async function updateMessageFromDeliveryEvent(
  supabase: SupabaseClient,
  event: ParsedIMessageEvent,
  now: () => string = () => new Date().toISOString(),
): Promise<void> {
  if (!event.guid && !event.tempGuid) return;

  const data = eventData(event);
  const status = deliveryStatus(event, data);
  const deliveredAt = dateValue(
    event.payload.DateDelivered,
    event.payload.dateDelivered,
    data.DateDelivered,
    data.dateDelivered,
  );
  const readAt = dateValue(
    event.payload.DateRead,
    event.payload.dateRead,
    data.DateRead,
    data.dateRead,
  );
  const eventAt = dateValue(
    event.payload.Date,
    event.payload.date,
    event.payload.timestamp,
    data.Date,
    data.date,
    data.timestamp,
  );
  const observedAt = readAt ?? deliveredAt ?? eventAt ?? now();
  const values: Record<string, unknown> = {
    status,
    status_updated_at: observedAt,
    ...(deliveredAt ? { delivered_at: deliveredAt } : {}),
    ...(readAt ? { read_at: readAt } : {}),
  };
  if (status === "FAILED") {
    values.provider_error_at = observedAt;
    values.provider_error_code = errorCode(
      event.payload.ErrorCode,
      event.payload.errorCode,
      event.payload.code,
      data.ErrorCode,
      data.errorCode,
      data.code,
    );
    values.error_message = firstString(
      event.payload.error,
      event.payload.message,
      data.error,
      data.message,
    ) ?? "iMessage delivery failed";
  }

  let statusQuery = supabase.from("messages").update(values);
  statusQuery = event.guid
    ? statusQuery.eq("imessage_guid", event.guid)
    : statusQuery.eq("imessage_temp_guid", event.tempGuid);
  const { error } = await statusQuery.in(
    "status",
    STATUS_PREDECESSORS[status],
  );
  if (error) throw error;

  const incomingAppleService = parseAppleService({
    service: firstString(
      event.payload.Service,
      event.payload.service,
      data.Service,
      data.service,
    ),
    chatGuid: firstString(
      event.payload.ChatGuid,
      event.payload.chatGuid,
      data.ChatGuid,
      data.chatGuid,
    ),
  });
  if (!incomingAppleService) return;

  let serviceQuery = supabase.from("messages").update({
    apple_service: incomingAppleService,
  });
  serviceQuery = event.guid
    ? serviceQuery.eq("imessage_guid", event.guid)
    : serviceQuery.eq("imessage_temp_guid", event.tempGuid);
  const { error: serviceError } = await serviceQuery.is("apple_service", null);
  if (serviceError) throw serviceError;
}
