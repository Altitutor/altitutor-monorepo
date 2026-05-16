import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getSupportedIanaTimeZones,
  isSupportedIanaTimeZone,
  mergeTimeZoneIntoOptions,
} from "@/lib/supported-timezones";

const NAME_MAX = 120;

/**
 * GET /api/ucat/profile
 * Returns current student's profile (timezone, name, sign-in email).
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
    .select("id, timezone, first_name, last_name, email")
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
    firstName: student.first_name,
    lastName: student.last_name,
    email: user.email ?? student.email ?? "",
  });
}

/**
 * PATCH /api/ucat/profile
 * Updates timezone and/or first and last name for the current student.
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

  const body = (await request.json()) as {
    timezone?: string;
    firstName?: string;
    lastName?: string;
  };

  const timezoneRaw = body.timezone?.trim();
  const hasTimezone = Boolean(timezoneRaw);
  const firstNameRaw = body.firstName?.trim();
  const lastNameRaw = body.lastName?.trim();
  const hasFirst = Boolean(firstNameRaw);
  const hasLast = Boolean(lastNameRaw);
  const hasAnyName = hasFirst || hasLast;

  if (!hasTimezone && !hasAnyName) {
    return NextResponse.json(
      { error: "Provide timezone and/or first and last name to update" },
      { status: 400 },
    );
  }

  if (hasAnyName && (!firstNameRaw || !lastNameRaw)) {
    return NextResponse.json(
      { error: "firstName and lastName are both required to update your name" },
      { status: 400 },
    );
  }

  if (hasAnyName && firstNameRaw && lastNameRaw) {
    if (firstNameRaw.length > NAME_MAX || lastNameRaw.length > NAME_MAX) {
      return NextResponse.json(
        { error: `Names must be at most ${NAME_MAX} characters` },
        { status: 400 },
      );
    }
  }

  if (hasTimezone && timezoneRaw && !isSupportedIanaTimeZone(timezoneRaw)) {
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

  const updates: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (hasTimezone && timezoneRaw) {
    updates.timezone = timezoneRaw;
  }
  if (hasAnyName && firstNameRaw && lastNameRaw) {
    updates.first_name = firstNameRaw;
    updates.last_name = lastNameRaw;
  }

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update(updates)
    .eq("id", student.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (hasAnyName && firstNameRaw && lastNameRaw) {
    const { error: metaError } = await supabase.auth.updateUser({
      data: { first_name: firstNameRaw, last_name: lastNameRaw },
    });
    if (metaError) {
      return NextResponse.json(
        { error: metaError.message ?? "Failed to sync name to session" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ...(hasTimezone && timezoneRaw ? { timezone: timezoneRaw } : {}),
    ...(hasAnyName && firstNameRaw && lastNameRaw
      ? { firstName: firstNameRaw, lastName: lastNameRaw }
      : {}),
  });
}
