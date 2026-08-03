import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@altitutor/shared";
import {
  buildStudentCalendarFeed,
  type CalendarSession,
  type CalendarSessionStatus,
} from "@/features/calendar/lib/calendar-feed";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionType = Database["public"]["Enums"]["session_type"];
type CalendarSessionQueryRow = {
  session: {
    id: string;
    type: SessionType;
    class_id: string | null;
    start_at: string | null;
    end_at: string | null;
    updated_at: string | null;
    status: string;
    subject: { long_name: string | null; name: string | null } | null;
  } | null;
};

function toCalendarSessionStatus(
  status: string,
): CalendarSessionStatus | null {
  if (status === "ACTIVE" || status === "INACTIVE") return status;
  return null;
}

function getStudentBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_STUDENT_URL || request.nextUrl.origin
  ).replace(/\/$/, "");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!UUID_PATTERN.test(params.token)) {
    return new NextResponse("Calendar not found", { status: 404 });
  }

  const admin = getServerSupabaseAdmin();
  const { data: subscription, error: subscriptionError } = await admin
    .from("student_calendar_subscriptions")
    .select("student_id")
    .eq("token", params.token)
    .maybeSingle();

  if (subscriptionError) {
    console.error(
      "Failed to read student calendar subscription:",
      subscriptionError,
    );
    return new NextResponse("Could not load calendar", { status: 500 });
  }

  if (!subscription) {
    return new NextResponse("Calendar not found", { status: 404 });
  }

  // Include ACTIVE sessions plus recently cancelled ones so clients receive
  // STATUS:CANCELLED tombstones (silent omission alone leaves ghost events).
  const { data, error } = await admin
    .from("sessions_students")
    .select(
      "session:sessions!inner(id,type,class_id,start_at,end_at,updated_at,status,subject:subjects(long_name,name))",
    )
    .eq("student_id", subscription.student_id)
    .eq("is_rescheduled", false)
    .in("session.status", ["ACTIVE", "INACTIVE"])
    .order("start_at", { referencedTable: "sessions", ascending: true });

  if (error) {
    console.error("Failed to load student calendar sessions:", error);
    return new NextResponse("Could not load calendar", { status: 500 });
  }

  const sessions = ((data || []) as unknown as CalendarSessionQueryRow[])
    .map((row): CalendarSession | null => {
      const session = row.session;
      if (!session?.start_at || !session.end_at) return null;
      const status = toCalendarSessionStatus(session.status);
      if (!status) return null;

      return {
        id: session.id,
        type: session.type,
        classId: session.class_id,
        startAt: session.start_at,
        endAt: session.end_at,
        updatedAt: session.updated_at,
        status,
        subjectLongName: session.subject?.long_name || null,
        subjectName: session.subject?.name || null,
      };
    })
    .filter((session): session is CalendarSession => session !== null);

  const feed = buildStudentCalendarFeed(sessions, getStudentBaseUrl(request));
  const etag = `"${createHash("sha256").update(feed).digest("base64url")}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "private, no-cache" },
    });
  }

  return new NextResponse(feed, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="altitutor-timetable.ics"',
      "Cache-Control": "private, no-cache",
      ETag: etag,
    },
  });
}
