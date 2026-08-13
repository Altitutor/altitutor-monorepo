import { act, renderHook, waitFor } from "@testing-library/react";
import {
  createElement,
  StrictMode,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  beginExamAttempt,
  fetchActiveExamAttempt,
  syncExamAttempt,
} from "@/features/exam-attempts/api/exam-attempts-api";
import {
  getExamSnapshotSyncDelay,
  isCurrentSegmentSyncResponse,
  sanitizeEngineSnapshotForExam,
  useExamAttemptLifecycle,
} from "@/features/exam-attempts/hooks/use-exam-attempt-lifecycle";
import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import { PracticeSessionEndedError } from "@/lib/ucat/practice-sessions/practice-session-ended";

const mockReplace = jest.fn();
const mockRefresh = jest.fn(async () => undefined);
const mockSetLocal = jest.fn();
const mockUpdateLocal = jest.fn();
const mockClearLocal = jest.fn();
const mockOpenQuotaLimit = jest.fn();
const mockToast = jest.fn();
let mockActive: ActiveExamAttempt | null = null;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/features/exam-attempts/api/exam-attempts-api", () => ({
  beginExamAttempt: jest.fn(),
  fetchActiveExamAttempt: jest.fn(),
  finalizeExamAttempt: jest.fn(),
  syncExamAttempt: jest.fn(),
  syncExamAttemptKeepalive: jest.fn(),
}));

jest.mock(
  "@/features/exam-attempts/context/active-exam-attempt-context",
  () => ({
    useActiveExamAttempt: () => ({
      active: mockActive,
      refresh: mockRefresh,
      setLocal: mockSetLocal,
      updateLocal: mockUpdateLocal,
      clearLocal: mockClearLocal,
    }),
  }),
);

jest.mock("@/features/ucat-access/context/upsell-dialog-context", () => ({
  useQuotaLimitDialog: () => ({ openQuotaLimit: mockOpenQuotaLimit }),
}));

