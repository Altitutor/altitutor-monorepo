import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InterviewCatalog } from "@altitutor/shared";
import { InterviewRoundDialog } from "../InterviewRoundSetup";

const mockCreate = jest.fn(async () => ({ id: "round-1" }));
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

it("requires a separate review stage before creating a round and preserves setup when going back", async () => {
  render(<InterviewRoundDialog open onClose={jest.fn()} catalog={catalog} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Interview" }), {
    target: { value: "interview-1" },
  });
  expect(
    screen.queryByRole("button", { name: "Create round" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Students" }));
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Next: review" }));
  expect(screen.getByText("Online rotation plan")).toBeInTheDocument();
  expect(mockCreate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));
  fireEvent.click(screen.getByRole("tab", { name: "Students" }));
  expect(screen.getByRole("checkbox")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Next: review" }));
  fireEvent.click(screen.getByRole("button", { name: "Create round" }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
});
