import { supabase } from "@/lib/supabase";

/** Match the web library: an item is attempted once an attempt is completed. */
export async function loadAttemptedIds(kind: "set" | "mock") {
  const ids = new Set<string>();
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    if (kind === "set") {
      const { data, error } = await supabase
        .from("vstudent_ucat_my_set_attempts")
        .select("id,question_set_id")
        .not("completed_at", "is", null)
        .order("id")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      for (const row of data ?? [])
        if (row.question_set_id) ids.add(row.question_set_id);
      if ((data?.length ?? 0) < pageSize) return [...ids];
    } else {
      const { data, error } = await supabase
        .from("vstudent_ucat_my_mock_attempts")
        .select("id,ucat_mock_id")
        .not("completed_at", "is", null)
        .order("id")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      for (const row of data ?? [])
        if (row.ucat_mock_id) ids.add(row.ucat_mock_id);
      if ((data?.length ?? 0) < pageSize) return [...ids];
    }
  }
}
