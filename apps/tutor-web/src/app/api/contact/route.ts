import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { buildContactRequestEmail } from "@altitutor/email";
import { deliverEmail } from "@altitutor/email/node";

type ContactBody = {
  appName?: string;
  message?: string;
  user?: { name?: string | null; email?: string | null; id?: string | null };
  diagnostics?: Record<string, unknown>;
};

async function sendContactEmail(body: ContactBody) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  await deliverEmail({
    apiKey,
    to: "admin@altitutor.com",
    email: buildContactRequestEmail({
      appName: body.appName ?? "tutor-web",
      message: body.message ?? "",
      user: body.user,
      diagnostics: body.diagnostics,
    }),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ContactBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  try {
    await sendContactEmail(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureApiError(error, "/api/contact");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 },
    );
  }
}
