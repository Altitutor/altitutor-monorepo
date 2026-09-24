export const TRACKED_RESEND_EVENT_TYPES = [
  "email.delivered",
  "email.delivery_delayed",
  "email.failed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
  "email.clicked",
  "email.opened",
] as const;

export type TrackedResendEventType = typeof TRACKED_RESEND_EVENT_TYPES[number];

export type TrackedResendEvent = {
  type: TrackedResendEventType;
  occurredAt: string;
  providerMessageId: string;
  recipientEmail: string | null;
  metadata: Record<string, string>;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isTrackedResendEventType(
  value: string,
): value is TrackedResendEventType {
  return (TRACKED_RESEND_EVENT_TYPES as readonly string[]).includes(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstRecipient(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const recipient = value.find((item) =>
    typeof item === "string" && item.trim()
  );
  return typeof recipient === "string" ? recipient.trim().toLowerCase() : null;
}

function safeClickHost(data: UnknownRecord): string | null {
  if (!isRecord(data.click)) return null;
  const link = optionalString(data.click.link);
  if (!link) return null;

  try {
    const url = new URL(link);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.host
      : null;
  } catch {
    return null;
  }
}

function safeTags(data: UnknownRecord): Record<string, string> {
  if (!isRecord(data.tags)) return {};
  const metadata: Record<string, string> = {};
  for (const key of ["product", "category", "template", "campaign", "topic"]) {
    const tag = optionalString(data.tags[key]);
    if (tag) metadata[`tag_${key}`] = tag.slice(0, 256);
  }
  return metadata;
}

/**
 * Parses only the fields needed for delivery attribution. A small allowlist of
 * campaign tags is retained; subject, sender and complete click URLs are not.
 */
export function parseTrackedResendEvent(
  value: unknown,
): TrackedResendEvent | null {
  if (!isRecord(value)) throw new Error("Webhook payload must be an object");

  const type = optionalString(value.type);
  if (!type) throw new Error("Webhook event type is required");
  if (!isTrackedResendEventType(type)) return null;

  const occurredAt = optionalString(value.created_at);
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) {
    throw new Error("Webhook event timestamp is invalid");
  }
  if (!isRecord(value.data)) throw new Error("Webhook event data is required");

  const providerMessageId = optionalString(value.data.email_id);
  if (!providerMessageId) throw new Error("Webhook email ID is required");

  const metadata: Record<string, string> = safeTags(value.data);
  const clickHost = type === "email.clicked" ? safeClickHost(value.data) : null;
  if (clickHost) metadata.click_host = clickHost;

  return {
    type,
    occurredAt: new Date(occurredAt).toISOString(),
    providerMessageId,
    recipientEmail: firstRecipient(value.data.to),
    metadata,
  };
}

export function posthogEventName(
  type: TrackedResendEventType,
): "email delivered" | "email clicked" | null {
  if (type === "email.delivered") return "email delivered";
  if (type === "email.clicked") return "email clicked";
  return null;
}
