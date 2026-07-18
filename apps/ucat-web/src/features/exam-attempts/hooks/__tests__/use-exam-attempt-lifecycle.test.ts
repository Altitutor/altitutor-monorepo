import { act, renderHook, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import {
  beginExamAttempt,
  fetchActiveExamAttempt,
  syncExamAttempt,
} from "@/features/exam-attempts/api/exam-attempts-api";
import { useExamAttemptLifecycle } from "@/features/exam-attempts/hooks/use-exam-attempt-lifecycle";
import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";

const mockReplace = jest.fn();
const mockRefresh = jest.fn(async () => undefined);
const mockSetLocal = jest.fn();
const mockUpdateLocal = jest.fn();
const mockClearLocal = jest.fn();
const mockOpenQuotaLimit = jest.fn();
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
    syllogismSnapshots: {},
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
    showExitResultsDialog: false,
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
      questionType: "multiple_choice",
      options: [],
    },
  ],
};

function createAttempt(
  state: QuestionEngineState,
  currentSegmentEndsAt = "2099-07-17T12:01:00.000Z",
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
      syllogismSnapshots: state.syllogismSnapshots,
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

  it("does not let a delayed resume hydration overwrite local navigation", async () => {
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
      phase: "question",
      selectedAnswers: { "question-1": "option-1" },
    });
    expect(mockSetLocal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentSegmentEndsAt: null,
        engineSnapshot: expect.objectContaining({
          phase: "question",
          selectedAnswers: { "question-1": "option-1" },
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
});
