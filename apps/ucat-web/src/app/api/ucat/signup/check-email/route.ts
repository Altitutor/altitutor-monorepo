import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/ucat/signup/check-email
 * Returns whether a UCAT account already exists for the given email.
 */
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailTrimmed = body.email?.trim().toLowerCase();
  if (!emailTrimmed) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const { data: existingStudent } = await supabaseAdmin
    .from("students")
    .select("user_id")
    .ilike("email", emailTrimmed)
    .maybeSingle();

  if (existingStudent?.user_id) {
    return NextResponse.json({ exists: true });
  }

  const { data: authLink, error: authLinkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: emailTrimmed,
    });

  const authUserExists = !authLinkError && Boolean(authLink?.user);

  return NextResponse.json({ exists: authUserExists });
}
