import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoteAlertPills } from "../NoteAlertPills";
import { useAlertNotes, useSetNoteAlert } from "@/shared/hooks/useNotes";

const mockToast = jest.fn();
const mockMutate = jest.fn();
jest.mock("@/shared/hooks/useNotes", () => ({
  useAlertNotes: jest.fn(),
  useSetNoteAlert: jest.fn(),
}));
jest.mock("@altitutor/ui", () => ({
  ...jest.requireActual("@altitutor/ui"),
  useToast: () => ({ toast: mockToast }),
}));
jest.mock("../NoteContentDisplay", () => ({
  NoteContentDisplay: () => <div>Full alert note</div>,
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useAlertNotes)
    .mockReturnValue({
      data: [
        {
          id: "note-id",
          admin_revision: 7,
          note: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Call parent first" }],
              },
            ],
          },
        },
      ],
    } as unknown as ReturnType<typeof useAlertNotes>);
  jest
    .mocked(useSetNoteAlert)
    .mockReturnValue({
      mutateAsync: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSetNoteAlert>);
  mockMutate.mockResolvedValue(undefined);
});

it("shows a note excerpt in the pill and reveals the full note on click", async () => {
  const user = userEvent.setup();
  render(<NoteAlertPills entityType="student" entityId="student-id" />);
  await user.click(
    screen.getByRole("button", { name: "Read alert: Call parent first" }),
  );
  expect(screen.getByText("Full alert note")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Remove alert flag" }));
  expect(mockMutate).toHaveBeenCalledWith({
    noteId: "note-id",
    isAlert: false,
    revision: 7,
  });
});

it("reports failed flag changes without hiding the alert", async () => {
  const user = userEvent.setup();
  mockMutate.mockRejectedValue(new Error("Conflict"));
  render(<NoteAlertPills entityType="parent" entityId="parent-id" />);
  await user.click(
    screen.getByRole("button", { name: "Read alert: Call parent first" }),
  );
  await user.click(screen.getByRole("button", { name: "Remove alert flag" }));
  await waitFor(() =>
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "Conflict",
      }),
    ),
  );
  expect(
    screen.getByRole("button", { name: "Read alert: Call parent first" }),
  ).toBeVisible();
});

it("renders no alert pills when there are no alerts", () => {
  jest
    .mocked(useAlertNotes)
    .mockReturnValue({ data: [] } as unknown as unknown as ReturnType<
      typeof useAlertNotes
    >);
  const { container } = render(
    <NoteAlertPills entityType="staff" entityId="staff-id" />,
  );
  expect(container).toBeEmptyDOMElement();
});
