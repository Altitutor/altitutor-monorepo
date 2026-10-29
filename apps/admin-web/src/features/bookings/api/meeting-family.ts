import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { Tables } from "@altitutor/shared";

export async function getMeetingFamilySuggestions(
  studentIds: string[],
  parentIds: string[],
) {
  const db = getSupabaseClient();
  const [parents, students] = await Promise.all([
    studentIds.length
      ? db
          .from("parents_students")
          .select("parent:parents(*)")
          .in("student_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    parentIds.length
      ? db
          .from("parents_students")
          .select("student:students(*)")
          .in("parent_id", parentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (parents.error) throw parents.error;
  if (students.error) throw students.error;
  const unique = <T extends { id: string }>(rows: T[], excluded: string[]) => [
    ...new Map(
      rows
        .filter((row) => !excluded.includes(row.id))
        .map((row) => [row.id, row]),
    ).values(),
  ];
  return {
    parents: unique(
      (parents.data ?? []).flatMap((row) =>
        row.parent ? [row.parent as Tables<"parents">] : [],
      ),
      parentIds,
    ),
    students: unique(
      (students.data ?? [])
        .flatMap((row) =>
          row.student ? [row.student as Tables<"students">] : [],
        )
        .filter((student) => !student.deleted_at),
      studentIds,
    ),
  };
}
