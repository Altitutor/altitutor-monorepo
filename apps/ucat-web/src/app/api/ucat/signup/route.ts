import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/ucat/signup
 * Creates a new UCAT student account (auth user + student record).
 * Used for self-serve signup before checkout.
 */
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  let body: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password, firstName, lastName } = body;
  const emailTrimmed = email?.trim().toLowerCase();
  const firstNameTrimmed = firstName?.trim();
  const lastNameTrimmed = lastName?.trim();

  if (!emailTrimmed || !password || !firstNameTrimmed || !lastNameTrimmed) {
    return NextResponse.json(
      { error: "Email, password, first name, and last name are required" },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  // Check for existing student with this email (may have user_id from invite flow)
  const { data: existingStudent } = await supabaseAdmin
    .from("students")
    .select("id, user_id")
    .ilike("email", emailTrimmed)
    .maybeSingle();

  if (existingStudent?.user_id) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please log in." },
      { status: 400 },
    );
  }

  try {
    const { data: authData, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailTrimmed,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstNameTrimmed,
          last_name: lastNameTrimmed,
        },
      });

    if (createAuthError) {
      if (createAuthError.message.includes("already been registered")) {
        return NextResponse.json(
          {
            error: "An account with this email already exists. Please log in.",
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: createAuthError.message },
        { status: 400 },
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 },
      );
    }

    const userId = authData.user.id;

    if (existingStudent) {
      // Link existing student (e.g. from invite) to new auth user
      const { error: updateError } = await supabaseAdmin
        .from("students")
        .update({
          user_id: userId,
          email: emailTrimmed,
          first_name: firstNameTrimmed,
          last_name: lastNameTrimmed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingStudent.id);

      if (updateError) {
        console.error(
          "[ucat signup] Failed to link existing student:",
          updateError,
        );
        return NextResponse.json(
          { error: "Failed to complete registration" },
          { status: 500 },
        );
      }
    } else {
      // Create new student record
      const { error: insertError } = await supabaseAdmin
        .from("students")
        .insert({
          id: crypto.randomUUID(),
          user_id: userId,
          email: emailTrimmed,
          first_name: firstNameTrimmed,
          last_name: lastNameTrimmed,
          status: "ACTIVE",
          timezone: "Australia/Adelaide",
        });

      if (insertError) {
        console.error("[ucat signup] Failed to create student:", insertError);
        return NextResponse.json(
          { error: "Failed to complete registration" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat signup] Error:", msg);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}
