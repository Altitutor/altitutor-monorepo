import { act, renderHook, waitFor } from "@testing-library/react";
import { discardExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { useExamAttemptLaunchGate } from "@/features/exam-attempts/hooks/use-exam-attempt-launch-gate";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";

const mockRefresh = jest.fn(async () => undefined);
const mockClearLocal = jest.fn();

const mockConflictingAttempt = {
  kind: "set",
  attemptId: "attempt-1",
  resourceId: "set-1",
  label: "Existing set",
  engineSnapshot: { phase: "question" },
} as ActiveExamAttempt;
let mockActive: ActiveExamAttempt | null = mockConflictingAttempt;

jest.mock("@/features/exam-attempts/api/exam-attempts-api", () => ({
  discardExamAttempt: jest.fn(),
}));

jest.mock(
  "@/features/exam-attempts/context/active-exam-attempt-context",
  () => ({
    useActiveExamAttempt: () => ({
      active: mockActive,
      isLoading: false,
      refresh: mockRefresh,
      clearLocal: mockClearLocal,
    }),
  }),
);

const mockDiscardExamAttempt = jest.mocked(discardExamAttempt);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useExamAttemptLaunchGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActive = mockConflictingAttempt;
    mockClearLocal.mockImplementation(() => {
      mockActive = null;
    });
  });

  it("keeps discard-and-continue single-flight across repeated clicks", async () => {
    const pendingDiscard = deferred<void>();
    mockDiscardExamAttempt.mockReturnValue(pendingDiscard.promise);
    const { result } = renderHook(() =>
      useExamAttemptLaunchGate("mock", "mock-1"),
    );

    await waitFor(() => expect(result.current.launchAllowed).toBe(false));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.discardConflictAndContinue();
      second = result.current.discardConflictAndContinue();
    });

    expect(mockDiscardExamAttempt).toHaveBeenCalledTimes(1);
    expect(mockDiscardExamAttempt).toHaveBeenCalledWith({
      kind: "set",
      attemptId: "attempt-1",
    });

    await act(async () => {
      pendingDiscard.resolve();
      await Promise.all([first, second]);
    });

    expect(mockClearLocal).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.launchAllowed).toBe(true);
    expect(result.current.isDiscardingConflict).toBe(false);
  });

  it("allows launch when the lingering active attempt is already at results", async () => {
    mockActive = {
      kind: "mock",
      attemptId: "mock-attempt-1",
      resourceId: "mock-1",
      label: "Study plan golden mock 2",
      engineSnapshot: { phase: "mockScore" },
    } as ActiveExamAttempt;

    const { result } = renderHook(() =>
      useExamAttemptLaunchGate("set", "set-1"),
    );

    await waitFor(() => expect(result.current.launchAllowed).toBe(true));
    expect(result.current.conflictActive).toBeNull();
    expect(mockClearLocal).toHaveBeenCalled();
  });
});
