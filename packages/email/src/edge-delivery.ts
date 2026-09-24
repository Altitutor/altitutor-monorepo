import type { RenderedEmail } from "./render-email";

type EdgeEmailResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

export type EdgeEmailFetch = (
  url: string,
  init: RequestInit,
) => Promise<EdgeEmailResponse>;

export async function deliverEdgeEmail(input: {
  apiKey: string;
  to: string | string[];
  email: RenderedEmail;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  fetchImpl?: EdgeEmailFetch;
}): Promise<{ providerMessageId: string | null }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey
        ? { "Idempotency-Key": input.idempotencyKey.slice(0, 256) }
        : {}),
    },
    body: JSON.stringify({
      from: input.email.from,
      reply_to: input.email.replyTo,
      to: input.to,
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
      ...(input.headers ? { headers: input.headers } : {}),
      ...(input.tags ? { tags: input.tags } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend ${response.status}: ${await response.text()}`,
    );
  }

  const payload = await response.json() as { id?: unknown };
  return {
    providerMessageId: typeof payload.id === "string" ? payload.id : null,
  };
}
