import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SectionRow = {
  id: string;
  name: string;
  sectionNumber: number;
};

export async function GET() {
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

  const { data, error } = await supabase
    .from("vstudent_ucat_sections")
    .select("id, name, section_number")
    .order("section_number");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sections: SectionRow[] = (data ?? []).map((s) => ({
    id: s.id ?? "",
    name: s.name ?? "Unknown",
    sectionNumber: s.section_number ?? 0,
  }));

  return NextResponse.json(sections);
}
