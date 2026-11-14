import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InterviewCatalog, InterviewCommand } from "@altitutor/shared";
import { InterviewRoundDialog } from "../InterviewRoundSetup";

const mockCreate = jest.fn(async (_command: InterviewCommand) => ({
  id: "round-1",
}));
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../../hooks/use-interviews", () => ({
  useInterviewCommand: () => ({
    mutateAsync: mockCreate,
    isPending: false,
    error: null,
  }),
}));
jest.mock("../interview-ui", () => ({
  ...jest.requireActual("../interview-ui"),
  InterviewSelect: ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: string | null;
    options: { id: string; label: string }[];
    onChange: (value: string) => void;
  }) => (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const catalog: InterviewCatalog = {
  actorId: "tutor-1",
  categories: [],
  tags: [],
  classes: [],
  tutors: [{ id: "tutor-1", name: "Jordan" }],
  students: [{ id: "student-1", name: "Alex", classIds: [] }],
  stations: [
    {
      id: "bank-1",
      version: 1,
      name: "Communication",
      categoryId: "category-1",
      prompt: "Prompt",
      maximumPoints: 6,
      questions: [],
      archived: false,
      updatedAt: "2026-11-05T00:00:00Z",
    },
  ],
  interviews: [
    {
      id: "interview-1",
      version: 1,
      name: "Medicine practice",
      readingTimeSeconds: 60,
      questionTimeSeconds: 480,
      recordingEnabled: false,
      stations: [{ id: "station-1", stationId: "bank-1" }],
      archived: false,
      updatedAt: "2026-11-05T00:00:00Z",
    },
  ],
};

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = jest.fn();
});

it("requires a separate review stage before creating a round and preserves setup when going back", async () => {
  render(<InterviewRoundDialog open onClose={jest.fn()} catalog={catalog} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Interview" }), {
    target: { value: "interview-1" },
  });
  expect(
    screen.queryByRole("button", { name: "Create round" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Students" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Add student" }));
  fireEvent.click(await screen.findByRole("option", { name: "Alex" }));
  fireEvent.click(screen.getByRole("button", { name: "Next: review" }));
  expect(
    screen.getByText(/There is no assigned station order/),
  ).toBeInTheDocument();
  expect(mockCreate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));
  fireEvent.click(screen.getByRole("tab", { name: "Students" }));
  expect(
    screen.getByRole("button", { name: "Remove Alex" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next: review" }));
  fireEvent.click(screen.getByRole("button", { name: "Schedule round" }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "createRound",
      setup: expect.objectContaining({
        delivery: "in_person",
        mode: "feedback",
        recordingEnabled: true,
        rotationAllowanceSeconds: 120,
        studentIds: ["student-1"],
        scheduledAt: expect.any(String),
      }),
    }),
  );
  const submitted = mockCreate.mock.calls[0]?.[0];
  if (submitted?.type !== "createRound" || !submitted.setup.scheduledAt)
    throw new Error("Expected a scheduled round command");
  expect(Date.parse(submitted.setup.scheduledAt)).toBeGreaterThan(Date.now());
});
