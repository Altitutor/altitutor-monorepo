import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStudyPlan, saveStudyPlanProfile } from "@/features/study-plan/server/study-plan-service";
import { parseStudyPlanProfileInput } from "@/features/study-plan/lib/validation";

async function authenticatedClient() {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error("Failed to get user.");
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await getStudyPlan(supabase, user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Study plan." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const input = parseStudyPlanProfileInput(await request.json());
    return NextResponse.json(await saveStudyPlanProfile(supabase, user.id, input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save Study plan.";
    const isValidation = !message.toLowerCase().includes("failed") && !message.toLowerCase().includes("configured");
    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500 });
  }
}
