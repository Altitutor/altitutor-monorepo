import { Webhook } from "npm:svix@1.76.1";

export type ResendSignatureHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

/**
 * Verifies the exact raw request body using Resend's Svix signature headers.
 * The library also enforces Svix's timestamp tolerance to reject stale replays.
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: ResendSignatureHeaders,
  webhookSecret: string,
): unknown {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    throw new Error("Missing Resend signature headers");
  }

  const webhook = new Webhook(webhookSecret);
  return webhook.verify(rawBody, {
    "svix-id": headers.id,
    "svix-timestamp": headers.timestamp,
    "svix-signature": headers.signature,
  });
}
