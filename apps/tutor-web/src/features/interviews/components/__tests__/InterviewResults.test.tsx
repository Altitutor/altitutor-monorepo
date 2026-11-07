import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type {
  InterviewRound,
  InterviewStationAttempt,
} from "@altitutor/shared";
import { InterviewResults } from "../InterviewResults";

const mockRelease = jest.fn();
const mockToast = jest.fn();
const mockFlush = jest.fn(async () => undefined);
jest.mock("@altitutor/ui", () => ({
  ...jest.requireActual("@altitutor/ui"),
  useToast: () => ({ toast: mockToast }),
}));
jest.mock("../../hooks/use-interviews", () => ({
  useInterviewRound: () => ({
    data: round,
    refetch: async () => ({ data: round }),
    error: null,
    isPending: false,
  }),
  useInterviewCatalog: () => ({ data: { actorId: "tutor-1" } }),
  useInterviewCommand: () => ({
    mutateAsync: mockRelease,
    isPending: false,
    error: null,
  }),
}));
jest.mock("../../hooks/use-attempt-draft", () => ({
  useAttemptDraft: (_: string, attempt: InterviewStationAttempt) => ({
    draft: attempt,
    update: jest.fn(),
    flush: mockFlush,
    state: "saved",
    error: null,
    newerRevision: false,
    recoveryUnavailable: false,
    loadSaved: jest.fn(),
    keepDraft: jest.fn(),
  }),
}));
jest.mock("../interview-ui", () => ({
  ...jest.requireActual("../interview-ui"),
  InterviewDocument: () => <p>Document</p>,
}));
const round: InterviewRound = {
  id: "round-1",
  interviewId: "interview-1",
  name: "Practice",
  version: 1,
  createdBy: "tutor-1",
  createdAt: "2026-11-05T00:00:00Z",
  updatedAt: "2026-11-05T00:00:00Z",
  delivery: "in_person",
  mode: "exam",
  recordingEnabled: false,
  scheduledAt: null,
  startedAt: "2026-11-05T00:00:00Z",
  phase: "completed",
  rotation: 0,
  phaseStartedAt: "2026-11-05T00:00:00Z",
  phaseDeadline: null,
  pausedAt: null,
  remainingMilliseconds: null,
  readingTimeSeconds: 60,
  questionTimeSeconds: 480,
  serverNow: "2026-11-05T00:00:00Z",
  studentIds: ["s1", "s2"],
  assignments: [{ stationId: "station-1", tutorId: "tutor-1" }],
  students: [
    { id: "s1", name: "Alex Chen" },
    { id: "s2", name: "Sam Morgan" },
  ],
  tutors: [{ id: "tutor-1", name: "Jordan" }],
  connectedStudentIds: [],
  progress: [],
  releasedResults: [],
  recordings: [],
  stations: [
    {
      id: "station-1",
      name: "Communication",
      prompt: "",
      maximumPoints: 6,
      questions: [],
    },
  ],
  attempts: ["s1", "s2"].map((studentId) => ({
    id: `attempt-${studentId}`,
    studentId,
    stationId: "station-1",
    version: 1,
    score: 4,
    notAssessedReason: null,
    generalFeedback: null,
    feedback: [],
    completed: true,
    updatedAt: "2026-11-05T00:00:00Z",
    updatedBy: "tutor-1",
  })),
};
beforeEach(() => {
  mockRelease.mockReset();
  mockToast.mockClear();
  mockFlush.mockClear();
});
it("selects a student from any table cell after saving the current feedback", async () => {
  render(<InterviewResults id="round-1" />);
  const row = screen.getByRole("button", { name: "Sam Morgan" }).closest("tr")!;
  fireEvent.click(within(row).getByText("Not released"));
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Sam Morgan" }),
    ).toBeInTheDocument(),
  );
  expect(mockFlush).toHaveBeenCalled();
});
it("closes confirmation and shows success only after results release succeeds", async () => {
  mockRelease.mockResolvedValue({});
  render(<InterviewResults id="round-1" />);
  fireEvent.click(screen.getByRole("button", { name: "Release all results" }));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Release results",
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(mockToast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Results released" }),
  );
});
it("keeps failed release confirmation open and available for retry", async () => {
  mockRelease.mockRejectedValue(new Error("Release failed"));
  render(<InterviewResults id="round-1" />);
  fireEvent.click(screen.getByRole("button", { name: "Release all results" }));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Release results",
    }),
  );
  await waitFor(() =>
    expect(
      within(screen.getByRole("alertdialog")).getByRole("alert"),
    ).toHaveTextContent("Release failed"),
  );
  expect(mockToast).not.toHaveBeenCalled();
});
