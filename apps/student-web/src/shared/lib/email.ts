import type { RenderedEmail } from "@altitutor/email";
import { deliverEmail } from "@altitutor/email/node";

export async function sendEmail(input: {
  to: string | string[];
  email: RenderedEmail;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  await deliverEmail({ apiKey, ...input });
}
