import "server-only";
import { getMailboxPolicy } from "./config";
import { randomUUID } from "node:crypto";
import {
  deliverOperationalMailboxEmail,
  type OperationalMailLink,
  type RenderedEmail,
} from "@altitutor/email";
import type { EmailAttachment } from "@altitutor/email/node";
import { getMailboxAccessToken } from "./connection";
/** Domain callers retain rendering/eligibility; one registry owns submission. */
export async function sendOperationalEmail(input: {
  to: string | string[];
  email: RenderedEmail;
  attachments?: EmailAttachment[];
  idempotencyKey?: string;
  links: OperationalMailLink[];
  actorStaffId: string;
}) {
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceUrl || !serviceKey)
    throw new Error("Mailbox delivery registry is not configured.");
  return deliverOperationalMailboxEmail({
    ...input,
    mailbox: getMailboxPolicy(),
    serviceUrl,
    serviceKey,
    getAccessToken: getMailboxAccessToken,
    to: Array.isArray(input.to) ? input.to : [input.to],
    idempotencyKey: input.idempotencyKey ?? `staff-email/${randomUUID()}`,
    attachments: input.attachments?.map((file) => ({
      name: file.filename,
      contentType: file.contentType ?? "application/octet-stream",
      contentBytes: Buffer.from(file.content).toString("base64"),
    })),
  });
}