jest.mock("@altitutor/ui", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockBeginExamAttempt = jest.mocked(beginExamAttempt);
const mockFetchActiveExamAttempt = jest.mocked(fetchActiveExamAttempt);
const mockSyncExamAttempt = jest.mocked(syncExamAttempt);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function StrictModeWrapper({ children }: { children: ReactNode }) {
  return createElement(StrictMode, null, children);
}

function createState(): QuestionEngineState {
  return {
    phase: "instructions",
    instructionsIndex: 0,
    showReadyDialog: false,
    timerStartedAt: Date.now(),
    showTimeExpiredDialog: false,
    nextSegmentTimerStartedAt: null,
    currentIndex: 0,
    visitedQuestionIds: [],
    flaggedIds: [],
    selectedAnswers: {},
    placementSnapshots: {},
    showNavigator: false,
    showCalculator: false,
    showEndExamDialog: false,
    reviewFilter: null,
    reviewFilterIndex: 0,
    reviewFilterIndicesSnapshot: null,
    showNoFlaggedDialog: false,
    showReviewInstructionsDialog: false,
    showEndReviewDialog: false,
    viewingQuestionIndex: null,
  };
}

const exam: QuestionEngineExam = {
  sourceType: "set",
  sourceId: "set-1",
  title: "Timed set",
  instructionsScreens: [{ instructionsJson: null }],
  setModeTiming: {
    instructionsTimeLimitSeconds: 60,
    setTimeLimitSeconds: 600,
  },
  questions: [
    {
      id: "question-1",
      index: 0,
      questionSetId: "set-1",
      stemId: "stem-1",
      sectionName: "Decision Making",
      sectionDisplayColumns: 1,
      stemText: "Stem",
      questionText: "Question",
      responseType: "multiple_choice",
      answerScheme: "single_choice",
      options: [
        { id: "option-1", index: 0, text: "A", answerKeyValue: "correct" },
        { id: "option-2", index: 1, text: "B", answerKeyValue: null },
      ],
    },
  ],
};

function createAttempt(
  state: QuestionEngineState,
  currentSegmentEndsAt: string | null = "2099-07-17T12:01:00.000Z",
): ActiveExamAttempt {
  return {
    kind: "set",
    attemptId: "attempt-1",
    resourceId: exam.sourceId,
    label: exam.title,
    resumeHref: "/sets/set-1",
    resultsHref: "/sets/set-1/attempts/attempt-1",
    currentSegmentEndsAt,
    engineSnapshot: {
      phase: state.phase,
      instructionsIndex: state.instructionsIndex,
      showReadyDialog: state.showReadyDialog,
      showTimeExpiredDialog: state.showTimeExpiredDialog,
      nextSegmentTimerStartedAt: state.nextSegmentTimerStartedAt,
      currentIndex: state.currentIndex,
      visitedQuestionIds: state.visitedQuestionIds,
      flaggedIds: state.flaggedIds,
      selectedAnswers: state.selectedAnswers,
      placementSnapshots: state.placementSnapshots,
      reviewFilter: state.reviewFilter,
      reviewFilterIndex: state.reviewFilterIndex,
      reviewFilterIndicesSnapshot: state.reviewFilterIndicesSnapshot,
      viewingQuestionIndex: state.viewingQuestionIndex,
    },
    mockAttemptId: null,
    setAttemptIdsBySetId: { "set-1": "set-attempt-1" },
    practiceSessionId: null,
    wasTimed: true,
  };
}

function useLifecycleHarness() {
  const [state, setState] = useState(createState);
  const attemptStateRef = useRef({
    mockAttemptId: null as string | null,
    setAttemptIdsBySetId: new Map<string, string>(),
  });
  const lifecycle = useExamAttemptLifecycle({
    enabled: true,
    exam,
    state,
    setState,
    practice: false,
    attemptStateRef,
  });
  return { state, setState, lifecycle };
}

const practiceExam: QuestionEngineExam = {
  ...exam,
  sourceType: "questionStem",
  sourceId: "practice-source",
  title: "Practice",
  setModeTiming: undefined,
};

function usePracticeLifecycleHarness() {
  const [state, setState] = useState<QuestionEngineState>(() => ({
    ...createState(),
    phase: "question",
    timerStartedAt: null,
    visitedQuestionIds: ["question-1"],
  }));
  const attemptStateRef = useRef({
    mockAttemptId: null as string | null,
    setAttemptIdsBySetId: new Map<string, string>(),
  });
  const lifecycle = useExamAttemptLifecycle({
    enabled: true,
    exam: practiceExam,
    state,
    setState,
    practice: true,
    practiceSessionId: "practice-session-1",
    attemptStateRef,
  });
  return { state, setState, lifecycle };
}

describe("useExamAttemptLifecycle request races", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActive = null;
    mockFetchActiveExamAttempt.mockResolvedValue(null);
    mockSyncExamAttempt.mockResolvedValue({
      currentSegmentEndsAt: "2026-07-17T12:10:00.000Z",
    });
  });

  it("keeps a single begin request and does not restore instructions after advancing", async () => {
    const pendingBegin =
      deferred<Awaited<ReturnType<typeof beginExamAttempt>>>();
    const instructionsState = createState();
    mockBeginExamAttempt.mockReturnValue(pendingBegin.promise);

    const { result, unmount } = renderHook(useLifecycleHarness);

    await waitFor(() => expect(mockBeginExamAttempt).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setState((current) => ({
        ...current,
        phase: "question",
        timerStartedAt: Date.now(),
        visitedQuestionIds: ["question-1"],
      }));
    });

    expect(result.current.state.phase).toBe("question");
    expect(mockBeginExamAttempt).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingBegin.resolve({
        attempt: createAttempt(instructionsState),
        resumed: false,
      });
      await pendingBegin.promise;
    });

    await waitFor(() =>
      expect(result.current.lifecycle.attemptId).toBe("attempt-1"),
    );
    expect(mockBeginExamAttempt).toHaveBeenCalledTimes(1);
    expect(result.current.state).toMatchObject({
      phase: "question",
      visitedQuestionIds: ["question-1"],
    });
    expect(mockSetLocal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentSegmentEndsAt: null,
        engineSnapshot: expect.objectContaining({
          phase: "question",
          visitedQuestionIds: ["question-1"],
        }),
      }),
    );
    await waitFor(() =>
      expect(mockSyncExamAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          currentSegmentEndsAt: null,
          startSegmentTimeLimitSeconds: 600,
          engineSnapshot: expect.objectContaining({ phase: "question" }),
        }),
      ),
    );

    unmount();
  });

  it("restores the server snapshot despite automatic local startup changes", async () => {
    const instructionsState = createState();
    const activeAttempt = createAttempt(instructionsState);
    const pendingActiveFetch = deferred<ActiveExamAttempt | null>();
    mockActive = activeAttempt;
    mockFetchActiveExamAttempt.mockReturnValue(pendingActiveFetch.promise);

    const { result, unmount } = renderHook(useLifecycleHarness);

    await waitFor(() =>
      expect(mockFetchActiveExamAttempt).toHaveBeenCalledTimes(1),
    );

    act(() => {
      result.current.setState((current) => ({
        ...current,
        phase: "question",
        timerStartedAt: Date.now(),
        selectedAnswers: { "question-1": "option-1" },
      }));
    });

    await act(async () => {
      pendingActiveFetch.resolve(activeAttempt);
      await pendingActiveFetch.promise;
    });

    await waitFor(() =>
      expect(result.current.lifecycle.isHydrating).toBe(false),
    );
    expect(mockBeginExamAttempt).not.toHaveBeenCalled();
    expect(result.current.state).toMatchObject({
      phase: "instructions",
      selectedAnswers: {},
    });
    expect(mockSetLocal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentSegmentEndsAt: "2099-07-17T12:01:00.000Z",
        engineSnapshot: expect.objectContaining({
          phase: "instructions",
          selectedAnswers: {},
        }),
      }),
    );

    unmount();
  });

  it("waits for an in-flight begin before flushing question timing", async () => {
    const pendingBegin =
      deferred<Awaited<ReturnType<typeof beginExamAttempt>>>();
    const instructionsState = createState();
    mockBeginExamAttempt.mockReturnValue(pendingBegin.promise);

    const { result, unmount } = renderHook(useLifecycleHarness);

    await waitFor(() => expect(mockBeginExamAttempt).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setState((current) => ({
        ...current,
        phase: "question",
        timerStartedAt: Date.now(),
        visitedQuestionIds: ["question-1"],
      }));
    });

    let flushPromise!: Promise<boolean>;
    act(() => {
      flushPromise = result.current.lifecycle.flushQuestionTiming();
    });
    expect(mockSyncExamAttempt).not.toHaveBeenCalled();

    await act(async () => {
      pendingBegin.resolve({
        attempt: createAttempt(instructionsState),
        resumed: false,
      });
      await pendingBegin.promise;
      await flushPromise;
    });

    expect(mockSyncExamAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: "attempt-1",
        questionActiveTiming: null,
      }),
    );

    unmount();
  });

  it("opens timing for the first practice question after begin resolves", async () => {
    const initialState: QuestionEngineState = {
      ...createState(),
      phase: "question",
      timerStartedAt: null,
      visitedQuestionIds: ["question-1"],
    };
    mockBeginExamAttempt.mockResolvedValue({
      attempt: {
        ...createAttempt(initialState, null),
        kind: "practice",
        attemptId: "practice-session-1",
        resourceId: "practice-session-1",
        label: "Practice",
        currentSegmentEndsAt: null,
        engineSnapshot: initialState,
        setAttemptIdsBySetId: {},
        practiceSessionId: "practice-session-1",
        wasTimed: false,
      },
      resumed: false,
    });

    const { result, unmount } = renderHook(usePracticeLifecycleHarness, {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() =>
      expect(mockSyncExamAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "practice",
          attemptId: "practice-session-1",
          questionActiveTiming: expect.objectContaining({
            questionId: "question-1",
            wasTimed: false,
          }),
        }),
      ),
    );

    mockSyncExamAttempt.mockClear();
    act(() => {
      result.current.setState((current) => ({
        ...current,
        selectedAnswers: { "question-1": "option-1" },
      }));
    });

    await waitFor(
      () =>
        expect(mockSyncExamAttempt).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: "practice",
            attemptId: "practice-session-1",
            engineSnapshot: expect.objectContaining({
              selectedAnswers: { "question-1": "option-1" },
              responseSnapshots: {
                "question-1": expect.objectContaining({
                  type: "ucat_response_v1",
                }),
              },
            }),
          }),
        ),
      { timeout: 2_500 },
    );

    unmount();
  });

  it("applies a resumed begin snapshot despite mount-time local changes", async () => {
    const savedState: QuestionEngineState = {
      ...createState(),
      phase: "question",
      timerStartedAt: null,
      visitedQuestionIds: ["question-1"],
      selectedAnswers: { "question-1": "option-1" },
    };
    const pendingBegin =
      deferred<Awaited<ReturnType<typeof beginExamAttempt>>>();
    mockBeginExamAttempt.mockReturnValue(pendingBegin.promise);

    const { result, unmount } = renderHook(usePracticeLifecycleHarness);
    await waitFor(() => expect(mockBeginExamAttempt).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setState((current) => ({
        ...current,
        showCalculator: true,
      }));
    });

    await act(async () => {
      pendingBegin.resolve({
        attempt: {
          ...createAttempt(savedState, null),
          kind: "practice",
          attemptId: "practice-session-1",
          resourceId: "practice-session-1",
          label: "Practice",
          engineSnapshot: createAttempt(savedState, null).engineSnapshot,
          setAttemptIdsBySetId: {},
          practiceSessionId: "practice-session-1",
          wasTimed: false,
        },
        resumed: true,
      });
      await pendingBegin.promise;
    });

    await waitFor(() =>
      expect(result.current.state.selectedAnswers).toEqual({
        "question-1": "option-1",
      }),
    );
    expect(result.current.state.responseSnapshots?.["question-1"]).toEqual(
      expect.objectContaining({ type: "ucat_response_v1" }),
    );
    expect(result.current.state.showCalculator).toBe(true);

    unmount();
  });

  it("restores saved practice answers when local UI state changes during resume", async () => {
    const savedState: QuestionEngineState = {
      ...createState(),
      phase: "question",
      timerStartedAt: null,
      visitedQuestionIds: ["question-1"],
      selectedAnswers: { "question-1": "option-1" },
    };
    const activePracticeAttempt: ActiveExamAttempt = {
      ...createAttempt(savedState, null),
      kind: "practice",
      attemptId: "practice-session-1",
      resourceId: "practice-session-1",
      label: "Practice",
      engineSnapshot: createAttempt(savedState, null).engineSnapshot,
      setAttemptIdsBySetId: {},
      practiceSessionId: "practice-session-1",
      wasTimed: false,
    };
    const pendingActiveFetch = deferred<ActiveExamAttempt | null>();
    mockActive = activePracticeAttempt;
    mockFetchActiveExamAttempt.mockReturnValue(pendingActiveFetch.promise);

    const { result, unmount } = renderHook(usePracticeLifecycleHarness);
    await waitFor(() =>
      expect(mockFetchActiveExamAttempt).toHaveBeenCalledTimes(1),
    );

    act(() => {
      result.current.setState((current) => ({
        ...current,
        showCalculator: true,
      }));
    });

    await act(async () => {
      pendingActiveFetch.resolve(activePracticeAttempt);
      await pendingActiveFetch.promise;
    });

    await waitFor(() =>
      expect(result.current.lifecycle.isHydrating).toBe(false),
    );
    expect(result.current.state.selectedAnswers).toEqual({
      "question-1": "option-1",
    });
    expect(result.current.state.showCalculator).toBe(true);

    unmount();
  });

  it("stops a stale practice session and routes back to practice", async () => {
    mockBeginExamAttempt.mockRejectedValue(new PracticeSessionEndedError());

    const { unmount } = renderHook(usePracticeLifecycleHarness);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Practice session ended",
        description:
          "This session ended in another tab or device. Start a new session to continue practising.",
      }),
    );

    expect(mockClearLocal).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/practice");
    expect(mockSyncExamAttempt).not.toHaveBeenCalled();

    unmount();
  });
});

