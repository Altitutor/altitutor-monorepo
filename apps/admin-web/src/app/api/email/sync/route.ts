import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { emailAccess } from "@/features/email/server/auth";
import { syncMailbox } from "@/features/email/server/sync";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(secret ? `Bearer ${secret}` : "");
  const cron =
    expected.length > 0 &&
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected);
  const access = cron ? null : await emailAccess();
  if (access && "error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const db = cron
    ? getServerSupabaseAdmin()
    : access && "admin" in access
      ? access.admin
      : null;
  if (!db)
    return NextResponse.json(
      { error: "Server configuration unavailable." },
      { status: 503 },
    );
  try {
    return NextResponse.json(await syncMailbox(db));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mailbox synchronization failed.",
      },
      { status: 503 },
    );
  }
}
export const GET = POST;
