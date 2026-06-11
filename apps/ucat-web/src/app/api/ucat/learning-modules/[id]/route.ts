import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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

  const { data: module, error: moduleError } = await supabase
    .from("vstudent_ucat_learning_modules")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (moduleError) {
    return NextResponse.json({ error: moduleError.message }, { status: 500 });
  }
  if (!module || module.kind !== "lesson") {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const { data: blocks, error: blocksError } = await supabase
    .from("vstudent_ucat_learning_module_blocks")
    .select("*")
    .eq("learning_module_id", id)
    .order("index", { ascending: true });

  if (blocksError) {
    return NextResponse.json({ error: blocksError.message }, { status: 500 });
  }

  return NextResponse.json({ module, blocks: blocks ?? [] });
}
