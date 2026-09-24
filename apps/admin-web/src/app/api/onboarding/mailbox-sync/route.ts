import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/shared/lib/supabase/server-ssr";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";
import { syncOnboardingMailbox } from "@/features/onboarding/server/mailbox-sync";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = secret ? `Bearer ${secret}` : "";
  const cron = Boolean(
    expected &&
      supplied.length === expected.length &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)),
  );
  if (!cron) {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error } = await db.rpc("is_adminstaff_active");
    if (error || !data)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getServerSupabaseAdmin();
  if (!db)
    return NextResponse.json(
      { error: "Server configuration unavailable" },
      { status: 503 },
    );
  try {
    return NextResponse.json(await syncOnboardingMailbox(db));
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Mailbox synchronization failed.",
      },
      { status: 503 },
    );
  }
}
export const GET = POST;
