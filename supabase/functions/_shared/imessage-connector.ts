import { firstString, isRecord } from "./imessage.ts";

export type ConnectorOutcome = "succeeded" | "failed" | "ambiguous";
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface NormalizedHeartbeat {
  status: "healthy" | "degraded";
  capabilities: string[];
  metrics: Record<string, number | boolean>;
}

export function connectorOutcome(value: unknown): ConnectorOutcome | null {
  return value === "succeeded" || value === "failed" || value === "ambiguous"
    ? value
    : null;
}

export function normalizeCompletionResult(
  value: unknown,
): Record<string, JsonValue> {
  if (value === undefined || value === null) return {};
  if (!isJsonValue(value)) throw new Error("result must be valid JSON");
  if (!isRecord(value)) return { value };

  const message = isRecord(value.message) ? value.message : null;
  const guid = firstString(
    value.guid,
    value.messageGuid,
    message?.guid,
    message?.messageGuid,
  );
  const tempGuid = firstString(value.tempGuid, message?.tempGuid);
  const messageId = stringOrNumber(value.messageId ?? message?.id);
  const chatGuid = firstString(value.chatGuid, message?.chatGuid);
  const sentAt = isoTimestamp(value.sentAt ?? message?.date);
  const errorCode = stringOrNumber(value.errorCode ?? message?.errorCode);

  return {
    ...value,
    ...(guid ? { guid } : {}),
    ...(tempGuid ? { tempGuid } : {}),
    ...(messageId ? { messageId } : {}),
    ...(chatGuid ? { chatGuid } : {}),
    ...(sentAt ? { sentAt } : {}),
    ...(errorCode ? { errorCode } : {}),
  };
}

export function normalizeHeartbeatStatus(value: unknown): NormalizedHeartbeat {
  if (!isRecord(value)) throw new Error("status must be an object");
  const bluebubblesConnected = requiredBoolean(value, "bluebubblesConnected");
  const privateApiConnected = requiredBoolean(value, "privateApiConnected");
  const webhookRegistered = requiredBoolean(value, "webhookRegistered");
  if (!isRecord(value.outbox)) {
    throw new Error("status.outbox must be an object");
  }

  const pending = nonNegativeInteger(
    value.outbox.pending,
    "status.outbox.pending",
  );
  const delivering = nonNegativeInteger(
    value.outbox.delivering,
    "status.outbox.delivering",
  );
  const delivered = nonNegativeInteger(
    value.outbox.delivered,
    "status.outbox.delivered",
  );
  const dead = nonNegativeInteger(value.outbox.dead, "status.outbox.dead");
  const lastForwardedAt = nullableTimestamp(
    value.lastForwardedAt,
    "lastForwardedAt",
  );
  const lastReconciledAt = nullableTimestamp(
    value.lastReconciledAt,
    "lastReconciledAt",
  );

  const capabilities = [
    ...(bluebubblesConnected ? ["bluebubbles"] : []),
    ...(privateApiConnected ? ["private-api"] : []),
    ...(webhookRegistered ? ["webhook"] : []),
  ];
  return {
    status: bluebubblesConnected && privateApiConnected && webhookRegistered
      ? "healthy"
      : "degraded",
    capabilities,
    metrics: {
      bluebubblesConnected,
      privateApiConnected,
      webhookRegistered,
      outboxPending: pending,
      outboxDelivering: delivering,
      outboxDelivered: delivered,
      outboxDead: dead,
      ...(lastForwardedAt === null ? {} : { lastForwardedAt }),
      ...(lastReconciledAt === null ? {} : { lastReconciledAt }),
    },
  };
}

function requiredBoolean(value: Record<string, unknown>, key: string): boolean {
  if (typeof value[key] !== "boolean") {
    throw new Error(`status.${key} must be a boolean`);
  }
  return value[key];
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function nullableTimestamp(value: unknown, name: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`status.${name} must be a timestamp or null`);
  }
  return value;
}

function stringOrNumber(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function isoTimestamp(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return new Date(value).toISOString();
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}
