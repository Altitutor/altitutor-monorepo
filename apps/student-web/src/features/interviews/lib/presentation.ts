import type { StudentInterviewRound } from "@altitutor/shared";

/** Deliberately returns no timer outside reading, including paused question time. */
export function studentReadingSeconds(
  round: StudentInterviewRound,
  now: number,
): number | null {
  if (round.phase !== "reading" || !round.phaseDeadline) return null;
  const reference = round.pausedAt ? Date.parse(round.pausedAt) : now;
  return Math.max(
    0,
    Math.ceil((Date.parse(round.phaseDeadline) - reference) / 1000),
  );
}

export function readingClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function studentShowsReadingClock(
  round: StudentInterviewRound,
): boolean {
  return round.mode === "exam" && round.phase === "reading";
}

export function studentStageBadge(round: StudentInterviewRound): {
  label: string;
  pill: string;
} {
  if (!round.startedAt || round.phase === "waiting")
    return { label: "Waiting", pill: "bg-amber-400 text-amber-950" };
  if (round.phase === "completed")
    return { label: "Completed", pill: "bg-sky-500 text-white" };
  if (round.phase === "reading")
    return { label: "Reading time", pill: "bg-yellow-400 text-yellow-950" };
  if (round.phase === "questions")
    return { label: "Question time", pill: "bg-blue-600 text-white" };
  if (round.phase === "feedback")
    return { label: "Feedback", pill: "bg-purple-600 text-white" };
  return { label: "Waiting", pill: "bg-amber-400 text-amber-950" };
}

export function studentInfoCard(round: StudentInterviewRound): {
  variant: "instructions" | "prompt";
  title: string;
  body: string;
} {
  if (round.phase === "completed")
    return {
      variant: "instructions",
      title: "Interview complete",
      body: "Your interview is complete. Results and recordings appear after your tutors release them.",
    };
  if (!round.startedAt || round.phase === "waiting")
    return {
      variant: "instructions",
      title: "Waiting",
      body: "Wait here for your station to start.",
    };
  const teachingFeedback =
    round.phase === "feedback" && round.mode === "feedback";
  const waitingForNextStation =
    (round.phase === "feedback" && round.mode === "exam") ||
    !round.stationId ||
    (round.endedEarly && !teachingFeedback);
  if (waitingForNextStation)
    return {
      variant: "instructions",
      title: "Please wait",
      body: "Wait here for the next station.",
    };
  if (round.phase === "reading")
    return { variant: "prompt", title: "Reading time", body: "" };
  if (round.phase === "questions")
    return { variant: "prompt", title: "Question time", body: "" };
  return { variant: "prompt", title: "Feedback time", body: "" };
}

export function studentPhaseMessage(round: StudentInterviewRound): string {
  if (round.pausedAt)
    return "Your tutor has paused the interview. Stay here until it resumes.";
  if (round.endedEarly)
    return "This station has finished. Wait here for the next rotation.";
  if (round.phase === "completed")
    return "Your interview is complete. Results and recordings appear after your tutors release them.";
  if (round.phase === "waiting")
    return round.delivery === "in_person"
      ? "Your tutor will select you when you arrive at their station."
      : "Get comfortable and check your camera and microphone. Your tutors will start when everyone is ready.";
  if (!round.stationId)
    return "You have a break this rotation. Stay here for your next station.";
  if (round.phase === "reading")
    return round.mode === "exam"
      ? "Read the prompt quietly. Your tutor can see and hear you; you will see and hear them when question time begins."
      : "Read the prompt. You can discuss it with your tutor.";
  if (round.phase === "questions")
    return "Listen to your tutor and answer their questions.";
  return round.mode === "exam"
    ? "Your tutor is marking. Wait here for the next rotation."
    : "Discuss your feedback with your tutor.";
}
