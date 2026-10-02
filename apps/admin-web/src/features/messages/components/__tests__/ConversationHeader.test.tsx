import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationHeader } from "../ConversationHeader";
import { useParentDetails } from "@/features/parents/hooks/useParentsQuery";

jest.mock("@/shared/hooks", () => ({
  useCurrentStaff: () => ({ data: { id: "admin" } }),
}));
jest.mock("@/features/parents/hooks/useParentsQuery", () => ({
  useParentDetails: jest.fn(),
}));
jest.mock("@/features/issues", () => ({ IssuePill: () => null }));
jest.mock("../BookMeetingMenu", () => ({ BookMeetingMenu: () => null }));
jest.mock("@/features/sessions/components/absences/LogAbsenceDialog", () => ({
  LogAbsenceDialog: ({ initialStudentId }: { initialStudentId: string }) => (
    <div role="dialog">Absence for {initialStudentId}</div>
  ),
}));
jest.mock(
  "@/features/sessions/components/absences/LogStaffAbsenceDialog",
  () => ({ LogStaffAbsenceDialog: () => null }),
);
const parent = {
  contact_type: "PARENT",
  parents: { id: "parent", first_name: "Parent" },
};
const students = [
  { id: "alice", first_name: "Alice", last_name: "Williams" },
  { id: "bob", first_name: "Bob", last_name: "Williams" },
];
beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
});
function mockStudents(count: number) {
  jest
    .mocked(useParentDetails)
    .mockReturnValue({
      data: { students: students.slice(0, count) },
      isLoading: false,
    } as ReturnType<typeof useParentDetails>);
}
test("a single-student parent opens their absence dialog directly from Actions", async () => {
  mockStudents(1);
  const user = userEvent.setup();
  render(
    <ConversationHeader
      compactActions
      contact={parent}
      onSearchToggle={jest.fn()}
      onToggleRead={jest.fn()}
      isUnread={false}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Log absence" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Absence for alice");
});
test("a parent with multiple students chooses the student before logging an absence", async () => {
  mockStudents(2);
  const user = userEvent.setup();
  render(<ConversationHeader compactActions contact={parent} />);
  await user.click(screen.getByRole("button", { name: "Actions" }));
  const item = screen.getByRole("menuitem", { name: "Log absence" });
  item.focus();
  fireEvent.keyDown(item, { key: "ArrowRight" });
  await user.click(
    await screen.findByRole("menuitem", { name: "Bob Williams" }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent("Absence for bob");
});
