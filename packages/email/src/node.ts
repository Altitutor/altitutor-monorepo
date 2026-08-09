import type { RenderedEmail } from "./render-email";

type EmailFetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

export type EmailFetch = (
  url: string,
  init: RequestInit,
) => Promise<EmailFetchResponse>;

export type EmailAttachment = {
  filename: string;
  content: Uint8Array;
  contentType?: string;
};

export async function deliverEmail(input: {
  apiKey: string;
  to: string | string[];
  email: RenderedEmail;
  attachments?: EmailAttachment[];
  idempotencyKey?: string;
  fetchImpl?: EmailFetch;
}): Promise<void> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey
        ? { "Idempotency-Key": input.idempotencyKey }
        : {}),
    },
    body: JSON.stringify({
      from: input.email.from,
      reply_to: input.email.replyTo,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.content).toString("base64"),
        ...(attachment.contentType
          ? { content_type: attachment.contentType }
          : {}),
      })),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      details || `Email provider returned HTTP ${response.status}`,
    );
  }
}
