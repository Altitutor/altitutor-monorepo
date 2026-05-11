import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SubscribeRequestBody = {
  email?: unknown;
  source?: unknown;
};

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  let body: SubscribeRequestBody;
  try {
    body = (await request.json()) as SubscribeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 100)
      : "unknown";

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("newsletter_subscribers").upsert(
    {
      email,
      source,
      subscribed_at: now,
      unsubscribed_at: null,
      resend_audience_synced_at: null,
      updated_at: now,
    },
    { onConflict: "email" },
  );

  if (error) {
    console.error("[newsletter subscribe] Failed to save subscriber:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
