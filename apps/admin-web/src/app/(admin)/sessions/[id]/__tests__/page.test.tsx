import type { ComponentProps, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SessionDetailPage from "../page";
import type { SessionDetailsTab } from "@/features/sessions/components/SessionDetailsTab";
import type { AddStudentToSessionModal } from "@/features/sessions/components/AddStudentToSessionModal";
import type { AddStaffToSessionModal } from "@/features/sessions/components/AddStaffToSessionModal";
import type { LogAbsenceDialog } from "@/features/sessions/components/absences/LogAbsenceDialog";
import type { LogStaffAbsenceDialog } from "@/features/sessions/components/absences/LogStaffAbsenceDialog";
import { act } from "@testing-library/react";
import type { RemoveFromSessionConfirmDialog } from "@/features/sessions/components/RemoveFromSessionConfirmDialog";
import type { UndoLogAbsenceConfirmDialog } from "@/features/sessions/components/UndoLogAbsenceConfirmDialog";
import type { Tables } from "@altitutor/shared";
import { defaultCheckInSessionsStaffType } from "@altitutor/shared/pay-tiers";

const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockRemoveStudent = jest.fn().mockResolvedValue(undefined);
const mockRemoveStaff = jest.fn().mockResolvedValue(undefined);
const mockRemoveParent = jest.fn().mockResolvedValue(undefined);
const mockUndoStudent = jest.fn().mockResolvedValue({ success: true });
const mockUndoStaff = jest.fn().mockResolvedValue({ success: true });
const mockPush = jest.fn();
let mockActionsProps: { onEditTutorLog?: () => void };
const mockAddStudent = jest.fn().mockResolvedValue(undefined);
const mockAddStaff = jest.fn().mockResolvedValue(undefined);
const mockAddParent = jest.fn().mockResolvedValue(undefined);
const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockToast = jest.fn();
const mockPerson = { id: "person", first_name: "Test", last_name: "Person" };
let mockCurrentStaff: { id: string } | null = null;
let mockType = "CLASS";
let mockHasTutorLog = false;
let mockDetailsProps: ComponentProps<typeof SessionDetailsTab>;

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@altitutor/ui", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
  }) => (
    <button aria-label={ariaLabel} onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <>{children}</> : null,
  ...Object.fromEntries(
    [
      "AlertDialogContent",
      "AlertDialogDescription",
      "AlertDialogFooter",
      "AlertDialogHeader",
      "AlertDialogTitle",
    ].map((name) => [
      name,
      ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ]),
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick: (e: { preventDefault: () => void }) => void;
  }) => (
    <button onClick={() => onClick({ preventDefault: jest.fn() })}>
      {children}
    </button>
  ),
  SearchableSelectFieldTrigger: () => null,
  SearchableSelect: () => null,
  useToast: () => ({ toast: mockToast }),
  SegmentedTabPanel: ({ children }: { children: ReactNode }) => <>{children}</>,
  SegmentedTabPanelContent: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock("@/shared/components/PrimaryEntityBreadcrumb", () => ({
  PrimaryEntityBreadcrumb: () => null,
}));
jest.mock("@/shared/components/ActionsMenu", () => ({
  ActionsMenu: () => null,
}));
jest.mock("@/shared/components", () => ({ AdminLoadingSkeleton: () => null }));
jest.mock("@/features/tutor-logs", () => ({
  LogSessionModal: () => null,
  EditTutorLogDialog: () => <div>Edit tutor log dialog</div>,
}));
jest.mock("@/features/issues", () => ({ IssuePill: () => null }));
jest.mock("@/features/sessions/components/SessionFiles", () => ({
  SessionFiles: () => <div>Meeting files</div>,
}));
jest.mock("@/features/activity/components/tabs/SessionActivityTab", () => ({
  SessionActivityTab: () => null,
}));
jest.mock(
  "@/features/sessions/components/SendBookingConfirmationDialog",
  () => ({ SendBookingConfirmationDialog: () => null }),
);
jest.mock("@/shared/hooks", () => ({
  useCurrentStaff: () => ({ data: mockCurrentStaff }),
}));
jest.mock("@/shared/contexts/EntityNavigation", () => ({
  useEntityNavigation: () => ({
    openStudent: jest.fn(),
    openStaff: jest.fn(),
    openParent: jest.fn(),
  }),
}));
jest.mock("@/features/messages/state/chatStore", () => ({
  useChatStore: () => jest.fn(),
}));
jest.mock("@/features/messages/api/queries", () => ({
  ensureConversationForRelated: jest.fn(),
}));
jest.mock("@/features/sessions/hooks/useSessionActions", () => ({
  useSessionActions: (props: typeof mockActionsProps) => {
    mockActionsProps = props;
    return {};
  },
}));
jest.mock("@/features/sessions/hooks", () => ({
  useSessionModals: jest.requireActual<
    typeof import("@/features/sessions/hooks/useSessionModals")
  >("@/features/sessions/hooks/useSessionModals").useSessionModals,
  useSessionData: () => ({
    data: {
      session: {
        id: "session",
        type: mockType,
        start_at: "2026-10-06T08:00:00Z",
        end_at: "2026-10-06T09:00:00Z",
        class_id: "class",
      },
      sessionsStudents: [
        {
          student_id: "existing-student",
          id: "ss",
          rescheduled_session: {
            session: { short_name: "Replacement session" },
          },
        },
      ],
      sessionsStaff: [],
      sessionsParents: [
        { id: "sp", parent: { ...mockPerson, id: "existing-parent" } },
      ],
      tutorLog: mockHasTutorLog ? { id: "tutor-log" } : null,
    },
    allTopics: [],
    refresh: mockRefresh,
    isLoading: false,
  }),
  useSessionHelpers: () => ({
    hasTutorLog: mockHasTutorLog,
    getFirstStaffForLogging: jest.fn(),
  }),
  useAddStudentToSession: () => ({ mutateAsync: mockAddStudent }),
  useAssignStaffToSession: () => ({ mutateAsync: mockAddStaff }),
  useAddParentToSession: () => ({ mutateAsync: mockAddParent }),
  useRemoveStudentFromSession: () => ({ mutateAsync: mockRemoveStudent }),
  useRemoveStaffFromSession: () => ({ mutateAsync: mockRemoveStaff }),
  useRemoveParentFromSession: () => ({ mutateAsync: mockRemoveParent }),
  useUndoAbsences: () => ({ mutateAsync: mockUndoStudent }),
  useUndoStaffAbsences: () => ({ mutateAsync: mockUndoStaff }),
  useUpdateSession: () => ({ mutateAsync: mockUpdate }),
  useSessionsWithDetails: () => ({
    data: {
      sessions: [
        { id: "previous", start_at: "2026-10-05T08:00:00Z" },
        { id: "session", start_at: "2026-10-06T08:00:00Z" },
        { id: "next", start_at: "2026-10-07T08:00:00Z" },
      ],
    },
  }),
}));
jest.mock("@/features/sessions/utils", () => ({
  buildStudentAttendanceMap: jest.fn(),
  buildStaffAttendanceMap: jest.fn(),
  processSessionStudents: () => [],
  processSessionStaff: () => [],
}));
jest.mock("@/features/sessions/components/SessionDetailsTab", () => ({
  SessionDetailsTab: (props: ComponentProps<typeof SessionDetailsTab>) => {
    mockDetailsProps = props;
    return (
      <>
        <div data-testid="day-field">{props.dayNavigation}</div>
        {props.onLogAbsenceStudent && (
          <button onClick={() => props.onLogAbsenceStudent?.("student-target")}>
            Log student absence
          </button>
        )}
        {props.onLogAbsenceStaff && (
          <button onClick={() => props.onLogAbsenceStaff?.("staff-target")}>
            Log staff absence
          </button>
        )}
        {props.onAddStudentToSession && (
          <button onClick={props.onAddStudentToSession}>Add student</button>
        )}
        {props.onAddStaffToSession && (
          <button onClick={props.onAddStaffToSession}>Add staff</button>
        )}
        {props.onMeetingAddStudent && (
          <button
            onClick={() =>
              void props.onMeetingAddStudent?.(mockPerson as Tables<"students">)
            }
          >
            Add meeting student
          </button>
        )}
        {props.onMeetingAddStaff && (
          <button
            onClick={() =>
              void props.onMeetingAddStaff?.(mockPerson as Tables<"staff">)
            }
          >
            Add meeting staff
          </button>
        )}
        {props.onMeetingAddParent && (
          <button
            onClick={() =>
              void props.onMeetingAddParent?.(mockPerson as Tables<"parents">)
            }
          >
            Add parent
          </button>
        )}
      </>
    );
  },
}));
jest.mock("@/features/sessions/components/AddStudentToSessionModal", () => ({
  AddStudentToSessionModal: (
    props: ComponentProps<typeof AddStudentToSessionModal>,
  ) =>
    props.isOpen ? (
      <button
        onClick={() => void props.onConfirm(mockPerson as Tables<"students">)}
      >
        Confirm student ({props.existingStudentIds.join(",")})
      </button>
    ) : null,
}));
jest.mock("@/features/sessions/components/AddStaffToSessionModal", () => ({
  AddStaffToSessionModal: (
    props: ComponentProps<typeof AddStaffToSessionModal>,
  ) =>
    props.isOpen ? (
      <button
        onClick={() => void props.onConfirm(mockPerson as Tables<"staff">)}
      >
        Confirm staff
      </button>
    ) : null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockType = "CLASS";
  mockCurrentStaff = null;
  mockHasTutorLog = false;
});

it("opens the class participant dialogs and saves confirmed students and staff", async () => {
  render(<SessionDetailPage params={{ id: "session" }} />);
  fireEvent.click(screen.getByText("Add student"));
  fireEvent.click(screen.getByText("Confirm student (existing-student)"));
  await waitFor(() =>
    expect(mockAddStudent).toHaveBeenCalledWith({
      sessionId: "session",
      studentId: "person",
    }),
  );
  await waitFor(() =>
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Student added" }),
    ),
  );
  fireEvent.click(screen.getByText("Add staff"));
  fireEvent.click(screen.getByText("Confirm staff"));
  await waitFor(() =>
    expect(mockAddStaff).toHaveBeenCalledWith({
      sessionId: "session",
      staffId: "person",
      type: "MAIN_TUTOR",
    }),
  );
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(2));
});

