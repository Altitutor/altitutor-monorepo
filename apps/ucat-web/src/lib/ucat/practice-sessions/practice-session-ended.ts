export const PRACTICE_SESSION_ENDED_CODE = "PRACTICE_SESSION_ENDED" as const;

export const PRACTICE_SESSION_ENDED_MESSAGE = "This practice session has ended";

export class PracticeSessionEndedError extends Error {
  readonly code = PRACTICE_SESSION_ENDED_CODE;

  constructor() {
    super(PRACTICE_SESSION_ENDED_MESSAGE);
    this.name = "PracticeSessionEndedError";
  }
}
