import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getSupportedIanaTimeZones,
  isSupportedIanaTimeZone,
  mergeTimeZoneIntoOptions,
} from "@/lib/supported-timezones";

/**
 * GET /api/ucat/profile
 * Returns current student's profile (timezone).
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 },
    );
  }

  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const timezone = student.timezone ?? "Australia/Adelaide";
  const timezoneOptions = mergeTimeZoneIntoOptions(timezone, getSupportedIanaTimeZones());

  return NextResponse.json({
    timezone,
    timezoneOptions,
  });
}

/**
 * PATCH /api/ucat/profile
 * Updates current student's timezone.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as { timezone?: string };
  const timezone = body.timezone?.trim();

  if (!timezone) {
    return NextResponse.json(
      { error: "timezone is required" },
      { status: 400 },
    );
  }

  if (!isSupportedIanaTimeZone(timezone)) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json(
      { error: "Failed to resolve student" },
      { status: 500 },
    );
  }

  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update({ timezone })
    .eq("id", student.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ timezone });
}