it("restores meeting parents and adds all participant types with the check-in staff role", async () => {
  mockType = "CHECK_IN";
  render(<SessionDetailPage params={{ id: "session" }} />);
  expect(mockDetailsProps.meetingMode).toBe(true);
  expect(mockDetailsProps.parentsData).toEqual([
    {
      parent: expect.objectContaining({ id: "existing-parent" }),
      sessionsParentsId: "sp",
    },
  ]);
  fireEvent.click(screen.getByText("Add meeting student"));
  await waitFor(() =>
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Student added" }),
    ),
  );
  fireEvent.click(screen.getByText("Add meeting staff"));
  await waitFor(() =>
    expect(mockAddStaff).toHaveBeenCalledWith({
      sessionId: "session",
      staffId: "person",
      type: defaultCheckInSessionsStaffType(true),
    }),
  );
  await waitFor(() =>
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Staff added" }),
    ),
  );
  fireEvent.click(screen.getByText("Add parent"));
  await waitFor(() =>
    expect(mockAddParent).toHaveBeenCalledWith({
      sessionId: "session",
      parentId: "person",
    }),
  );
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(3));
});

it("preserves staff-only admin meetings", () => {
  mockType = "ADMIN_MEETING";
  render(<SessionDetailPage params={{ id: "session" }} />);
  expect(mockDetailsProps.adminMeetingMode).toBe(true);
  expect(screen.queryByText("Add meeting student")).not.toBeInTheDocument();
  expect(screen.queryByText("Add parent")).not.toBeInTheDocument();
  expect(screen.getByText("Add meeting staff")).toBeInTheDocument();
});

