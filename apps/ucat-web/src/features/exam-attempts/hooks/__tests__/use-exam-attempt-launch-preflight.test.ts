import { act, renderHook } from "@testing-library/react";
import { discardExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { useExamAttemptLaunchPreflight } from "@/features/exam-attempts/hooks/use-exam-attempt-launch-preflight";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";

const mockRefresh = jest.fn(async () => undefined);
const mockClearLocal = jest.fn();
let mockActive: ActiveExamAttempt | null = null;

jest.mock("@/features/exam-attempts/api/exam-attempts-api", () => ({
  discardExamAttempt: jest.fn(),
}));

jest.mock(
  "@/features/exam-attempts/context/active-exam-attempt-context",
  () => ({
    useActiveExamAttempt: () => ({
      active: mockActive,
      refresh: mockRefresh,
      clearLocal: mockClearLocal,
    }),
  }),
);

const mockDiscardExamAttempt = jest.mocked(discardExamAttempt);
const conflictingAttempt = {
  kind: "practice",
  attemptId: "practice-1",
  resourceId: "practice-1",
  label: "Practice · Verbal Reasoning",
  engineSnapshot: { phase: "question" },
} as ActiveExamAttempt;

describe("useExamAttemptLaunchPreflight", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActive = null;
    mockDiscardExamAttempt.mockResolvedValue();
  });

  it("launches immediately when the active attempt is the requested resource", () => {
    mockActive = {
      ...conflictingAttempt,
      kind: "set",
      resourceId: "set-1",
    };
    const onLaunch = jest.fn();
    const { result } = renderHook(() =>
      useExamAttemptLaunchPreflight({
        kind: "set",
        resourceId: "set-1",
        onLaunch,
      }),
    );

    act(() => result.current.requestLaunch());

    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(result.current.conflictActive).toBeNull();
  });

  it("treats a different Study plan prescription for the same set as a conflict", () => {
    mockActive = {
      ...conflictingAttempt,
      kind: "set",
      resourceId: "set-1",
      studyPlanTaskId: "task-old",
    };
    const onLaunch = jest.fn();
    const { result } = renderHook(() =>
      useExamAttemptLaunchPreflight({
        kind: "set",
        resourceId: "set-1",
        studyPlanTaskId: "task-new",
        onLaunch,
      }),
    );

    act(() => result.current.requestLaunch());

    expect(onLaunch).not.toHaveBeenCalled();
    expect(result.current.conflictActive).toBe(mockActive);
  });

  it("shows the conflict before navigation and launches after discarding", async () => {
    mockActive = conflictingAttempt;
    const onLaunch = jest.fn();
    const { result } = renderHook(() =>
      useExamAttemptLaunchPreflight({
        kind: "mock",
        resourceId: "mock-1",
        onLaunch,
      }),
    );

    act(() => result.current.requestLaunch());
    expect(onLaunch).not.toHaveBeenCalled();
    expect(result.current.conflictActive).toBe(conflictingAttempt);

    await act(async () => {
      await result.current.discardConflictAndLaunch();
    });

    expect(mockDiscardExamAttempt).toHaveBeenCalledWith({
      kind: "practice",
      attemptId: "practice-1",
    });
    expect(mockClearLocal).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(onLaunch).toHaveBeenCalledTimes(1);
  });

  it("clears a finished results-phase attempt and launches without conflict", () => {
    mockActive = {
      kind: "mock",
      attemptId: "mock-attempt-1",
      resourceId: "mock-1",
      label: "Study plan golden mock 2",
      engineSnapshot: { phase: "mockScore" },
    } as ActiveExamAttempt;
    const onLaunch = jest.fn();
    const { result } = renderHook(() =>
      useExamAttemptLaunchPreflight({
        kind: "set",
        resourceId: "set-1",
        onLaunch,
      }),
    );

    act(() => result.current.requestLaunch());

    expect(mockClearLocal).toHaveBeenCalledTimes(1);
    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(result.current.conflictActive).toBeNull();
  });
});
