import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  checkQuotaForAction,
  quotaExceededResponse,
} from "@/lib/ucat/quota/quota-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const supabase = await getSupabaseServerClient();

  const { data: module, error: moduleError } = await supabase
    .from("vstudent_ucat_learning_modules")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (moduleError) {
    captureApiError(moduleError, "/api/ucat/learning-modules/[id]");
    return NextResponse.json({ error: moduleError.message }, { status: 500 });
  }
  if (!module || module.kind !== "lesson") {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const quotaCheck = await checkQuotaForAction(
    auth.admin,
    auth.studentId,
    "learn",
    { learningModuleId: id },
  );
  if (!quotaCheck.allowed) {
    return quotaExceededResponse(quotaCheck.payload);
  }

  const { data: blocks, error: blocksError } = await supabase
    .from("vstudent_ucat_learning_module_blocks")
    .select("*")
    .eq("learning_module_id", id)
    .order("index", { ascending: true });

  if (blocksError) {
    captureApiError(blocksError, "/api/ucat/learning-modules/[id]");
    return NextResponse.json({ error: blocksError.message }, { status: 500 });
  }

  return NextResponse.json({ module, blocks: blocks ?? [] });
}
