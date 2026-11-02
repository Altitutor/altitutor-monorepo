import {
  interviewRoundDurationMinutes,
  type InterviewRound,
} from "@altitutor/shared";

export type ScheduledInterviewRound = {
  id: string;
  name: string;
  interviewName: string;
  scheduledAt: string;
  endAt: string;
  startedAt: string | null;
  phase: string;
  delivery: InterviewRound["delivery"];
  mode: InterviewRound["mode"];
  recordingEnabled: boolean;
  students: { id: string; name: string }[];
  tutors: { id: string; name: string }[];
};

export function toScheduledRound(
  round: InterviewRound,
  interviewName: string,
): ScheduledInterviewRound | null {
  if (!round.scheduledAt) return null;
  const minutes = interviewRoundDurationMinutes(
    round.readingTimeSeconds,
    round.questionTimeSeconds,
    round.stations.length,
  );
  return {
    id: round.id,
    name: round.name,
    interviewName,
    scheduledAt: round.scheduledAt,
    endAt: new Date(
      Date.parse(round.scheduledAt) + minutes * 60_000,
    ).toISOString(),
    startedAt: round.startedAt,
    phase: round.phase,
    delivery: round.delivery,
    mode: round.mode,
    recordingEnabled: round.recordingEnabled,
    students: round.students.map((student) => ({
      id: student.id,
      name: student.name,
    })),
    tutors: round.tutors.map((tutor) => ({ id: tutor.id, name: tutor.name })),
  };
}

export function roundRoomPath(round: {
  id: string;
  phase: string;
  startedAt: string | null;
}) {
  if (round.phase === "completed")
    return `/interviews/rounds/${round.id}/results`;
  return `/interviews/rounds/${round.id}/${round.startedAt ? "live" : "waiting"}`;
}

export function roundRoomLabel(
  round: { phase: string; startedAt: string | null },
  waitingLabel = "Enter waiting room",
) {
  if (round.phase === "completed") return "Review results";
  if (round.startedAt) return "Rejoin interview";
  return waitingLabel;
}

/** The waiting room is still editable. A started round is not, including the pause between rotations. */
export function roundCanEdit(round: {
  startedAt: string | null;
  phase: string;
}) {
  return !round.startedAt && round.phase !== "completed";
}

export function roundStatusLabel(round: {
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
