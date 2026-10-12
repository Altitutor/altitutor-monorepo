import React from "react";
import { captureException } from "@sentry/nextjs";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SkillTrainerPlayPage } from "../skill-trainer-play-page";
import type { SkillTrainerAttemptState } from "../../types/attempt";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockQueryClient = { invalidateQueries: jest.fn() };
const mockCompanion = {
  reportActivityCompletion: jest.fn(),
  setActivityComplete: jest.fn(),
};
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockQueryClient,
}));
jest.mock("@/features/layout/context/sidebar-override-context", () => ({
  useSidebarOverride: () => null,
}));
jest.mock("@/features/study-plan/context/study-plan-companion-context", () => ({
  useStudyPlanCompanion: () => mockCompanion,
}));
jest.mock("@altitutor/ui", () => ({
  Skeleton: () => <div>Loading</div>,
  MentalMathsTrainer: ({
    onChange,
    onSubmit,
    disabled,
  }: {
    onChange: (value: string) => void;
    onSubmit: () => void;
    disabled: boolean;
  }) => (
    <div>
      <button disabled={disabled} onClick={() => onChange("2")}>
        Enter answer
      </button>
      <button disabled={disabled} onClick={onSubmit}>
        Submit answer
      </button>
    </div>
  ),
}));
jest.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
}));
jest.mock("../skill-trainer-score-bar", () => ({
  SkillTrainerScoreBar: ({ onExit }: { onExit?: () => void }) => (
    <button onClick={onExit}>Exit</button>
  ),
}));
jest.mock("../score-bar-feedback", () => ({ ScoreBarFeedback: () => null }));
jest.mock("@/features/question-engine/components/rich-content-block", () => ({
  RichContentBlock: () => null,
}));

