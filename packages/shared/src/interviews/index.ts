import type { Json } from "../supabase/generated";

export type InterviewRichText = Json;
export type InterviewPhase =
  | "waiting"
  | "reading"
  | "questions"
  | "feedback"
  | "completed";
export type InterviewDelivery = "online" | "in_person";
export type InterviewMode = "exam" | "feedback";
export interface InterviewCategory {
  id: string;
  name: string;
  parentId: string | null;
}
export interface InterviewTag {
  id: string;
  name: string;
}
export interface InterviewQuestion {
  id: string;
  stationId: string;
  tagIds: string[];
  question: InterviewRichText;
  rubric: InterviewRichText;
  rubricVersion: number;
  suggestedTimeSeconds: number;
}
export interface InterviewStation {
  id: string;
  version: number;
  name: string;
  categoryId: string;
  prompt: InterviewRichText;
  maximumPoints: number;
  questions: InterviewQuestion[];
  archived: boolean;
  updatedAt: string;
}
export interface InterviewStationPlacement {
  id: string;
  stationId: string;
}
export interface InterviewTemplate {
  id: string;
  version: number;
  name: string;
  readingTimeSeconds: number;
  questionTimeSeconds: number;
  recordingEnabled: boolean;
  stations: InterviewStationPlacement[];
  archived: boolean;
  updatedAt: string;
}
export interface InterviewPerson {
  id: string;
  name: string;
}
export interface InterviewStudent extends InterviewPerson {
  classIds: string[];
}
export interface InterviewCatalog {
  actorId: string;
  categories: InterviewCategory[];
  tags: InterviewTag[];
  stations: InterviewStation[];
  interviews: InterviewTemplate[];
  tutors: InterviewPerson[];
  students: InterviewStudent[];
  classes: InterviewPerson[];
}
export interface InterviewAssignment {
  stationId: string;
  tutorId: string;
}
export interface InterviewRoundSetup {
  interviewId: string;
  name: string;
  delivery: InterviewDelivery;
  mode: InterviewMode;
  recordingEnabled: boolean;
  scheduledAt: string | null;
  studentIds: string[];
  assignments: InterviewAssignment[];
}
export interface InterviewSnapshotQuestion {
  id: string;
  questionId: string;
  question: InterviewRichText;
  rubric: InterviewRichText;
  rubricVersion: number;
  // Older rounds did not snapshot pacing guidance.
  suggestedTimeSeconds?: number;
}
export interface InterviewSnapshotStation {
  id: string;
  stationId?: string;
  name: string;
  prompt: InterviewRichText;
  maximumPoints: number;
  questions: InterviewSnapshotQuestion[];
}
export function resolveInterviewStations(
  interview: InterviewTemplate,
  stations: InterviewStation[],
): (Omit<InterviewStation, "id"> & InterviewStationPlacement)[] {
  return interview.stations.flatMap((placement) => {
    const station = stations.find((item) => item.id === placement.stationId);
    return station ? [{ ...station, ...placement }] : [];
  });
}
export interface InterviewStationProgress {
  stationId: string;
  tutorId: string;
  studentId: string | null;
  ready: boolean;
  endedEarly: boolean;
  feedbackComplete: boolean;
}
export interface InterviewFeedback {
  placementId: string;
  value: InterviewRichText;
}
export interface InterviewStationAttempt {
  id: string;
  studentId: string;
  stationId: string;
  version: number;
  score: number | null;
  notAssessedReason: string | null;
  /** Optional on attempts and clients created before station feedback was added. */
  generalFeedback?: InterviewRichText;
  feedback: InterviewFeedback[];
  completed: boolean;
  updatedAt: string;
  updatedBy: string | null;
}
export interface InterviewRecording {
  id: string;
  attemptId: string;
  state: "pending" | "recording" | "ready" | "failed" | "expired";
  kind: "video" | "audio";
  expiresAt: string;
  createdAt: string;
}
export interface InterviewReleasedResult {
  studentId: string;
  releasedAt: string;
  revision: number;
  score: number;
  possiblePoints: number;
  partial: boolean;
  attempts: InterviewStationAttempt[];
  recordings: InterviewRecording[];
}
export interface InterviewRound extends InterviewRoundSetup {
  id: string;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  phase: InterviewPhase;
  rotation: number;
  phaseStartedAt: string;
  phaseDeadline: string | null;
  pausedAt: string | null;
  remainingMilliseconds: number | null;
  readingTimeSeconds: number;
  questionTimeSeconds: number;
  stations: InterviewSnapshotStation[];
  progress: InterviewStationProgress[];
  students: InterviewPerson[];
  tutors: InterviewPerson[];
  attempts: InterviewStationAttempt[];
  releasedResults: InterviewReleasedResult[];
  recordings: InterviewRecording[];
  connectedStudentIds: string[];
  serverNow: string;
}
export interface StudentInterviewStation {
  id: string;
  number: number;
  complete: boolean;
}
export interface StudentInterviewRound {
  id: string;
  name: string;
  version: number;
  delivery: InterviewDelivery;
  mode: InterviewMode;
  recordingEnabled: boolean;
  scheduledAt: string | null;
  startedAt: string | null;
  phase: InterviewPhase;
  rotation: number;
  pausedAt: string | null;
  phaseStartedAt: string;
  phaseDeadline: string | null;
  serverNow: string;
  studentId: string;
  stationId: string | null;
  stationNumber: number | null;
  tutor: InterviewPerson | null;
  prompt: InterviewRichText;
  endedEarly: boolean;
  stations: StudentInterviewStation[];
  result: InterviewReleasedResult | null;
  resultStations: InterviewSnapshotStation[];
}
interface Command {
  commandId: string;
}
interface VersionedCommand extends Command {
  expectedVersion: number;
}
interface RoundCommand extends VersionedCommand {
  roundId: string;
}
export type InterviewCommand =
  | (Command & { type: "saveCategory"; category: InterviewCategory })
  | (Command & { type: "saveTag"; tag: InterviewTag })
  | (VersionedCommand & {
      type: "saveStation";
      station: Omit<InterviewStation, "version" | "updatedAt" | "questions"> & {
        questions: Omit<InterviewQuestion, "rubricVersion">[];
      };
    })
  | (VersionedCommand & {
      type: "saveRubric";
      stationId: string;
      questionId: string;
      rubric: InterviewRichText;
    })
  | (VersionedCommand & {
      type: "saveInterview";
      interview: Omit<InterviewTemplate, "version" | "updatedAt">;
    })
  | (Command & {
      type: "createRound";
      roundId: string;
      setup: InterviewRoundSetup;
    })
  | (RoundCommand & { type: "updateRound"; setup: InterviewRoundSetup })
  | (RoundCommand & { type: "start" | "pause" | "resume" | "next" | "release" })
  | (RoundCommand & { type: "startReading"; overrideMissingStudents?: boolean })
  | (RoundCommand & { type: "ready"; ready: boolean })
  | (RoundCommand & { type: "endStation" | "finishFeedback" })
  | (RoundCommand & {
      type: "claimStudent";
      studentId: string | null;
      confirmMove?: boolean;
    })
  | (Command & { type: "heartbeat" | "tick"; roundId: string })
  | (Command & {
      type: "saveAttempt";
      roundId: string;
      attemptId: string;
      expectedAttemptVersion: number;
      score: number | null;
      notAssessedReason: string | null;
      /** Optional on attempts and clients created before station feedback was added. */
      generalFeedback?: InterviewRichText;
      feedback: InterviewFeedback[];
    });
export interface InterviewCommandResult {
  id: string;
  version: number;
  mediaWarning?: string;
}

/** Text extraction is also the answered rule: empty rich-text documents are unanswered. */
export function interviewText(value: InterviewRichText): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(interviewText).join(" ");
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  return value.content ? interviewText(value.content) : "";
}

export { isInterviewCommand } from "./validation";
