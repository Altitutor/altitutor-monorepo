import {
  interviewRoundDurationMinutes,
  type InterviewAssignment,
  type InterviewRoundSetup,
  type InterviewTemplate,
} from "@altitutor/shared";

export interface InterviewRoundPlan {
  interview: InterviewTemplate;
  settings: Omit<InterviewRoundSetup, "interviewId" | "studentIds">;
  studentIds: string[];
  groups: string[][];
  assignmentsByRound?: Record<number, InterviewAssignment[]>;
}

/** Prepare the complete series before the single atomic create command. */
export function planInterviewRounds({
  interview,
  settings,
  studentIds,
  groups,
  assignmentsByRound,
}: InterviewRoundPlan): InterviewRoundSetup[] {
  const capacity = interview.stations.length;
  if (
    !capacity ||
    !groups.length ||
    groups.length > 100 ||
    groups.some((group) => !group.length || group.length > capacity)
  )
    throw new Error(
      "Each round must contain students within station capacity (up to 100 rounds).",
    );
  const allocated = groups.flat();
  if (
    new Set(allocated).size !== allocated.length ||
    new Set(studentIds).size !== studentIds.length
  )
    throw new Error("Each student must appear exactly once in the series.");
  if (
    allocated.length !== studentIds.length ||
    allocated.some((id) => !studentIds.includes(id))
  )
    throw new Error("Allocate every selected student to a round.");
  if (!settings.name.trim()) throw new Error("Enter a round name.");
  const allowance = settings.rotationAllowanceSeconds ?? 0;
  if (!Number.isInteger(allowance) || allowance < 0 || allowance > 7200)
    throw new Error("Choose an allowance between 0 and 120 minutes.");
  const interval =
    interviewRoundDurationMinutes(
      interview.readingTimeSeconds,
      interview.questionTimeSeconds,
      interview.stations.length,
      settings.rotationAllowanceSeconds ?? 0,
    ) * 60_000;
  const start = Date.parse(settings.scheduledAt ?? "");
  if (!Number.isFinite(start) || interval <= 0)
    throw new Error("Choose a valid round start and duration.");
  return groups.map((studentIds, index) => ({
    ...settings,
    interviewId: interview.id,
    name: `${settings.name.trim()} ${index + 1}`,
    scheduledAt: new Date(start + index * interval).toISOString(),
    studentIds: [...studentIds],
    assignments: (assignmentsByRound?.[index] ?? settings.assignments).map(
      (assignment) => ({ ...assignment }),
    ),
  }));
}
