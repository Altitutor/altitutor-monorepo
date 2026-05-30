import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function htmlResponse(title: string, message: string, status = 200) {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; background: #1a1a1a; color: #f8f0df; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { max-width: 480px; text-align: center; }
      h1 { margin: 0 0 12px; font-size: 32px; }
      p { margin: 0; color: rgba(248, 240, 223, 0.72); line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${title}</h1>
        <p>${message}</p>
      </section>
    </main>
  </body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return htmlResponse(
      "Unsubscribe unavailable",
      "Please contact support and we will unsubscribe you.",
      500,
    );
  }

  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token || !UUID_PATTERN.test(token)) {
    return htmlResponse(
      "Invalid unsubscribe link",
      "This unsubscribe link is invalid or expired.",
      400,
    );
  }

  const { error } = await supabaseAdmin
    .from("newsletter_subscribers")
    .update({
      unsubscribed_at: new Date().toISOString(),
      resend_audience_synced_at: null,
    })
    .eq("unsubscribe_token", token);

  if (error) {
    console.error("[newsletter unsubscribe] Failed to unsubscribe:", error);
    return htmlResponse(
      "Unsubscribe unavailable",
      "Please contact support and we will unsubscribe you.",
      500,
    );
  }

  return htmlResponse(
    "You are unsubscribed",
    "You will no longer receive Altitutor UCAT newsletter emails.",
  );
}
