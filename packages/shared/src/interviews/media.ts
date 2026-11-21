import type { InterviewRound } from "./index";

/** Only the authoritative fields needed to issue and retire media capabilities. */
export type InterviewMediaRound = Pick<InterviewRound,
  "id" | "version" | "delivery" | "mode" | "recordingEnabled" | "startedAt" |
  "phase" | "phaseStartedAt" | "phaseDeadline" | "pausedAt" | "serverNow" | "tutors" | "students"
> & {
  progress: Pick<InterviewRound["progress"][number], "stationId" | "tutorId" | "studentId" | "endedEarly" | "feedbackComplete">[];
  attempts: Pick<InterviewRound["attempts"][number], "id" | "stationId" | "studentId">[];
  recordings: Pick<InterviewRound["recordings"][number], "id" | "kind" | "state">[];
};

export interface InterviewMediaPolicy {
  scope: "station";
  key: string;
  attemptId: string;
  studentId: string;
  tutorId: string;
  phase: "reading" | "questions" | "feedback";
  expiresAt: string | null;
  canSend: boolean;
  canReceive: boolean;
  recordingEnabled: boolean;
}

/** Server-side policy derived from the authenticated round, never from browser phase flags. */
export function interviewMediaPolicy(
  round: InterviewMediaRound,
  actorId: string,
  role: "tutor" | "student",
): InterviewMediaPolicy | null {
  if (
    round.pausedAt ||
    round.phase === "waiting" ||
    round.phase === "completed"
  )
    return null;
  const station = round.progress.find((entry) =>
    role === "tutor" ? entry.tutorId === actorId : entry.studentId === actorId,
  );
  if (!station?.studentId || station.feedbackComplete) return null;
  const attempt = round.attempts.find(
    (entry) =>
      entry.stationId === station.stationId &&
      entry.studentId === station.studentId,
  );
  if (!attempt) return null;
  const phase = station.endedEarly ? "feedback" : round.phase;
  if (round.mode === "exam" && phase === "feedback") return null;
  const readingExam = round.mode === "exam" && phase === "reading";
  return {
    scope: "station",
    key: `${attempt.id}:${phase}:${round.phaseStartedAt}`,
    attemptId: attempt.id,
    studentId: station.studentId,
    tutorId: station.tutorId,
    phase,
    expiresAt: phase === "feedback" ? null : round.phaseDeadline,
    canSend: !(readingExam && role === "tutor"),
    canReceive: !(readingExam && role === "student"),
    recordingEnabled: round.recordingEnabled && phase !== "reading",
  };
}

export interface InterviewMediaTicket {
  /** Changes when provider permissions must be replaced, independently of the room. */
  accessKey?: string;
  captureExpiresAt?: string;
  phase?: InterviewRound["phase"];
  captureId?: string;
  actorId?: string;
  serverNow?: string;
  sessionId: string | null;
  url?: string;
  token?: string;
  expiresAt?: string;
  canSend: boolean;
  canReceive: boolean;
  recordingEnabled: boolean;
  recordingActive?: boolean;
  warning?: string;
  attemptId?: string;
}

export interface InterviewWaitingMediaPolicy {
  scope: "waiting";
  key: string;
  expiresAt: string;
  canSend: true;
  canReceive: true;
  recordingEnabled: false;
}

/** Only the unstarted online round is a shared conversation. */
export function interviewWaitingMediaPolicy(
  round: InterviewMediaRound,
  now: number,
): InterviewWaitingMediaPolicy | null {
  if (round.delivery !== "online" || round.startedAt || round.pausedAt || round.phase !== "waiting") return null;
  const generation = Math.floor(now / (30 * 60_000));
  return {
    scope: "waiting",
    key: `${round.id}:${round.version}:${generation}`,
    expiresAt: new Date((generation + 1) * 30 * 60_000).toISOString(),
    canSend: true,
    canReceive: true,
    recordingEnabled: false,
  };
}
