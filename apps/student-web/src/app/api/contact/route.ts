import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";

const RESEND_API_URL = "https://api.resend.com/emails";

type ContactBody = {
  appName?: string;
  message?: string;
  user?: { name?: string | null; email?: string | null; id?: string | null };
  diagnostics?: Record<string, unknown>;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendContactEmail(body: ContactBody) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const title = "Contact request";
  const subject = `[${body.appName ?? "student-web"}] ${title}`;
  const html = `
    <h2>${escapeHtml(title)}</h2>
    <p><strong>App:</strong> ${escapeHtml(body.appName ?? "student-web")}</p>
    <p><strong>User:</strong> ${escapeHtml(body.user?.name ?? "Unknown")} (${escapeHtml(body.user?.email ?? "no email")})</p>
    <p><strong>User ID:</strong> ${escapeHtml(body.user?.id ?? "unknown")}</p>
    <h3>Message</h3>
    <p>${escapeHtml(body.message).replace(/\n/g, "<br />")}</p>
    <h3>Diagnostics</h3>
    <pre>${escapeHtml(JSON.stringify(body.diagnostics ?? {}, null, 2))}</pre>
  `;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Altitutor <noreply@altitutor.com>",
      to: ["admin@altitutor.com"],
      subject,
      html,
    }),
  });
  if (!response.ok) throw new Error((await response.text()) || "Failed to send email");
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
