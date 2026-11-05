import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnnouncementsModal } from "../AnnouncementsModal";
const toast = jest.fn();
jest.mock("@altitutor/ui", () => ({
  ...jest.requireActual("@altitutor/ui"),
  useToast: () => ({ toast }),
}));
jest.mock("@/shared/components", () => ({
  AdminDialogShell: ({
    open,
    onClose,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog">
        <button onClick={onClose}>Close wizard</button>
        {children}
      </div>
    ) : null,
}));
jest.mock("@/shared/hooks", () => ({ useDialogHotkeys: jest.fn() }));
jest.mock("@/features/messages/hooks/useAnnouncements", () => ({
  useAnnouncements: () => ({ sendAnnouncements: jest.fn(), isLoading: false }),
}));
jest.mock("@/features/messages/api/queries", () => ({
  useAvailableSenders: () => ({ data: [], isLoading: false }),
}));
jest.mock("../../bulk/StudentSelector", () => ({
  StudentSelector: ({
    selectedStudents,
  }: {
    selectedStudents: { id: string; first_name: string }[];
  }) => (
    <p>
      Recipients:{" "}
      {selectedStudents.map((student) => student.first_name).join(", ") ||
        "none"}
    </p>
  ),
}));
jest.mock("../../bulk/MessageComposer", () => ({
  MessageComposer: () => null,
}));
jest.mock("../../bulk/MessagePreview", () => ({ MessagePreview: () => null }));
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        in: () =>
          Promise.resolve({
            data: [
              { id: "alice", first_name: "Alice" },
              { id: "bob", first_name: "Bob" },
            ],
            error: null,
          }),
      }),
    }),
  }),
}));
test("interview students are preselected and do not leak into a later general announcement", async () => {
  const close = jest.fn();
  const { rerender } = render(
    <AnnouncementsModal
      isOpen
      onClose={close}
      initialStudentIds={["alice", "bob"]}
    />,
  );
  expect(await screen.findByText("Recipients: Alice, Bob")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Close wizard" }));
  expect(close).toHaveBeenCalled();
  rerender(<AnnouncementsModal isOpen={false} onClose={close} />);
  rerender(<AnnouncementsModal isOpen onClose={close} />);
  expect(await screen.findByText("Recipients: none")).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
