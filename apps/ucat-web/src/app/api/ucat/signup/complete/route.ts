import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/ucat/signup/complete
 * Called from the signup flow page after email confirmation.
 * Creates (or updates) the student record for the authenticated user.
 */
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { firstName: string; lastName: string; phone?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const phone = body.phone?.trim() || null;

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 },
    );
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  // Check if a student record already exists for this user
  const { data: existing } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from("students")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
  } else {
    // Check if a student with this email already exists (e.g. from invite)
    const { data: byEmail } = await supabaseAdmin
      .from("students")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (byEmail) {
      const { error: linkError } = await supabaseAdmin
        .from("students")
        .update({
          user_id: user.id,
          first_name: firstName,
          last_name: lastName,
          phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", byEmail.id);

      if (linkError) {
        return NextResponse.json({ error: "Failed to link profile" }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabaseAdmin.from("students").insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        status: "ACTIVE",
        timezone: "Australia/Adelaide",
      });

      if (insertError) {
        console.error("[signup complete] Failed to create student:", insertError);
        return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
      }
    }
  }

  // Sync name to Supabase auth metadata
  await supabase.auth.updateUser({
    data: { first_name: firstName, last_name: lastName },
  });

  return NextResponse.json({ success: true });
}
