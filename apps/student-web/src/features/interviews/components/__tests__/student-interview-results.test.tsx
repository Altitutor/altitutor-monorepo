import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StudentInterviewRound } from "@altitutor/shared";
import { StudentInterviewResults } from "../student-interview-results";
import { useInterviewRound } from "../../hooks/use-interviews";
import { getInterviewRecording } from "../../api/interviews";

jest.mock("@altitutor/ui", () => ({
  ...jest.requireActual("@altitutor/ui/components/button"),
  ...jest.requireActual("@altitutor/ui/components/badge"),
}));
jest.mock("../../hooks/use-interviews", () => ({
  useInterviewRound: jest.fn(),
}));
jest.mock("../../api/interviews", () => ({
  getInterviewRecording: jest.fn(),
}));
jest.mock("../interview-content", () => ({
  InterviewContent: ({ value }: { value: string }) => <p>{value}</p>,
}));

const round: StudentInterviewRound = {
  id: "round-1",
  name: "Medicine practice",
  version: 1,
  delivery: "online",
  mode: "exam",
  recordingEnabled: false,
  scheduledAt: null,
  startedAt: "2026-10-23T10:00:00Z",
  phase: "completed",
  rotation: 1,
  pausedAt: null,
  phaseStartedAt: "2026-10-23T10:20:00Z",
  phaseDeadline: null,
  serverNow: "2026-10-23T10:20:00Z",
  studentId: "student-1",
  stationId: null,
  stationNumber: null,
  tutor: null,
  prompt: "",
  endedEarly: false,
  stations: [{ id: "station-1", number: 1, complete: true }],
  result: null,
  resultStations: [
    {
      id: "station-1",
      name: "SECRET STATION NAME",
      maximumPoints: 6,
      prompt: "",
      questions: [
        {
          id: "placement-1",
          questionId: "question-1",
          question: "Released question",
          rubric: "SECRET RUBRIC",
          rubricVersion: 1,
        },
      ],
    },
  ],
};
const mockQuery = jest.mocked(useInterviewRound);
function setQuery(
  data: StudentInterviewRound | undefined,
  error: Error | null = null,
) {
  mockQuery.mockReturnValue({
    data,
    error,
    isPending: false,
    refetch: jest.fn(),
    heartbeatFailed: false,
  } as unknown as ReturnType<typeof useInterviewRound>);
}

describe("student released result boundary", () => {
  it("does not display feedback before explicit release", () => {
    setQuery(round);
    render(<StudentInterviewResults roundId="round-1" />);
    expect(screen.getByText("Results not yet released")).toBeInTheDocument();
    expect(screen.queryByText("Released question")).not.toBeInTheDocument();
    expect(screen.queryByText("SECRET STATION NAME")).not.toBeInTheDocument();
  });

  it("shows the released partial total and reason, while keeping station names and rubrics private", () => {
    setQuery({
      ...round,
      result: {
        studentId: "student-1",
        releasedAt: "2026-10-23T10:30:00Z",
        revision: 1,
        score: 0,
        possiblePoints: 0,
        partial: true,
        attempts: [
          {
            id: "attempt-1",
            studentId: "student-1",
            stationId: "station-1",
            version: 1,
            score: null,
            notAssessedReason: "Missed because connection failed",
            generalFeedback: "Overall: clear empathy and structure",
            feedback: [
              { placementId: "placement-1", value: "Released feedback" },
            ],
            completed: true,
            updatedAt: "2026-10-23T10:20:00Z",
            updatedBy: "tutor-1",
          },
        ],
        recordings: [],
      },
    });
    render(<StudentInterviewResults roundId="round-1" />);
    expect(screen.getByText("Partial result")).toBeInTheDocument();
    expect(
      screen.getByText("Missed because connection failed"),
    ).toBeInTheDocument();
    expect(screen.getByText("Released feedback")).toBeInTheDocument();
    expect(
      screen.getByText("Overall: clear empathy and structure"),
    ).toBeInTheDocument();
    expect(screen.queryByText("SECRET STATION NAME")).not.toBeInTheDocument();
    expect(screen.queryByText("SECRET RUBRIC")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Your released feedback"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Question 1")).not.toBeInTheDocument();
    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Interviews" })).toHaveAttribute(
      "href",
      "/interviews",
    );
    expect(
      screen.getByRole("link", { name: "Back to interviews" }),
    ).toHaveAttribute("href", "/interviews");
    expect(screen.getByRole("group", { name: "Station results" })).toHaveClass(
      "overflow-x-auto",
    );
  });

  it("shows a media player for each released station recording", async () => {
    jest.mocked(getInterviewRecording).mockResolvedValue({
      url: "https://example.com/station.webm",
    });
    setQuery({
      ...round,
      recordingEnabled: true,
      result: {
        studentId: "student-1",
        releasedAt: "2026-10-23T10:30:00Z",
        revision: 1,
        score: 4,
        possiblePoints: 6,
        partial: false,
        attempts: [
          {
            id: "attempt-1",
            studentId: "student-1",
            stationId: "station-1",
            version: 1,
            score: 4,
            notAssessedReason: null,
            generalFeedback: null,
            feedback: [],
            completed: true,
            updatedAt: "2026-10-23T10:20:00Z",
            updatedBy: "tutor-1",
          },
        ],
        recordings: [
          {
            id: "recording-1",
            attemptId: "attempt-1",
            state: "ready",
            kind: "audio",
            expiresAt: "2099-01-01T00:00:00Z",
            createdAt: "2026-10-23T10:20:00Z",
          },
        ],
      },
    });
    render(<StudentInterviewResults roundId="round-1" />);
    const stations = screen.getByRole("group", { name: "Station results" });
    expect(getInterviewRecording).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Load audio recording" }),
    );
    const player = await screen.findByLabelText("Interview recording");
    expect(player).toHaveAttribute("src", "https://example.com/station.webm");
    expect(player.tagName).toBe("AUDIO");
    expect(
      stations.compareDocumentPosition(player) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Station 1 recording")).toBeInTheDocument();
    await waitFor(() => {
      expect(getInterviewRecording).toHaveBeenCalledWith(
        "round-1",
        "recording-1",
      );
    });
  });

  it("removes cached results immediately when access is denied on refetch", () => {
    setQuery(
      round,
      new Error("An active Medicine interview enrolment is required."),
    );
    render(<StudentInterviewResults roundId="round-1" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "active Medicine interview enrolment",
    );
    expect(screen.queryByText("Medicine practice")).not.toBeInTheDocument();
  });
});
