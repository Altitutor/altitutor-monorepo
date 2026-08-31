import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type SetSectionJson = {
  section_number?: number;
  name?: string;
  time_per_question?: number | null;
};

export type StudentSetRow = {
  id: string;
  name?: unknown;
  display_name?: string | null;
  compact_display_name?: string | null;
  description: unknown;
  time_limit_seconds: number | null;
  sections: SetSectionJson[] | null;
  section_number?: number | null;
  set_format?: "full_section" | "partial_section" | null;
  catalog_index?: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SetsFilters = {
  search?: string;
  timed?: "timed" | "untimed" | "all";
  sectionNumber?: number | null;
  attempted?: "all" | "attempted" | "unattempted";
};

const STUDENT_SET_COLUMNS =
  "id,name,display_name,compact_display_name,description,time_limit_seconds,sections,section_number,set_format,catalog_index,created_at,updated_at";

export async function getAccessibleStudentSets(): Promise<StudentSetRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_ucat_question_sets")
    .select(STUDENT_SET_COLUMNS)
    .order("section_number")
    .order("set_format")
    .order("catalog_index");
  if (error) throw new Error(error.message ?? "Failed to load sets");
  return (data ?? []) as StudentSetRow[];
}

export async function getStudentSets(): Promise<StudentSetRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_ucat_question_sets")
    .select(STUDENT_SET_COLUMNS)
    .eq("is_available_in_sets_library", true)
    .order("section_number")
    .order("set_format")
    .order("catalog_index");
  if (error) throw new Error(error.message ?? "Failed to load sets");
  return (data ?? []) as StudentSetRow[];
}

export async function getStudentSet(setId: string): Promise<StudentSetRow | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_ucat_question_sets")
    .select(STUDENT_SET_COLUMNS)
    .eq("id", setId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to load set");
  return data as StudentSetRow | null;
}

type SetDetailStemMeta = {
  questions_meta?: Array<unknown> | null;
};

function countQuestionsFromStems(stems: unknown): number {
  if (!Array.isArray(stems)) return 0;
  return stems.reduce<number>((sum, stem) => {
    const meta = (stem as SetDetailStemMeta).questions_meta;
    return sum + (Array.isArray(meta) ? meta.length : 0);
  }, 0);
}

/** Question count for a set from accessible stem/question metadata. */
export async function getSetQuestionCount(setId: string): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_ucat_question_set_detail")
    .select("stems")
    .eq("id", setId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to load set question count");
  return countQuestionsFromStems(data?.stems);
}

export type SetAttemptRow = {
  id: string;
  attemptedAt: string;
  completedAt: string | null;
  scorePoints: number | null;
  totalPoints: number | null;
  scaledScore: number | null;
};

export async function getSetAttempts(setId: string): Promise<SetAttemptRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_ucat_my_set_attempts")
    .select(
      "id, attempted_at, completed_at, score_points, total_points, scaled_score",
    )
    .eq("question_set_id", setId)
    .not("completed_at", "is", null)
    .order("attempted_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Failed to load set attempts");
  return (data ?? []).map((row) => ({
    id: row.id ?? "",
    attemptedAt: row.attempted_at ?? "",
    completedAt: row.completed_at,
    scorePoints: row.score_points,
    totalPoints: row.total_points,
    scaledScore: row.scaled_score,
  }));
}

export async function getAttemptedSetIds(): Promise<Set<string>> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_ucat_my_set_attempts")
    .select("question_set_id")
    .not("completed_at", "is", null);
  if (error) throw new Error(error.message ?? "Failed to load attempted sets");
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.question_set_id) ids.add(row.question_set_id);
  }
  return ids;
}

function compareNullableNumber(
  left: number | null | undefined,
  right: number | null | undefined,
): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
}

/** Catalog order: section, then format, then published sequence. */
export function compareStudentSetsByCatalog(
  left: StudentSetRow,
  right: StudentSetRow,
): number {
  const section =
    (left.section_number ?? Number.POSITIVE_INFINITY) -
    (right.section_number ?? Number.POSITIVE_INFINITY);
  if (section !== 0) return section;
  const format = (left.set_format ?? "").localeCompare(right.set_format ?? "");
  if (format !== 0) return format;
  return compareNullableNumber(left.catalog_index, right.catalog_index);
}

export function filterSets(
  sets: StudentSetRow[],
  filters: SetsFilters,
  attemptedSetIds?: Set<string>,
  extractText?: (value: unknown) => string,
): StudentSetRow[] {
  const getText =
    extractText ?? ((v: unknown) => (typeof v === "string" ? v : ""));
  return sets.filter((set) => {
    if (filters.search?.trim()) {
      const searchLower = filters.search.trim().toLowerCase();
      const nameText = set.display_name ?? getText(set.name) ?? "";
      const descText = getText(set.description) ?? "";
      const combined = `${nameText} ${descText}`.toLowerCase();
      if (!combined.includes(searchLower)) return false;
    }
    if (
      filters.timed === "timed" &&
      (set.time_limit_seconds == null || set.time_limit_seconds <= 0)
    ) {
      return false;
    }
    if (
      filters.timed === "untimed" &&
      set.time_limit_seconds != null &&
      set.time_limit_seconds > 0
    ) {
      return false;
    }
    if (filters.sectionNumber != null) {
      if (set.section_number != null) {
        if (set.section_number !== filters.sectionNumber) return false;
      } else {
        const sections = Array.isArray(set.sections) ? set.sections : [];
        const hasSection = sections.some(
          (s) => s.section_number === filters.sectionNumber,
        );
        if (!hasSection) return false;
      }
    }
    if (filters.attempted === "unattempted" && attemptedSetIds?.has(set.id)) {
      return false;
    }
    if (filters.attempted === "attempted" && !attemptedSetIds?.has(set.id)) {
      return false;
    }
    return true;
  });
}
