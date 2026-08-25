import { captureApiErrorResponse } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SectionProgressResponse } from "@/features/progress/types/section-progress";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sectionNumber: string }> },
) {
  const { sectionNumber: rawSectionNumber } = await context.params;
  const sectionNumber = Number(rawSectionNumber);
  if (!Number.isInteger(sectionNumber) || sectionNumber < 1 || sectionNumber > 4) {
    return NextResponse.json({ error: "Invalid section number" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rpcClient = supabase as unknown as {
    rpc: (
      name: "get_student_ucat_section_progress_summary",
      params: { p_section_number: number },
    ) => Promise<{
      data: SectionProgressResponse | null;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await rpcClient.rpc(
    "get_student_ucat_section_progress_summary",
    { p_section_number: sectionNumber },
  );
  if (error) {
    return captureApiErrorResponse(
      error,
      "/api/ucat/progress/sections/[sectionNumber]/summary",
      NextResponse.json({ error: error.message }, { status: 500 }),
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
