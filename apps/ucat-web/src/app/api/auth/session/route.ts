import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          email: user.email ?? null,
        }
      : null,
  });
}
