import type { Tables } from "@altitutor/shared";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
const chunk = <T>(items: T[], size = 100): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

export type StudentClasses = Array<{
  class: Tables<"classes">;
  subject: Tables<"subjects"> | null;
  startDate: Date | null;
}>;
/** Batched reads, only when the template actually needs enrolment information. */
export async function readBulkStudentClasses(
  ids: string[],
  withDates: boolean,
): Promise<Record<string, StudentClasses>> {
  const db = getSupabaseClient();
  const result: Record<string, StudentClasses> = {};
  const now = new Date().toISOString();
  for (const batch of chunk(ids)) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from("classes_students")
        .select("student_id, class:classes(*, subject:subjects(*))")
        .in("student_id", batch)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${now}`)
        .order("id")
        .range(offset, offset + 999);
      if (error) throw error;
      for (const row of data ?? [])
        if (row.class)
          (result[row.student_id] ??= []).push({
            class: row.class,
            subject: row.class.subject,
            startDate: null,
          });
      if (!data || data.length < 1000) break;
    }
    if (withDates)
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db
          .from("sessions_students")
          .select("student_id, session:sessions!inner(class_id,start_at)")
          .in("student_id", batch)
          .eq("planned_absence", false)
          .gte("session.start_at", now)
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        for (const row of data ?? []) {
          const session = row.session;
          if (!session?.start_at) continue;
          const item = result[row.student_id]?.find(
            (item) => item.class.id === session.class_id,
          );
          const date = new Date(session.start_at);
          if (item && (!item.startDate || date < item.startDate))
            item.startDate = date;
        }
        if (!data || data.length < 1000) break;
      }
  }
  return result;
}
