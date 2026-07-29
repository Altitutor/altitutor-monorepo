import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// This endpoint is session-specific. The production-build Supabase placeholder
// has no cookies, so allowing static optimization would bake `{ user: null }`.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json(
    {
      user: user
        ? {
            id: user.id,
            email: user.email ?? null,
          }
        : null,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