const ATTEMPT_ID = "00000000-0000-4000-8000-000000000001";
function activeAttempt(): SkillTrainerAttemptState {
  return {
    attempt: {
      id: ATTEMPT_ID,
      student_id: "student",
      skill_trainer_id: "trainer",
      score: 0,
      streak_count: 0,
      item_queue_snapshot: ["item"],
      current_item_index: 0,
      current_item_started_at: "2026-10-11T06:11:49.341Z",
      progress: null,
      config_snapshot: {
        time_limit_seconds: 41,
        points_correct: 10,
        points_wrong: 0,
        streak_enabled: false,
        streak_multiplier_steps: [],
        speed_bonus_enabled: false,
        speed_bonus_max_points: 0,
        speed_bonus_window_seconds: 0,
        trainer_key: "mental_maths",
      },
      ends_at: "2026-10-11T06:12:30.115Z",
      started_at: "2026-10-11T06:11:49.341Z",
      completed_at: null,
      discarded_at: null,
      version: 0,
    },
    currentItem: { id: "item", content: { expression: "1+1", answer: 2 } },
    nextItem: null,
    remainingSeconds: 41,
    isExpired: false,
    isCompleted: false,
  };
}
const response = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("SkillTrainerPlayPage attempt lifetime", () => {
  let discarded: boolean;
  let serverState: SkillTrainerAttemptState;
  let getStatus: number;
  let actionStatus: number;
  let getFailure: Error | null;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-11T06:11:49.341Z"));
    jest.clearAllMocks();
    discarded = false;
    serverState = activeAttempt();
    getStatus = 200;
    actionStatus = 200;
    getFailure = null;
    mockFetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        discarded = true;
        return response(200, { success: true });
      }
      if (String(_url).endsWith("/actions"))
        return response(actionStatus, {
          error: "Action rejected",
          attempt: activeAttempt(),
        });
      if (init?.method === "POST")
        return response(200, { attempt: serverState });
      if (getFailure) throw getFailure;
      const completed = activeAttempt();
      completed.isCompleted = true;
      completed.isExpired = true;
      completed.attempt.completed_at = completed.attempt.ends_at;
      return response(
        discarded ? 404 : getStatus,
        discarded ? { error: "Attempt not found" } : { attempt: completed },
      );
    });
    global.fetch = mockFetch;
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: jest.fn(() => ATTEMPT_ID),
    });
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("loads completed results when the same timer reaches an available attempt", async () => {
    render(<SkillTrainerPlayPage trainerKey="mental_maths" />);
    await flush();
    await act(async () => {
      jest.advanceTimersByTime(41_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockRouter.replace).toHaveBeenCalledWith(
      `/skill-trainer/mental-maths/results/${ATTEMPT_ID}`,
    );
  });

  it("stops expiry requests after confirmed exit even when navigation has not unmounted the page", async () => {
    render(<SkillTrainerPlayPage trainerKey="mental_maths" />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    await flush();
    expect(discarded).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(41_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      mockFetch.mock.calls.filter(([, init]) => !init?.method),
    ).toHaveLength(0);
  });

  it("recovers if stale-action reconciliation finds that another page discarded the attempt", async () => {
    render(<SkillTrainerPlayPage trainerKey="mental_maths" />);
    await flush();
    actionStatus = 409;
    discarded = true;
    fireEvent.click(screen.getByRole("button", { name: "Enter answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    await flush();
    expect(
      screen.getByText(
        "This run is no longer available. Return to the trainer to start a new run.",
      ),
    ).toBeInTheDocument();
  });

  it("recovers an action404 while a delayed expiry callback waits beyond the captured server deadline", async () => {
    // Production's server deadline predates discard; a suspended/background page can deliver its timer late.
    jest.setSystemTime(new Date("2026-10-11T06:10:26.413Z"));
    serverState.attempt.started_at = "2026-10-11T06:10:26.413989Z";
    serverState.attempt.ends_at = "2026-10-11T06:11:26.413989Z";
    serverState.attempt.version = 6;
    serverState.remainingSeconds = 60;
    let resolveAction!: (response: Response) => void;
    const pendingAction = new Promise<Response>((resolve) => {
      resolveAction = resolve;
    });
    const ordinaryFetch = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation((url, init) =>
      String(url).endsWith("/actions")
        ? pendingAction
        : ordinaryFetch(url, init),
    );
    render(<SkillTrainerPlayPage trainerKey="mental_maths" />);
    await flush();
    jest.setSystemTime(new Date("2026-10-11T06:11:49.341Z"));
    fireEvent.click(screen.getByRole("button", { name: "Enter answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    await flush();
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(
      mockFetch.mock.calls.filter(([, init]) => !init?.method),
    ).toHaveLength(0);
    await act(async () => {
      resolveAction(response(404, { error: "Attempt not found" }));
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(41_000);
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This run is no longer available.",
    );
    expect(
      mockFetch.mock.calls.filter(([, init]) => !init?.method),
    ).toHaveLength(0);
    expect(
      mockFetch.mock.calls.filter(
        ([url]) => String(url) === "/api/ucat/skill-trainer-attempts",
      ),
    ).toHaveLength(1);
  });

  it.each([200, 500, 409])(
    "keeps discard terminal when a late action%s settles after expiry was waiting",
    async (status) => {
      let resolveAction!: (response: Response) => void;
      const pendingAction = new Promise<Response>((resolve) => {
        resolveAction = resolve;
      });
      const ordinaryFetch = mockFetch.getMockImplementation()!;
      mockFetch.mockImplementation((url, init) =>
        String(url).endsWith("/actions")
          ? pendingAction
          : ordinaryFetch(url, init),
      );
      render(<SkillTrainerPlayPage trainerKey="mental_maths" />);
      await flush();
      fireEvent.click(screen.getByRole("button", { name: "Enter answer" }));
      fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
      await flush();
      await act(async () => {
        jest.advanceTimersByTime(41_000);
        await Promise.resolve();
      });
      fireEvent.click(screen.getByRole("button", { name: "Exit" }));
      await flush();
      await act(async () => {
        resolveAction(
          response(status, {
            error: "Unexpected action failure",
            attempt: activeAttempt(),
          }),
        );
        await Promise.resolve();
      });
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This run is no longer available.",
      );
      expect(
        screen.queryByRole("button", { name: "Submit answer" }),
      ).not.toBeInTheDocument();
      expect(
        mockFetch.mock.calls.filter(([, init]) => !init?.method),
      ).toHaveLength(0);
      expect(
        mockFetch.mock.calls.filter(
          ([url]) => String(url) === "/api/ucat/skill-trainer-attempts",
        ),
      ).toHaveLength(1);
      if (status === 500)
        expect(captureException).toHaveBeenCalledWith(
          expect.objectContaining({ message: "Unexpected action failure" }),
        );
      else expect(captureException).not.toHaveBeenCalled();
    },
  );

  it.each([200, 500])(
    "keeps confirmed discard terminal when a stale-action GET%s arrives late",
    async (status) => {
      let resolveGet!: (response: Response) => void;
      const pendingGet = new Promise<Response>((resolve) => {
        resolveGet = resolve;
      });
      const ordinaryFetch = mockFetch.getMockImplementation()!;
      mockFetch.mockImplementation((url, init) =>
        !init?.method ? pendingGet : ordinaryFetch(url, init),
      );
      render(<SkillTrainerPlayPage trainerKey="mental_maths" />);
      await flush();
      actionStatus = 409;
      fireEvent.click(screen.getByRole("button", { name: "Enter answer" }));
      fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
      await flush();
      expect(
        mockFetch.mock.calls.filter(([, init]) => !init?.method),
      ).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: "Exit" }));
      await flush();
      await act(async () => {
        resolveGet(response(status, { attempt: activeAttempt() }));
        await Promise.resolve();
      });
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This run is no longer available.",
      );
      expect(
        screen.queryByText(
          "This attempt changed in another tab. Your latest state has been restored.",
        ),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Retry loading run" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Submit answer" }),
      ).not.toBeInTheDocument();
      expect(mockRouter.replace).not.toHaveBeenCalled();
      if (status === 500)
        expect(captureException).toHaveBeenCalledWith(
          expect.objectContaining({ message: "Failed to load attempt" }),
        );
    },
  );

  it("recovers the captured action404 then pagehide-discard sequence without a later missing-attempt fetch", async () => {
    render(<SkillTrainerPlayPage trainerKey="mental_maths" />);
    await flush();
    actionStatus = 404;
    fireEvent.click(screen.getByRole("button", { name: "Enter answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    await flush();
    const actionCall = mockFetch.mock.calls.find(([url]) =>
      String(url).endsWith("/actions"),
    );
    expect(actionCall?.[0]).toBe(
      `/api/ucat/skill-trainer-attempts/${ATTEMPT_ID}/actions`,
    );
    expect(JSON.parse(String(actionCall?.[1]?.body))).toEqual({
      actionId: ATTEMPT_ID,
      expectedVersion: 0,
      action: { type: "numeric_answer", answer: 2 },
    });
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(41_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.getByText(
        "This run is no longer available. Return to the trainer to start a new run.",
      ),
    ).toBeInTheDocument();
    expect(
      mockFetch.mock.calls.filter(([, init]) => !init?.method),
    ).toHaveLength(0);
  });

  it.each([500, 401])(
    "keeps unexpected HTTP %s failures visible and reportable, then retries the same run",
    async (status) => {
      render(<SkillTrainerPlayPage trainerKey="mental_maths" />);
      await flush();
      getStatus = status;
      await act(async () => {
        jest.advanceTimersByTime(41_000);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load attempt",
      );
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Failed to load attempt" }),
      );
      getStatus = 200;
      fireEvent.click(
        screen.getByRole("button", { name: "Retry loading run" }),
      );
      await flush();
      expect(mockRouter.replace).toHaveBeenCalledWith(
        `/skill-trainer/mental-maths/results/${ATTEMPT_ID}`,
      );
      expect(
        mockFetch.mock.calls.filter(([, init]) => init?.method === "POST"),
      ).toHaveLength(1);
    },
  );

  it("reports a network rejection instead of silently treating it as discard", async () => {
    render(<SkillTrainerPlayPage trainerKey="mental_maths" />);
    await flush();
    getFailure = new TypeError("Failed to fetch");
    await act(async () => {
      jest.advanceTimersByTime(41_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to fetch");
    expect(captureException).toHaveBeenCalledWith(getFailure);
    expect(
      screen.getByRole("button", { name: "Retry loading run" }),
    ).toBeInTheDocument();
  });

  it("does not fetch a discarded attempt after the page unmounts", async () => {
    const { unmount } = render(
      <SkillTrainerPlayPage trainerKey="mental_maths" />,
    );
    await flush();
    unmount();
    await act(async () => {
      jest.advanceTimersByTime(41_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(discarded).toBe(true);
    expect(
      mockFetch.mock.calls.filter(([, init]) => !init?.method),
    ).toHaveLength(0);
  });

  it("recovers after pagehide discards the attempt and the retained page reaches expiry", async () => {
    render(<SkillTrainerPlayPage trainerKey="mental_maths" />);
    await flush();
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await Promise.resolve();
    });
    expect(discarded).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(41_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.getByText(
        "This run is no longer available. Return to the trainer to start a new run.",
      ),
    ).toBeInTheDocument();
    expect(
      mockFetch.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
    expect(captureException).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Submit answer" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to trainer" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/skill-trainer/mental-maths");
    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(
      mockFetch.mock.calls.filter(([, init]) => !init?.method),
    ).toHaveLength(1);
  });
});
