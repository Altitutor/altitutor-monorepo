import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  UCAT_UNSUBSCRIBE_CONSENT_VERSION,
  UCAT_UNSUBSCRIBE_CONSENT_WORDING,
} from "@/features/communications/lib/communication-preferences";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function htmlResponse(title: string, message: string, status = 200) {
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f2f0e9;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><section style="width:100%;max-width:520px;overflow:hidden;border:1px solid #dce5e8;border-radius:16px;background:#fff"><header style="padding:28px 32px;background:#0a2941;color:#f2f0e9"><strong style="font-size:24px">Altitutor UCAT</strong><div style="margin-top:6px;color:#b9d1d9;font-size:13px">UCAT preparation from Altitutor</div></header><div style="padding:36px 32px"><h1 style="margin:0 0 14px;color:#0a2941;font-size:28px">${title}</h1><p style="margin:0;color:#52606a;line-height:1.7">${message}</p><p style="margin:24px 0 0"><a href="/" style="color:#0a2941;font-weight:700">Return to Altitutor UCAT</a></p></div><footer style="padding:20px 32px;background:#eaf1f3;color:#52606a;font-size:12px">A not-for-profit initiative by Altitutor. Need help? <a href="mailto:admin@altitutor.com" style="color:#0a2941">admin@altitutor.com</a></footer></section></main></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function unsubscribe(token: string, source: "email_link" | "list_unsubscribe_one_click") {
  if (!supabaseAdmin) return { ok: false, status: 503 };
  const now = new Date().toISOString();
  const { data: preference } = await supabaseAdmin
    .from("ucat_communication_preferences")
    .select("student_id, students!inner(user_id, email)")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (preference) {
    const student = Array.isArray(preference.students)
      ? preference.students[0]
      : preference.students;
    const email = student?.email?.trim().toLowerCase();
    const userId = student?.user_id;
    if (!email || !userId) return { ok: false, status: 400 };

    const results = await Promise.all([
      supabaseAdmin.from("ucat_communication_preferences").update({
        weekly_progress_and_guidance: false,
        lessons_and_tips: false,
        product_news: false,
        offers_and_referrals: false,
        updated_at: now,
      }).eq("student_id", preference.student_id),
      supabaseAdmin.from("newsletter_subscribers").update({
        unsubscribed_at: now,
        resend_audience_synced_at: null,
        updated_at: now,
      }).or(`auth_user_id.eq.${userId},student_id.eq.${preference.student_id}`),
      supabaseAdmin.from("ucat_communication_consent_events").insert({
        auth_user_id: userId,
        student_id: preference.student_id,
        email,
        topic: "all_marketing",
        action: "withdrawn",
        source,
        wording_version: UCAT_UNSUBSCRIBE_CONSENT_VERSION,
        wording: UCAT_UNSUBSCRIBE_CONSENT_WORDING,
        occurred_at: now,
      }),
    ]);
    return { ok: !results.some((result) => result.error), status: 200 };
  }

  // Compatibility for links already issued by the original newsletter table.
  const { data: subscriber, error } = await supabaseAdmin
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: now, resend_audience_synced_at: null, updated_at: now })
    .eq("unsubscribe_token", token)
    .select("id")
    .maybeSingle();
  return { ok: !error && Boolean(subscriber), status: error ? 500 : subscriber ? 200 : 400 };
}

function tokenFrom(request: NextRequest): string | null {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  return token && UUID_PATTERN.test(token) ? token : null;
}

export async function GET(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token) return htmlResponse("Invalid unsubscribe link", "This unsubscribe link is invalid.", 400);
  const result = await unsubscribe(token, "email_link");
  if (!result.ok) {
    return htmlResponse(
      result.status === 400 ? "Invalid unsubscribe link" : "Unsubscribe unavailable",
      result.status === 400 ? "This unsubscribe link is invalid or expired." : "Please contact admin@altitutor.com and we will help.",
      result.status,
    );
  }
  return htmlResponse("You’re unsubscribed", "You will no longer receive optional Altitutor UCAT marketing emails. Account, security, billing and access emails are unaffected.");
}

// RFC 8058 one-click endpoint used by inbox providers. It intentionally returns
// an empty success response and does not require cookies or a signed-in session.
export async function POST(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token) return new NextResponse(null, { status: 400 });
  const result = await unsubscribe(token, "list_unsubscribe_one_click");
  return new NextResponse(null, { status: result.ok ? 200 : result.status });
}
