import { act, renderHook } from "@testing-library/react";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
import { useLeaveGuard } from "@/features/skill-trainer/hooks/use-leave-guard";

jest.mock("@/features/skill-trainer/api/skill-trainer-api", () => ({
  skillTrainerApi: {
    discardAttempt: jest.fn(),
  },
}));

const mockDiscardAttempt = jest.mocked(skillTrainerApi.discardAttempt);

describe("useLeaveGuard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockDiscardAttempt.mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("discards an active run after the student confirms exit", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() => useLeaveGuard(true, "attempt-1"));

    await act(async () => {
      await expect(result.current.confirmDiscard()).resolves.toBe(true);
    });

    expect(mockDiscardAttempt).toHaveBeenCalledWith("attempt-1", {
      keepalive: false,
    });
  });

  it("uses a keepalive discard when an active play page unmounts", async () => {
    const { unmount } = renderHook(() => useLeaveGuard(true, "attempt-1"));

    unmount();
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(mockDiscardAttempt).toHaveBeenCalledWith("attempt-1", {
      keepalive: true,
    });
  });

  it("does not discard a completed or inactive run on unmount", () => {
    const { unmount } = renderHook(() => useLeaveGuard(false, "attempt-1"));

    unmount();
    act(() => jest.runOnlyPendingTimers());

    expect(mockDiscardAttempt).not.toHaveBeenCalled();
  });
});
