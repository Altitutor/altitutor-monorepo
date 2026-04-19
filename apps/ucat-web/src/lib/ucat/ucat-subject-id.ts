import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";

/**
 * Resolve the UCAT subject row id (for student_subscriptions.subject_id).
 * Caller must use a client that can read subjects (e.g. service role / admin).
 */
export async function getUcatSubjectId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data } = await supabase
    .from("subjects")
    .select("id")
    .eq("name", "UCAT")
    .maybeSingle();
  return data?.id ?? null;
}
