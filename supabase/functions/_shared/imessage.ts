export const IMESSAGE_COMMAND_TYPES = [
  "send_message",
  "edit_message",
  "unsend_message",
  "react",
  "mark_chat_read",
  "mark_chat_unread",
  "create_chat",
  "update_chat",
  "delete_chat",
  "leave_chat",
  "add_participant",
  "remove_participant",
  "set_group_icon",
  "remove_group_icon",
  "delete_message",
  "restart_messages_app",
  "mark_alerts_read",
] as const;

export type IMessageCommandType = typeof IMESSAGE_COMMAND_TYPES[number];
export type IMessageMessageStatus =
  | "QUEUED"
  | "SENDING"
  | "AMBIGUOUS"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "RECEIVED"
  | "UNDELIVERED"
  | "FAILED";
export type IMessageEventType =
  | "new-message"
  | "reconciliation-message"
  | "message-send-error"
  | "delivery"
  | "group-name-changed"
  | "participant-added"
  | "participant-removed"
  | "typing"
  | "read"
  | "server"
  | "system";

export interface ParsedIMessageEvent {
  eventType: IMessageEventType;
  sourceEventType: string;
  eventKey: string;
  guid: string | null;
  tempGuid: string | null;
  connectorId: string | null;
  payload: Record<string, unknown>;
}

const DESTRUCTIVE_COMMANDS = new Set<IMessageCommandType>([
  "unsend_message",
  "delete_chat",
  "leave_chat",
  "remove_participant",
  "remove_group_icon",
  "delete_message",
  "restart_messages_app",
]);

const EVENT_ALIASES: Record<string, IMessageEventType> = {
  "new-message": "new-message",
  "message": "new-message",
  "reconciliation-message": "reconciliation-message",
  "message-send-error": "message-send-error",
  "send-error": "message-send-error",
  "updated-message": "delivery",
  "delivery": "delivery",
  "delivered": "delivery",
  "delivery-status": "delivery",
  "group-name-change": "group-name-changed",
  "group-name-changed": "group-name-changed",
  "participant-added": "participant-added",
  "participant-removed": "participant-removed",
  "participant-left": "participant-removed",
  "typing": "typing",
  "typing-indicator": "typing",
  "chat-read-status-changed": "read",
  "read": "read",
  "read-receipt": "read",
  "server-update": "server",
  "server-url-change": "server",
  "hello-world": "server",
  "server": "server",
  "server-event": "server",
};

export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const maxLength = Math.max(aBytes.length, bBytes.length);
  let mismatch = aBytes.length ^ bBytes.length;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (aBytes[index] ?? 0) ^ (bBytes[index] ?? 0);
  }
  return mismatch === 0;
}

export function bearerToken(header: string | null): string {
  if (!header?.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length);
}

export function authenticateBearer(
  header: string | null,
  expectedSecret: string,
): boolean {
  return expectedSecret.length > 0 &&
    timingSafeEqual(bearerToken(header), expectedSecret);
}

export function validateCommandRequest(value: unknown): {
  commandType: IMessageCommandType;
  messageId: string | null;
  conversationId: string | null;
  payload: Record<string, unknown>;
  reason: string | null;
  idempotencyKey: string | null;
} {
  if (!isRecord(value)) throw new Error("Request body must be an object");
  const commandType = value.commandType;
  if (typeof commandType !== "string" || !isCommandType(commandType)) {
    throw new Error("Unsupported commandType");
  }
  const messageId = optionalString(value.messageId, "messageId");
  const conversationId = optionalString(value.conversationId, "conversationId");
  const payload = value.payload === undefined ? {} : value.payload;
  if (!isRecord(payload)) throw new Error("payload must be an object");
  const reason = optionalString(value.reason, "reason");
  const idempotencyKey = optionalString(value.idempotencyKey, "idempotencyKey");

  if (
    ["send_message", "edit_message", "unsend_message", "delete_message"]
      .includes(commandType) &&
    !messageId
  ) {
    throw new Error(`${commandType} requires messageId`);
  }
  if (
    [
      "mark_chat_read",
      "mark_chat_unread",
      "update_chat",
      "delete_chat",
      "leave_chat",
      "add_participant",
      "remove_participant",
      "set_group_icon",
      "remove_group_icon",
    ].includes(commandType) &&
    !conversationId
  ) {
    throw new Error(`${commandType} requires conversationId`);
  }
  if (
    commandType === "react" &&
    (!messageId || typeof payload.reaction !== "string")
  ) {
    throw new Error("react requires messageId and payload.reaction");
  }
  if (
    (commandType === "add_participant" ||
      commandType === "remove_participant") &&
    typeof payload.participant !== "string"
  ) {
    throw new Error(`${commandType} requires payload.participant`);
  }
  if (DESTRUCTIVE_COMMANDS.has(commandType) && !reason?.trim()) {
    throw new Error("A reason is required for destructive commands");
  }
  return {
    commandType,
    messageId,
    conversationId,
    payload,
    reason,
    idempotencyKey,
  };
}

