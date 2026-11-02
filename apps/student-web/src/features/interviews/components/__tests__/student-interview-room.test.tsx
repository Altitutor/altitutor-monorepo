import React from "react";
import { render, screen } from "@testing-library/react";
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

describe("online student interview room", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the tutor-style toolbar, edge-to-edge camera, and reading prompt", () => {
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
    expect(camera).toHaveClass("rounded-none");
    expect(
      screen.getByText("Choose a treatment and explain why."),
    ).toBeInTheDocument();
  });

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
});
