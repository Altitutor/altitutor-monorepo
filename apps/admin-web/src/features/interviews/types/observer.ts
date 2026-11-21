import type {
  InterviewRound,
  InterviewSnapshotStation,
  InterviewStationAttempt,
  InterviewStationProgress,
} from "@altitutor/shared";

export type AdminInterviewObserverRound = Pick<
  InterviewRound,
  | "id"
  | "version"
  | "name"
  | "delivery"
  | "mode"
  | "recordingEnabled"
  | "scheduledAt"
  | "startedAt"
  | "phase"
  | "rotation"
  | "phaseStartedAt"
  | "phaseDeadline"
  | "pausedAt"
  | "remainingMilliseconds"
  | "readingTimeSeconds"
  | "questionTimeSeconds"
  | "students"
  | "tutors"
  | "connectedStudentIds"
  | "connectedTutorIds"
  | "serverNow"
  | "recordings"
> & {
  stations: (Pick<InterviewSnapshotStation, "id" | "name" | "maximumPoints"> & {
    questionCount: number;
  })[];
  progress: (InterviewStationProgress & { answeredQuestionCount: number })[];
};

export interface AdminInterviewObserverContent {
  station: InterviewSnapshotStation;
  attempt: Pick<
    InterviewStationAttempt,
    | "id"
    | "stationId"
    | "studentId"
    | "score"
    | "notAssessedReason"
    | "generalFeedback"
    | "feedback"
  > | null;
}

export interface AdminInterviewObserverState {
  id: string;
  round: AdminInterviewObserverRound;
  selectedStationId: string | null;
  contentRevision: string | null;
  /** Unchanged content is omitted by the server and retained only in its scoped query. */
  content: AdminInterviewObserverContent | null;
  /** Client receipt time survives placeholder data when switching query keys. */
  receivedAt?: number;
}
