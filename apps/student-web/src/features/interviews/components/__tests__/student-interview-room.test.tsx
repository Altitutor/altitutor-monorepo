import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { StudentInterviewRound } from "@altitutor/shared";
import { StudentInterviewRoom } from "../student-interview-room";
import { useInterviewRound } from "../../hooks/use-interviews";

jest.mock("@altitutor/ui", () => ({
  ...jest.requireActual("@altitutor/ui/components/button"),
  ...jest.requireActual("@altitutor/ui/components/badge"),
  ...jest.requireActual("@altitutor/ui/components/alert-dialog"),
  ...jest.requireActual("@altitutor/ui/components/tooltip"),
  InterviewMedia: ({ className }: { className?: string }) => (
    <div className={className}>Camera</div>
  ),
}));
jest.mock("../../hooks/use-interviews", () => ({
  useInterviewRound: jest.fn(),
}));
jest.mock("../../hooks/use-interview-leave-guard", () => ({
  useInterviewLeaveGuard: () => ({
    open: false,
    requestExit: jest.fn(),
    cancelExit: jest.fn(),
    confirmExit: jest.fn(),
  }),
}));
jest.mock("../interview-content", () => ({
  InterviewContent: ({ value }: { value: string }) => <p>{value}</p>,
}));

function round(
  overrides: Partial<StudentInterviewRound>,
): StudentInterviewRound {
  return {
    id: "round-1",
    name: "Medicine practice",
    version: 1,
    delivery: "online",
    mode: "exam",
    recordingEnabled: false,
    scheduledAt: null,
    startedAt: "2026-10-23T10:00:00Z",
    phase: "reading",
    rotation: 1,
    pausedAt: null,
    phaseStartedAt: "2026-10-23T10:00:00Z",
    phaseDeadline: "2026-10-23T10:02:00Z",
    serverNow: "2026-10-23T10:00:30Z",
    studentId: "student-1",
    stationId: "station-1",
    stationNumber: 2,
    tutor: { id: "tutor-1", name: "Tutor" },
    prompt: "Choose a treatment and explain why.",
    endedEarly: false,
    stations: [
      { id: "station-1", number: 1, complete: true },
      { id: "station-2", number: 2, complete: false },
    ],
    result: null,
    resultStations: [],
    ...overrides,
  };
}

function setRound(data: StudentInterviewRound) {
  jest.mocked(useInterviewRound).mockReturnValue({
    data,
    error: null,
    isPending: false,
    refetch: jest.fn(),
    heartbeatFailed: false,
  } as unknown as ReturnType<typeof useInterviewRound>);
}

const fullscreenProperties = [
  [document.documentElement, "requestFullscreen"],
  [document, "exitFullscreen"],
  [document, "fullscreenElement"],
  [document, "fullscreenEnabled"],
] as const;
const originalFullscreenProperties = fullscreenProperties.map(([target, key]) =>
  Object.getOwnPropertyDescriptor(target, key),
);
function setFullscreenProperty(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { configurable: true, value });
}

