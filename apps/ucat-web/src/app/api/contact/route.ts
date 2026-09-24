import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { buildContactRequestEmail } from "@altitutor/email";
import { deliverEmail } from "@altitutor/email/node";

type ContactBody = {
  appName?: string;
  message?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    id?: string | null;
  };
  contact?: {
    email?: string | null;
    phone?: string | null;
  };
  diagnostics?: Record<string, unknown>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

async function sendContactEmail(body: ContactBody) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const contactEmail =
    body.contact?.email?.trim().toLowerCase() ||
    body.user?.email?.trim().toLowerCase() ||
    null;
  const contactPhone = body.contact?.phone?.trim() || null;

  await deliverEmail({
    apiKey,
    to: "admin@altitutor.com",
    email: buildContactRequestEmail({
      appName: body.appName ?? "ucat-web",
      message: body.message ?? "",
      user: body.user,
      contact: { email: contactEmail, phone: contactPhone },
      diagnostics: body.diagnostics,
    }),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ContactBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  const email =
    body.contact?.email?.trim().toLowerCase() ||
    body.user?.email?.trim().toLowerCase() ||
    "";
  const phone = body.contact?.phone?.trim() ?? "";
  if (email && (!EMAIL_PATTERN.test(email) || email.length > 254)) {
    return NextResponse.json(
      { error: "A valid contact email is required" },
      { status: 400 },
    );
  }
  if (phone && !E164_PATTERN.test(phone)) {
    return NextResponse.json(
      { error: "Phone number must be a valid international number" },
      { status: 400 },
    );
  }
  body.contact = { email, phone: phone || null };

  try {
    await sendContactEmail(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureApiError(error, "/api/contact");
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send message",
      },
      { status: 500 },
    );
  }
}