it("does not offer class participant additions after a tutor log", () => {
  mockHasTutorLog = true;
  render(<SessionDetailPage params={{ id: "session" }} />);
  expect(screen.queryByText("Add student")).not.toBeInTheDocument();
  expect(screen.queryByText("Add staff")).not.toBeInTheDocument();
});

jest.mock("@/features/sessions/components/absences/LogAbsenceDialog", () => ({
  LogAbsenceDialog: (props: ComponentProps<typeof LogAbsenceDialog>) => (
    <>
      <output>
        Student absence: {props.initialStudentId}, session:{" "}
        {props.initialSessionId}, actor: {props.staffId}
      </output>
      <button onClick={props.onClose}>Close student absence</button>
    </>
  ),
}));
jest.mock(
  "@/features/sessions/components/absences/LogStaffAbsenceDialog",
  () => ({
    LogStaffAbsenceDialog: (
      props: ComponentProps<typeof LogStaffAbsenceDialog>,
    ) => (
      <>
        <output>
          Staff absence: {props.initialStaffId}, session:{" "}
          {props.initialSessionId}, actor: {props.staffId}
        </output>
        <button onClick={props.onClose}>Close staff absence</button>
      </>
    ),
  }),
);

it("opens absence dialogs with the clicked person and session preselected and refreshes on close", async () => {
  mockCurrentStaff = { id: "admin" };
  render(<SessionDetailPage params={{ id: "session" }} />);
  fireEvent.click(screen.getByText("Log student absence"));
  expect(
    screen.getByText(
      "Student absence: student-target, session: session, actor: admin",
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText("Close student absence"));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(/Student absence:/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Log staff absence"));
  expect(
    screen.getByText(
      "Staff absence: staff-target, session: session, actor: admin",
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText("Close staff absence"));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(2));
  expect(screen.queryByText(/Staff absence:/)).not.toBeInTheDocument();
});

jest.mock(
  "@/features/sessions/components/RemoveFromSessionConfirmDialog",
  () => ({
    RemoveFromSessionConfirmDialog: (
      props: ComponentProps<typeof RemoveFromSessionConfirmDialog>,
    ) =>
      props.isOpen ? (
        <button onClick={props.onConfirm}>
          Confirm remove {props.entityType} {props.entityName}
        </button>
      ) : null,
  }),
);
jest.mock("@/features/sessions/components/UndoLogAbsenceConfirmDialog", () => ({
  UndoLogAbsenceConfirmDialog: (
    props: ComponentProps<typeof UndoLogAbsenceConfirmDialog>,
  ) =>
    props.isOpen ? (
      <>
        <div>{props.secondaryDescription}</div>
        <button onClick={props.onConfirm}>Confirm undo</button>
      </>
    ) : null,
}));

it("requires confirmation before saving session edits and refreshes on success", async () => {
  render(<SessionDetailPage params={{ id: "session" }} />);
  act(() => mockDetailsProps.onEdit?.());
  expect(mockDetailsProps.isEditing).toBe(true);
  await act(async () =>
    mockDetailsProps.onSubmit?.({
      type: "DRAFTING",
      date: "2026-10-08",
      startTime: "17:00",
      endTime: "18:00",
      subjectId: "subject",
      classId: "old-class",
    }),
  );
  expect(mockUpdate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Save changes"));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith({
      id: "session",
      data: {
        type: "DRAFTING",
        start_at: new Date("2026-10-08T17:00").toISOString(),
        end_at: new Date("2026-10-08T18:00").toISOString(),
        subject_id: "subject",
        class_id: null,
      },
    }),
  );
  await waitFor(() => expect(mockDetailsProps.isEditing).toBe(false));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

it.each(["student", "staff", "parent"] as const)(
  "removes a %s only after confirmation",
  async (kind) => {
    render(<SessionDetailPage params={{ id: "session" }} />);
    act(() => {
      const remove =
        kind === "student"
          ? mockDetailsProps.onRemoveStudentFromSession
          : kind === "staff"
            ? mockDetailsProps.onRemoveStaffFromSession
            : mockDetailsProps.onRemoveParentFromSession;
      remove?.("person", "Test Person");
    });
    const mutate =
      kind === "student"
        ? mockRemoveStudent
        : kind === "staff"
          ? mockRemoveStaff
          : mockRemoveParent;
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(`Confirm remove ${kind} Test Person`));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({
        sessionId: "session",
        [`${kind}Id`]: "person",
      }),
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  },
);

it.each(["credit", "reschedule"] as const)(
  "undoes a student %s absence through the review dialog",
  async (action) => {
    mockCurrentStaff = { id: "admin" };
    render(<SessionDetailPage params={{ id: "session" }} />);
    act(() =>
      mockDetailsProps.onUndoLogAbsenceStudent?.({
        studentId: "student",
        studentName: "Student",
        sessionsStudentsId: "ss",
        action,
      }),
    );
    expect(mockUndoStudent).not.toHaveBeenCalled();
    if (action === "reschedule")
      expect(
        screen.getByText(
          /remove them from the rescheduled session Replacement session/,
        ),
      ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Confirm undo"));
    await waitFor(() =>
      expect(mockUndoStudent).toHaveBeenCalledWith({
        staffId: "admin",
        operations: [
          {
            student_id: "student",
            original_sessions_students_id: "ss",
            action,
          },
        ],
      }),
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  },
);

it("explains replacement removal when undoing a staff swap", async () => {
  mockCurrentStaff = { id: "admin" };
  render(<SessionDetailPage params={{ id: "session" }} />);
  act(() =>
    mockDetailsProps.onUndoLogAbsenceStaff?.({
      staffId: "staff",
      staffName: "Staff",
      sessionsStaffId: "sf",
      action: "swap",
      swappedStaffName: "Replacement",
    }),
  );
  expect(
    screen.getByText(/remove replacement staff Replacement/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText("Confirm undo"));
  await waitFor(() =>
    expect(mockUndoStaff).toHaveBeenCalledWith({
      staffId: "admin",
      operations: [
        { staff_id: "staff", original_sessions_staff_id: "sf", action: "swap" },
      ],
    }),
  );
});

it("keeps a failed absence undo open and shows the error", async () => {
  mockUndoStudent.mockResolvedValueOnce({
    success: false,
    error: "Already invoiced",
  });
  mockCurrentStaff = { id: "admin" };
  render(<SessionDetailPage params={{ id: "session" }} />);
  act(() =>
    mockDetailsProps.onUndoLogAbsenceStudent?.({
      studentId: "student",
      studentName: "Student",
      sessionsStudentsId: "ss",
      action: "credit",
    }),
  );
  fireEvent.click(screen.getByText("Confirm undo"));
  await waitFor(() =>
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Already invoiced",
        variant: "destructive",
      }),
    ),
  );
  expect(screen.getByText("Confirm undo")).toBeInTheDocument();
  expect(mockRefresh).not.toHaveBeenCalled();
});

it("opens existing tutor logs and shows files only for meetings", () => {
  mockHasTutorLog = true;
  const { rerender } = render(<SessionDetailPage params={{ id: "session" }} />);
  act(() => mockActionsProps.onEditTutorLog?.());
  expect(screen.getByText("Edit tutor log dialog")).toBeInTheDocument();
  expect(screen.queryByText("Meeting files")).not.toBeInTheDocument();
  mockType = "CHECK_IN";
  rerender(<SessionDetailPage params={{ id: "meeting" }} />);
  expect(screen.getByText("Meeting files")).toBeInTheDocument();
  expect(screen.queryByText("Edit tutor log dialog")).not.toBeInTheDocument();
});

it("navigates to adjacent class session pages", () => {
  render(<SessionDetailPage params={{ id: "session" }} />);
  // Buttons are mocked without DOM attributes; labels come from their dates.
  fireEvent.click(screen.getAllByRole("button")[0]);
  expect(mockPush).toHaveBeenCalledWith("/sessions/previous");
});

it("renders previous/next navigation in the Day field and opens the selected sibling", () => {
  render(<SessionDetailPage params={{ id: "session" }} />);
  const day = screen.getByTestId("day-field");
  const previous = screen.getByRole("button", {
    name: "Previous session in class",
  });
  const next = screen.getByRole("button", { name: "Next session in class" });
  expect(day).toContainElement(previous);
  expect(day).toContainElement(next);
  fireEvent.click(previous);
  expect(mockPush).toHaveBeenCalledWith("/sessions/previous");
  fireEvent.click(next);
  expect(mockPush).toHaveBeenCalledWith("/sessions/next");
});
