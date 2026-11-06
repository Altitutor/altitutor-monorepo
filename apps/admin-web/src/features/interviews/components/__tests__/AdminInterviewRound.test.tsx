import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminInterviewRound } from "../AdminInterviewRound";
import { useQuery } from "@tanstack/react-query";
import type { InterviewRound } from "@altitutor/shared";
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
const openMessages = jest.fn();
jest.mock("@/shared/contexts/QuickActionsContext", () => ({
  useQuickActions: () => ({ openAnnouncementsModal: openMessages }),
}));
jest.mock("@altitutor/ui", () => ({
  ...jest.requireActual("@altitutor/ui"),
  InterviewMedia: ({
    role,
    stationId,
  }: {
    role: string;
    stationId: string;
  }) => (
    <div data-testid="observer">
      {role}:{stationId}
    </div>
  ),
  RichTextEditor: ({
    content,
    editable,
  }: {
    content: unknown;
    editable: boolean;
  }) => (
    <div data-testid="document" data-editable={String(editable)}>
      {JSON.stringify(content)}
    </div>
  ),
}));
const round = {
  id: "round",
  name: "Evening MMI",
  phase: "questions",
  startedAt: "2026-11-05T10:00:00Z",
  phaseDeadline: null,
  serverNow: "2026-11-05T10:00:00Z",
  rotation: 0,
  mode: "exam",
  delivery: "online",
  stations: [
    {
      id: "station",
      name: "Motivation",
      prompt: "Reading prompt",
      maximumPoints: 6,
      questions: [
        {
          id: "q1",
          questionId: "bank-q1",
          question: "Why medicine?",
          rubric: "Explain your motivation",
        },
      ],
    },
  ],
  progress: [
    {
      stationId: "station",
      tutorId: "tutor",
      studentId: "alice",
      ready: true,
      endedEarly: false,
      feedbackComplete: false,
    },
  ],
  tutors: [{ id: "tutor", name: "Tutor" }],
  students: [{ id: "alice", name: "Alice" }],
  connectedStudentIds: [],
  connectedTutorIds: [],
  attempts: [
    {
      id: "attempt",
      stationId: "station",
      studentId: "alice",
      score: 4,
      feedback: [{ placementId: "q1", value: "Clear reflection" }],
      generalFeedback: "Strong opening",
    },
  ],
} as unknown as InterviewRound;
test("admin starts with overview and can inspect readonly live station feedback and message its students", async () => {
  jest
    .mocked(useQuery)
    .mockReturnValue({
      data: round,
      dataUpdatedAt: Date.now(),
      isError: false,
    } as ReturnType<typeof useQuery>);
  render(<AdminInterviewRound roundId="round" />);
  expect(screen.getByRole("textbox", { name: "Student link" })).toHaveValue(
    "http://localhost:3001/interviews/rounds/round",
  );
  expect(screen.queryByTestId("observer")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: /Station 1 · Motivation/ }),
  );
  expect(screen.getByTestId("observer")).toHaveTextContent("admin:station");
  expect(screen.getByText(/Clear reflection/)).toBeInTheDocument();
  expect(
    screen
      .getAllByTestId("document")
      .every((node) => node.getAttribute("data-editable") === "false"),
  ).toBe(true);
  expect(
    screen.queryByRole("button", { name: /save|start reading|release/i }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Message students" }),
  );
  expect(openMessages).toHaveBeenCalledWith(["alice"]);
  await userEvent.click(screen.getByRole("button", { name: "Overview" }));
  expect(
    screen.getByRole("textbox", { name: "Student link" }),
  ).toBeInTheDocument();
});
