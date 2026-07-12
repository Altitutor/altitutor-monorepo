export type PracticeActiveQuestionTiming = {
  questionId: string;
  startedAt: string;
  segmentEndsAt: string | null;
};

export type PracticeQuestionTimingData = {
  persistedSecondsByQuestionId: Record<string, number>;
  activeQuestionTiming: PracticeActiveQuestionTiming | null;
  submittedQuestionIds: string[];
};

export function getOpenIntervalSeconds(
  active: PracticeActiveQuestionTiming,
  nowMs: number = Date.now(),
): number {
  const startedMs = new Date(active.startedAt).getTime();
  if (!Number.isFinite(startedMs)) return 0;
  const segmentEndMs = active.segmentEndsAt
    ? new Date(active.segmentEndsAt).getTime()
    : null;
  const requestedEndMs =
    segmentEndMs != null && Number.isFinite(segmentEndMs)
      ? Math.min(nowMs, segmentEndMs)
      : nowMs;
  return Math.max(0, Math.floor((requestedEndMs - startedMs) / 1000));
}

export function getQuestionDisplaySeconds(
  questionId: string,
  persistedSecondsByQuestionId: Record<string, number>,
  activeQuestionTiming: PracticeActiveQuestionTiming | null | undefined,
  nowMs: number = Date.now(),
): number {
  const persistedSeconds = Math.max(
    0,
    persistedSecondsByQuestionId[questionId] ?? 0,
  );
  if (
    !activeQuestionTiming ||
    activeQuestionTiming.questionId !== questionId
  ) {
    return persistedSeconds;
  }
  return persistedSeconds + getOpenIntervalSeconds(activeQuestionTiming, nowMs);
}

export type ClientPracticeQuestionTiming = {
  secondsByQuestionId: Record<string, number>;
  activeQuestionId: string | null;
  activeStartedAtMs: number | null;
};

export const EMPTY_CLIENT_PRACTICE_QUESTION_TIMING: ClientPracticeQuestionTiming =
  {
    secondsByQuestionId: {},
    activeQuestionId: null,
    activeStartedAtMs: null,
  };

export function flushActiveClientPracticeQuestionTiming(
  state: ClientPracticeQuestionTiming,
  nowMs: number = Date.now(),
): ClientPracticeQuestionTiming {
  if (!state.activeQuestionId || state.activeStartedAtMs == null) {
    return {
      ...state,
      activeQuestionId: null,
      activeStartedAtMs: null,
    };
  }

  const elapsed = Math.max(
    0,
    Math.floor((nowMs - state.activeStartedAtMs) / 1000),
  );
  return {
    secondsByQuestionId: {
      ...state.secondsByQuestionId,
      [state.activeQuestionId]:
        (state.secondsByQuestionId[state.activeQuestionId] ?? 0) + elapsed,
    },
    activeQuestionId: null,
    activeStartedAtMs: null,
  };
}

export function switchClientPracticeQuestionTiming(
  state: ClientPracticeQuestionTiming,
  nextQuestionId: string,
  nowMs: number = Date.now(),
): ClientPracticeQuestionTiming {
  const flushed = flushActiveClientPracticeQuestionTiming(state, nowMs);
  return {
    ...flushed,
    activeQuestionId: nextQuestionId,
    activeStartedAtMs: nowMs,
  };
}

export function getClientPracticeQuestionDisplaySeconds(
  questionId: string,
  state: ClientPracticeQuestionTiming,
  nowMs: number = Date.now(),
): number {
  const persistedSeconds = Math.max(0, state.secondsByQuestionId[questionId] ?? 0);
  if (
    state.activeQuestionId !== questionId ||
    state.activeStartedAtMs == null
  ) {
    return persistedSeconds;
  }
  const openSeconds = Math.max(
    0,
    Math.floor((nowMs - state.activeStartedAtMs) / 1000),
  );
  return persistedSeconds + openSeconds;
}
