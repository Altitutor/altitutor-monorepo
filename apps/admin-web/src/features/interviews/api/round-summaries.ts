import type { Json } from "@altitutor/shared";
import { getSupabaseClient } from "@/shared/lib/supabase/client";

// Select only calendar/recipient metadata. Whole station snapshots contain large
// prompts, rubrics and live assessment data which these lists never display.
const SUMMARY_FIELDS =
  "id,round_name:data->name,scheduled_at:data->scheduledAt,started_at:data->startedAt,phase:data->phase,delivery:data->delivery,mode:data->mode,recording_enabled:data->recordingEnabled,students:data->students,tutors:data->tutors,student_ids:data->studentIds,reading_time:data->readingTimeSeconds,question_time:data->questionTimeSeconds,assignments:data->assignments,rotation_allowance:data->rotationAllowanceSeconds" as const;
const PAGE_SIZE = 1000;
export async function readInterviewRoundSummaries(
  options: {
    rangeStart?: string;
    rangeEnd?: string;
    scheduledOnly?: boolean;
  } = {},
) {
  const client = getSupabaseClient();
  const rows: { id: string; data: Json }[] = [];
  const start = options.rangeStart
    ? new Date(`${options.rangeStart}T00:00:00`).getTime()
    : null;
  const end = options.rangeEnd
    ? new Date(`${options.rangeEnd}T23:59:59.999`).getTime()
    : null;
  // Legacy setup JSON retains its supplied UTC offset. Widen the cheap text
  // prefilter by one day, then compare actual instants below.
  const day = 86_400_000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client
      .from("interview_rounds")
      .select(SUMMARY_FIELDS)
      .order("id", { ascending: true });
    if (options.scheduledOnly)
      query = query.not("data->>scheduledAt", "is", null);
    if (start !== null)
      query = query.filter(
        "data->>scheduledAt",
        "gte",
        new Date(start - day).toISOString(),
      );
    if (end !== null)
      query = query.filter(
        "data->>scheduledAt",
        "lte",
        new Date(end + day).toISOString(),
      );
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data ?? [])
      rows.push({
        id: row.id,
        data: {
          name: row.round_name,
          scheduledAt: row.scheduled_at,
          startedAt: row.started_at,
          phase: row.phase,
          delivery: row.delivery,
          mode: row.mode,
          recordingEnabled: row.recording_enabled,
          students: row.students,
          tutors: row.tutors,
          studentIds: row.student_ids,
          readingTimeSeconds: row.reading_time,
          questionTimeSeconds: row.question_time,
          rotationAllowanceSeconds: row.rotation_allowance,
          // The round setup requires one tutor assignment for every station.
          stations: row.assignments,
        },
      });
    if (!data || data.length < PAGE_SIZE) break;
  }
  if (start === null && end === null) return rows;
  return rows.filter((row) => {
    if (
      !row.data ||
      typeof row.data !== "object" ||
      Array.isArray(row.data) ||
      typeof row.data.scheduledAt !== "string"
    )
      return false;
    const instant = Date.parse(row.data.scheduledAt);
    return (
      Number.isFinite(instant) &&
      (start === null || instant >= start) &&
      (end === null || instant <= end)
    );
  });
}
