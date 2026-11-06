import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { Tables } from "@altitutor/shared";

function uniquePeople<T extends { id: string }>(rows: T[], excluded: string[]) {
  return [
    ...new Map(
      rows
        .filter((row) => !excluded.includes(row.id))
        .map((row) => [row.id, row]),
    ).values(),
  ];
}

export async function getMeetingFamilySuggestions(
  studentIds: string[],
  parentIds: string[],
) {
  const db = getSupabaseClient();
  const linkedParents = studentIds.length
    ? await db
        .from("parents_students")
        .select("parent:parents(*)")
        .in("student_id", studentIds)
    : { data: [], error: null };
  if (linkedParents.error) throw linkedParents.error;
  const parents = (linkedParents.data ?? []).flatMap((row) =>
    row.parent ? [row.parent as Tables<"parents">] : [],
  );
  const familyParentIds = [...new Set([...parentIds, ...parents.map((row) => row.id)])];
  const linkedStudents = familyParentIds.length
    ? await db
        .from("parents_students")
        .select("student:students(*)")
        .in("parent_id", familyParentIds)
    : { data: [], error: null };
  if (linkedStudents.error) throw linkedStudents.error;

  return {
    parents: uniquePeople(parents, parentIds),
    students: uniquePeople(
      (linkedStudents.data ?? [])
        .flatMap((row) => (row.student ? [row.student as Tables<"students">] : []))
        .filter((student) => !student.deleted_at),
      studentIds,
    ),
  };
}
