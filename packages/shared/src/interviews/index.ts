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
  version: number;
  categoryId: string;
  tagIds: string[];
  question: InterviewRichText;
  prompt: InterviewRichText;
  rubric: InterviewRichText;
  rubricVersion: number;
  suggestedTimeSeconds: number;
  archived: boolean;
  updatedAt: string;
}
export interface InterviewPlacement {
  id: string;
  questionId: string;
}
export interface InterviewStation {
  id: string;
  name: string;
  maximumPoints: number;
  questions: InterviewPlacement[];
}
export interface InterviewTemplate {
  id: string;
  version: number;
  name: string;
  readingTimeSeconds: number;
  questionTimeSeconds: number;
  recordingEnabled: boolean;
  stations: InterviewStation[];
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
  questions: InterviewQuestion[];
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
export interface InterviewSnapshotQuestion extends InterviewPlacement {
  question: InterviewRichText;
  prompt: InterviewRichText;
  rubric: InterviewRichText;
  rubricVersion: number;
}
export interface InterviewSnapshotStation
  extends Omit<InterviewStation, "questions"> {
  questions: InterviewSnapshotQuestion[];
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
export interface InterviewAttempt {
  id: string;
  studentId: string;
  stationId: string;
  version: number;
  score: number | null;
  notAssessedReason: string | null;
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
  attempts: InterviewAttempt[];
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
  attempts: InterviewAttempt[];
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
      type: "saveQuestion";
      question: Omit<
        InterviewQuestion,
        "version" | "rubricVersion" | "updatedAt"
      >;
    })
  | (VersionedCommand & {
      type: "saveRubric";
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
