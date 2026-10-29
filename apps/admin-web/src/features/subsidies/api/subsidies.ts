import type { Tables } from "@altitutor/shared";
import { getSupabaseClient } from "@/shared/lib/supabase/client";

export type SubsidyRow = Tables<"student_subsidies"> & {
  student: Pick<Tables<"students">, "id" | "first_name" | "last_name">;
  subject: Tables<"subjects">;
};

export interface SubsidiesQuery {
  search?: string;
  statuses?: string[];
  subjectIds?: string[];
  page: number;
  pageSize: number;
  sortBy?: string | null;
  ascending?: boolean;
}

export async function fetchSubsidies(
  options: SubsidiesQuery,
): Promise<{ subsidies: SubsidyRow[]; total: number }> {
  const now = new Date().toISOString();
  let query = getSupabaseClient()
    .from("student_subsidies")
    .select(
      "*, student:students!inner(id, first_name, last_name), subject:subjects!inner(*)",
      { count: "exact" },
    )
    .is("student.deleted_at", null);

  const active = options.statuses?.includes("active");
  const inactive = options.statuses?.includes("inactive");
  if (active && !inactive) {
    query = query
      .lte("effective_from", now)
      .or(`effective_until.is.null,effective_until.gt.${now}`);
  } else if (inactive && !active) {
    query = query.or(`effective_from.gt.${now},effective_until.lte.${now}`);
  }
  if (options.subjectIds?.length)
    query = query.in("subject_id", options.subjectIds);

  // Quote PostgREST values so punctuation cannot change the filter expression.
  for (const token of options.search?.trim().split(/\s+/).filter(Boolean) ??
    []) {
    const pattern = `"%${token.replace(/[\\"%_*]/g, "")}%"`;
    query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`, {
      referencedTable: "student",
    });
  }
  const sortable = ["price_cents", "effective_from", "effective_until"];
  if (options.sortBy && sortable.includes(options.sortBy)) {
    query = query.order(options.sortBy, {
      ascending: options.ascending ?? false,
      nullsFirst: false,
    });
  }
  const page = Math.max(1, options.page);
  const pageSize = Math.min(100, Math.max(1, options.pageSize));
  const { data, count, error } = await query
    .order("id")
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { subsidies: (data ?? []) as SubsidyRow[], total: count ?? 0 };
}