describe("getExamSnapshotSyncDelay", () => {
  it("debounces ordinary updates but enforces a maximum wait", () => {
    expect(getExamSnapshotSyncDelay(1_000, 1_100)).toBe(800);
    expect(getExamSnapshotSyncDelay(1_000, 2_700)).toBe(300);
    expect(getExamSnapshotSyncDelay(1_000, 3_100)).toBe(0);
  });
});

describe("isCurrentSegmentSyncResponse", () => {
  it("rejects a question-section deadline that resolves after instructions begin", () => {
    expect(
      isCurrentSegmentSyncResponse(
        "mock-set-0-questions",
        "mock-instructions-2",
      ),
    ).toBe(false);
  });

  it("accepts the deadline for the segment that is still displayed", () => {
    expect(
      isCurrentSegmentSyncResponse(
        "mock-instructions-2",
        "mock-instructions-2",
      ),
    ).toBe(true);
  });
});

describe("sanitizeEngineSnapshotForExam", () => {
  it("restores a new set with instructions onto its instruction screen", () => {
    const fresh = createAttempt(createState()).engineSnapshot;
    fresh.phase = "intro";
    fresh.showReadyDialog = false;

    expect(sanitizeEngineSnapshotForExam(exam, fresh)).toMatchObject({
      phase: "instructions",
      instructionsIndex: 0,
      showReadyDialog: false,
    });
  });

  it("drops answers and navigation state for questions outside the loaded exam", () => {
    const stale = createAttempt(createState()).engineSnapshot;
    stale.currentIndex = 99;
    stale.viewingQuestionIndex = 99;
    stale.visitedQuestionIds = ["stale-question", "question-1"];
    stale.flaggedIds = ["stale-question"];
    stale.selectedAnswers = {
      "stale-question": "stale-option",
      "question-1": "option-1",
    };
    stale.placementSnapshots = {
      "stale-question": { "stale-option": "yes" },
    };

    expect(sanitizeEngineSnapshotForExam(exam, stale)).toMatchObject({
      currentIndex: 0,
      viewingQuestionIndex: 0,
      visitedQuestionIds: ["question-1"],
      flaggedIds: [],
      selectedAnswers: { "question-1": "option-1" },
      placementSnapshots: {},
    });
  });

  it("restores canonical answers as engine projections for catch-up and resume", () => {
    const stored = createAttempt(createState()).engineSnapshot;
    stored.selectedAnswers = {};
    stored.responseSnapshots = {
      "question-1": {
        type: "ucat_response_v1",
        questionId: "question-1",
        answerScheme: "single_choice",
        response: { kind: "single_select", selectedOptionId: "option-1" },
      },
    };

    expect(sanitizeEngineSnapshotForExam(exam, stored)).toMatchObject({
      selectedAnswers: { "question-1": "option-1" },
      responseSnapshots: {
        "question-1": expect.objectContaining({ type: "ucat_response_v1" }),
      },
    });
  });
});
