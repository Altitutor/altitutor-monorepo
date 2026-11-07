import {
  choiceFilterMatches,
  interviewRoundDurationMinutes,
  type Json,
} from "@altitutor/shared";
export { interviewRoundDurationMinutes } from "@altitutor/shared";

export type InterviewRoundCalendarEvent = {
  id: string;
  subjectId?: string;
  name: string;
  scheduledAt: string;
  endAt: string;
  startedAt: string | null;
  phase: string;
  delivery: "online" | "in_person";
  mode: "exam" | "feedback";
  recordingEnabled: boolean;
  students: { id: string; name: string }[];
  tutors: { id: string; name: string }[];
};

function people(value: unknown): { id: string; name: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.name !== "string")
      return [];
    return [{ id: record.id, name: record.name }];
  });
}

export function interviewRoundFromRow(row: {
  id: string;
  data: Json;
}): InterviewRoundCalendarEvent | null {
  if (!row.data || typeof row.data !== "object" || Array.isArray(row.data))
    return null;
  const data = row.data as Record<string, Json | undefined>;
  if (
    typeof data.scheduledAt !== "string" ||
    Number.isNaN(Date.parse(data.scheduledAt))
  )
    return null;
  const reading =
    typeof data.readingTimeSeconds === "number" ? data.readingTimeSeconds : 0;
  const question =
    typeof data.questionTimeSeconds === "number" ? data.questionTimeSeconds : 0;
  const minutes = interviewRoundDurationMinutes(
    reading,
    question,
    Array.isArray(data.stations) ? data.stations.length : 1,
  );
  return {
    id: row.id,
    name:
      typeof data.name === "string" && data.name.trim()
        ? data.name
        : "Interview round",
    scheduledAt: data.scheduledAt,
    endAt: new Date(
      Date.parse(data.scheduledAt) + minutes * 60_000,
    ).toISOString(),
    startedAt: typeof data.startedAt === "string" ? data.startedAt : null,
    phase: typeof data.phase === "string" ? data.phase : "waiting",
    delivery: data.delivery === "in_person" ? "in_person" : "online",
    mode: data.mode === "feedback" ? "feedback" : "exam",
    recordingEnabled: data.recordingEnabled === true,
    students: people(data.students),
    tutors: people(data.tutors),
  };
}

export function interviewRoundStatus(round: {
  phase: string;
  startedAt: string | null;
  scheduledAt: string | null;
}) {
  if (round.phase === "completed") return "Completed";
  if (round.startedAt)
    return round.phase.charAt(0).toUpperCase() + round.phase.slice(1);
  if (round.scheduledAt) return "Scheduled";
  return "Waiting room";
}

export function interviewRoundRoomLabel(round: {
  phase: string;
  startedAt: string | null;
}) {
  if (round.phase === "completed") return "Review results";
  if (round.startedAt) return "Rejoin interview";
  return "Open waiting room";
}

export function interviewRoundRoomUrl(round: {
  id: string;
  phase: string;
  startedAt: string | null;
}) {
  return `/interviews/rounds/${encodeURIComponent(round.id)}`;
}

export function filterInterviewRoundEvents(
  rounds: InterviewRoundCalendarEvent[],
  filters: Record<string, string[]>,
  search = "",
  scope?: {
    studentId?: string;
    staffId?: string;
    parentId?: string;
    classId?: string;
    adminShiftId?: string;
  },
) {
  if (scope?.parentId || scope?.classId || scope?.adminShiftId) return [];
  return rounds.filter((round) => {
    if (
      !choiceFilterMatches(
        filters.type ?? [],
        "INTERVIEW",
        filters.type__operator?.[0],
      )
    )
      return false;
    if (
      scope?.studentId &&
      !round.students.some((student) => student.id === scope.studentId)
    )
      return false;
    if (
      scope?.staffId &&
      !round.tutors.some((tutor) => tutor.id === scope.staffId)
    )
      return false;
    if (
      !choiceFilterMatches(
        filters.student ?? [],
        round.students.map((student) => student.id),
        filters.student__operator?.[0],
      )
    )
      return false;
    if (
      !choiceFilterMatches(
        filters.staff ?? [],
        round.tutors.map((tutor) => tutor.id),
        filters.staff__operator?.[0],
      )
    )
      return false;
    if (
      (filters.subject ?? []).length &&
      !choiceFilterMatches(
        filters.subject,
        round.subjectId,
        filters.subject__operator?.[0],
      )
    )
      return false;
    if (
      (filters.tutor_log ?? []).length &&
      !choiceFilterMatches(
        filters.tutor_log,
        "unlogged",
        filters.tutor_log__operator?.[0],
      )
    )
      return false;
    const text = [
      round.name,
      ...round.students.map((person) => person.name),
      ...round.tutors.map((person) => person.name),
    ]
      .join(" ")
      .toLowerCase();
    return !search.trim() || text.includes(search.trim().toLowerCase());
  });
}