export function parseIMessageEvent(value: unknown): ParsedIMessageEvent {
  if (!isRecord(value)) throw new Error("Event must be an object");
  const rawType = firstString(value.eventType, value.type, value.EventType) ??
    "new-message";
  const sourceEventType = rawType.toLowerCase();
  const eventType = EVENT_ALIASES[sourceEventType] ?? "system";
  const guid = firstString(value.guid, value.messageGuid, value.MessageGuid);
  const tempGuid = firstString(
    value.tempGuid,
    value.TempGuid,
    value.correlation,
  );
  const connectorId = firstString(value.connectorId, value.ConnectorId);
  const explicitKey = firstString(value.eventId, value.EventId, value.id);
  const identity = guid ?? tempGuid ?? stableEventFingerprint(value);
  const eventVersion = eventVersionFingerprint(eventType, value);
  const eventKey = explicitKey ?? [
    connectorId ?? "mac",
    sourceEventType,
    identity,
    eventVersion,
  ].filter(Boolean).join(":");
  return {
    eventType,
    sourceEventType,
    eventKey,
    guid,
    tempGuid,
    connectorId,
    payload: value,
  };
}

export function extractChatIdentifier(chatGuid: unknown): string | null {
  if (typeof chatGuid !== "string" || !chatGuid.trim()) return null;
  const parts = chatGuid.split(";");
  return (parts.at(-1) ?? chatGuid).trim() || null;
}

export function statusRank(status: IMessageMessageStatus): number {
  switch (status) {
    case "QUEUED":
      return 0;
    case "SENDING":
      return 1;
    case "AMBIGUOUS":
      return 2;
    case "SENT":
      return 3;
    case "DELIVERED":
      return 4;
    case "READ":
      return 5;
    case "RECEIVED":
      return 5;
    case "UNDELIVERED":
      return 2;
    case "FAILED":
      return 2;
    default:
      return assertNever(status);
  }
}

export function monotonicStatus(
  current: string,
  incoming: IMessageMessageStatus,
): IMessageMessageStatus {
  if (!isMessageStatus(current)) {
    throw new Error(`Unsupported message status: ${current}`);
  }
  if (incoming === "FAILED") {
    return current === "DELIVERED" || current === "READ" ? current : "FAILED";
  }
  if (current === "FAILED" && incoming === "SENT") return "FAILED";
  return statusRank(incoming) >= statusRank(current) ? incoming : current;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function optionalString(value: unknown, name: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function isCommandType(value: string): value is IMessageCommandType {
  return (IMESSAGE_COMMAND_TYPES as readonly string[]).includes(value);
}

function isMessageStatus(value: string): value is IMessageMessageStatus {
  return [
    "QUEUED",
    "SENDING",
    "AMBIGUOUS",
    "SENT",
    "DELIVERED",
    "READ",
    "RECEIVED",
    "UNDELIVERED",
    "FAILED",
  ].includes(value);
}

function eventVersionFingerprint(
  eventType: IMessageEventType,
  value: Record<string, unknown>,
): string | null {
  if (
    eventType !== "delivery" &&
    eventType !== "read" &&
    eventType !== "message-send-error"
  ) {
    return null;
  }
  const version = {
    DeliveryState: value.DeliveryState ?? value.deliveryState,
    Date: value.Date ?? value.date,
    DateDelivered: value.DateDelivered ?? value.dateDelivered,
    DateRead: value.DateRead ?? value.dateRead,
    ErrorCode: value.ErrorCode ?? value.errorCode,
    Body: value.Body ?? value.body ?? value.text,
    EditTimestamp: value.EditTimestamp ?? value.editTimestamp ??
      value.DateEdited ?? value.dateEdited,
    RawPayload: value.RawPayload ?? value.rawPayload,
  };
  return stableEventFingerprint(version);
}

function stableEventFingerprint(value: Record<string, unknown>): string {
  const serialized = canonicalJson(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${
      Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${canonicalJson(value[key])}`
      ).join(",")
    }}`;
  }
  return JSON.stringify(value) ?? "null";
}
