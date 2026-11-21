import type { InterviewRound, InterviewRoundSetup, StudentInterviewRound } from "./index";

/** List/calendar data deliberately excludes assessment, station and media bodies. */
export type TutorInterviewRoundSummary = Pick<InterviewRound,
  keyof InterviewRoundSetup | "id" | "version" | "createdBy" | "createdAt" | "updatedAt" |
  "startedAt" | "phase" | "readingTimeSeconds" | "questionTimeSeconds" | "students" | "tutors"
> & { stationCount: number; releasedResultCount: number };

/** A student's release availability is projected without exposing the release itself. */
export type StudentInterviewRoundSummary = Pick<StudentInterviewRound,
  "id" | "name" | "version" | "delivery" | "mode" | "recordingEnabled" |
  "scheduledAt" | "scheduledEndAt" | "startedAt" | "phase"
> & { stationCount: number; hasReleasedResults: boolean };
