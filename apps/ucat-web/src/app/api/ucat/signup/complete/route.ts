import { NextRequest, NextResponse } from "next/server";
import { validateOptionalStudentPhone } from "@altitutor/ui";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function phoneUpdateErrorMessage(message: string): string {
  if (message.includes("Invalid phone number format")) {
    return "Please enter a valid Australian mobile number.";
  }
  if (message.includes("already associated with")) {
    return "This phone number is already linked to another account.";
  }
  return "Failed to save your details. Please try again.";
}

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
  const hasPhoneField = Object.prototype.hasOwnProperty.call(body, "phone");

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 },
    );
  }

  let normalizedPhone: string | null | undefined;
  if (hasPhoneField) {
    const phoneResult = validateOptionalStudentPhone(body.phone);
    if (phoneResult.error) {
      return NextResponse.json({ error: phoneResult.error }, { status: 400 });
    }
    normalizedPhone = phoneResult.phone;
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  const profileUpdate: {
    first_name: string;
    last_name: string;
    updated_at: string;
    phone?: string | null;
  } = {
    first_name: firstName,
    last_name: lastName,
    updated_at: new Date().toISOString(),
  };

  if (hasPhoneField) {
    profileUpdate.phone = normalizedPhone ?? null;
  }

  // Check if a student record already exists for this user
  let studentId: string;
  const { data: existing } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from("students")
      .update(profileUpdate)
      .eq("id", existing.id);

    if (updateError) {
      console.error("[signup complete] Failed to update student:", updateError);
      return NextResponse.json(
        { error: phoneUpdateErrorMessage(updateError.message) },
        { status: 400 },
      );
    }
    studentId = existing.id;
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
          ...profileUpdate,
        })
        .eq("id", byEmail.id);

      if (linkError) {
        console.error("[signup complete] Failed to link student:", linkError);
        return NextResponse.json(
          { error: phoneUpdateErrorMessage(linkError.message) },
          { status: 400 },
        );
      }
      studentId = byEmail.id;
    } else {
      const newStudentId = crypto.randomUUID();
      const { error: insertError } = await supabaseAdmin.from("students").insert({
        id: newStudentId,
        user_id: user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone: hasPhoneField ? (normalizedPhone ?? null) : null,
        status: "ACTIVE",
        timezone: "Australia/Adelaide",
      });

      if (insertError) {
        console.error("[signup complete] Failed to create student:", insertError);
        return NextResponse.json(
          { error: phoneUpdateErrorMessage(insertError.message) },
          { status: 400 },
        );
      }
      studentId = newStudentId;
    }
  }

  const { error: newsletterError } = await supabaseAdmin
    .from("newsletter_subscribers")
    .update({
      student_id: studentId,
      updated_at: new Date().toISOString(),
    })
    .ilike("email", email)
    .is("student_id", null);

  if (newsletterError) {
    console.warn(
      "[signup complete] Failed to link newsletter subscriber:",
      newsletterError,
    );
  }

  // Sync name to Supabase auth metadata
  await supabase.auth.updateUser({
    data: { first_name: firstName, last_name: lastName },
  });

  return NextResponse.json({ success: true });
}