describe("online student interview room", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setFullscreenProperty(
      document.documentElement,
      "requestFullscreen",
      jest.fn().mockResolvedValue(undefined),
    );
    setFullscreenProperty(
      document,
      "exitFullscreen",
      jest.fn().mockResolvedValue(undefined),
    );
    setFullscreenProperty(document, "fullscreenElement", null);
    setFullscreenProperty(document, "fullscreenEnabled", true);
  });
  afterEach(() => {
    jest.useRealTimers();
    fullscreenProperties.forEach(([target, key], index) => {
      const descriptor = originalFullscreenProperties[index];
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    });
  });

  it("shows the toolbar, camera, and reading prompt", () => {
    setRound(round({}));
    render(<StudentInterviewRoom roundId="round-1" />);
    expect(
      screen.getByRole("heading", { name: "Medicine practice" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("You are online")).toBeInTheDocument();
    expect(screen.getAllByText("Reading time").length).toBeGreaterThan(0);
    expect(screen.getByRole("timer")).toHaveTextContent("1:30");
    expect(screen.getByText("Rotation 2/2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Full screen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit" })).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Interview stations"),
    ).not.toBeInTheDocument();
    const camera = screen.getByText("Camera");
    expect(camera).toBeInTheDocument();
    expect(
      screen.getByText("Choose a treatment and explain why."),
    ).toBeInTheDocument();
  });

  it.each([
    "requestFullscreen",
    "exitFullscreen",
    "fullscreenEnabled",
  ] as const)("omits fullscreen when %s is unavailable", (property) => {
    setRound(round({}));
    const target =
      property === "requestFullscreen" ? document.documentElement : document;
    setFullscreenProperty(
      target,
      property,
      property === "fullscreenEnabled" ? false : undefined,
    );
    render(<StudentInterviewRoom roundId="round-1" />);
    expect(
      screen.queryByRole("button", { name: "Full screen" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Camera")).toBeInTheDocument();
  });

  it("does not throw if fullscreen support disappears before the click", async () => {
    setRound(round({}));
    render(<StudentInterviewRoom roundId="round-1" />);
    const button = screen.getByRole("button", { name: "Full screen" });
    setFullscreenProperty(
      document.documentElement,
      "requestFullscreen",
      undefined,
    );
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", onError);
    try {
      await act(async () => fireEvent.click(button));
      expect(errors).toEqual([]);
      expect(screen.getByText("Camera")).toBeInTheDocument();
    } finally {
      window.removeEventListener("error", onError);
    }
  });

  it("enters and exits fullscreen using the real fullscreen state", async () => {
    setRound(round({}));
    render(<StudentInterviewRoom roundId="round-1" />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Full screen" })),
    );
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    act(() => {
      setFullscreenProperty(
        document,
        "fullscreenElement",
        document.documentElement,
      );
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" })),
    );
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    act(() => {
      setFullscreenProperty(document, "fullscreenElement", null);
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(
      screen.getByRole("button", { name: "Full screen" }),
    ).toBeInTheDocument();
  });

  it.each(["requestFullscreen", "exitFullscreen"] as const)(
    "handles a rejected %s without disrupting the interview",
    async (method) => {
      setRound(round({}));
      const target =
        method === "requestFullscreen" ? document.documentElement : document;
      const invoke = jest
        .fn()
        .mockRejectedValue(new Error("Fullscreen denied"));
      setFullscreenProperty(target, method, invoke);
      if (method === "exitFullscreen")
        setFullscreenProperty(
          document,
          "fullscreenElement",
          document.documentElement,
        );
      render(<StudentInterviewRoom roundId="round-1" />);
      await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: /full ?screen/i })),
      );
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Camera")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Exit" })).toBeInTheDocument();
    },
  );

  it.each(["requestFullscreen", "exitFullscreen"] as const)(
    "handles a synchronous %s failure without disrupting the interview",
    async (method) => {
      setRound(round({}));
      const target =
        method === "requestFullscreen" ? document.documentElement : document;
      const invoke = jest.fn(() => {
        throw new Error("Fullscreen unavailable");
      });
      setFullscreenProperty(target, method, invoke);
      if (method === "exitFullscreen")
        setFullscreenProperty(
          document,
          "fullscreenElement",
          document.documentElement,
        );
      render(<StudentInterviewRoom roundId="round-1" />);
      await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: /full ?screen/i })),
      );
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Camera")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Exit" })).toBeInTheDocument();
    },
  );

  it("hides the clock outside exam reading time and shows the question prompt", () => {
    setRound(round({ phase: "questions", mode: "feedback" }));
    render(<StudentInterviewRoom roundId="round-1" />);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.getAllByText("Question time").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Choose a treatment and explain why."),
    ).toBeInTheDocument();
  });

  it("shows wait instructions instead of the prompt during exam feedback", () => {
    setRound(round({ phase: "feedback", mode: "exam" }));
    render(<StudentInterviewRoom roundId="round-1" />);
    expect(
      screen.getByText("Wait here for the next station."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Choose a treatment and explain why."),
    ).not.toBeInTheDocument();
  });
  it("shows the mode and a live elapsed waiting timer without revealing question deadlines", () => {
    setRound(
      round({
        phase: "waiting",
        phaseDeadline: null,
        serverNow: "2026-10-23T10:00:30Z",
      }),
    );
    render(<StudentInterviewRoom roundId="round-1" />);
    expect(screen.getByText("Exam mode")).toBeInTheDocument();
    expect(
      screen.getByRole("timer", { name: "Waiting time elapsed" }),
    ).toHaveTextContent("0:30");
    act(() => jest.advanceTimersByTime(1000));
    expect(
      screen.getByRole("timer", { name: "Waiting time elapsed" }),
    ).toHaveTextContent("0:31");
  });

  it("replaces all online media with the completion message", () => {
    setRound(round({ phase: "completed" }));
    render(<StudentInterviewRoom roundId="round-1" />);
    expect(
      screen.getByRole("heading", { name: "Interview complete" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Camera")).not.toBeInTheDocument();
  });
});
