import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Tables } from "@altitutor/shared";
import { classesApi } from "@/features/classes/api/classes";
import { useStudentClasses } from "@/features/students/hooks/useStudentClasses";
import { ClassStudentsTab } from "../tabs/ClassStudentsTab";

jest.mock("@/features/classes/api/classes", () => ({
  classesApi: { changeClass: jest.fn(), getStudentClassEnrollments: jest.fn() },
}));
jest.mock("@/shared/api", () => ({
  classesApi: jest.requireMock("@/features/classes/api/classes").classesApi,
}));
jest.mock("@/features/students", () => ({ ViewStudentModal: () => null }));
jest.mock("@/shared/hooks", () => ({
  useCurrentStaff: () => ({ data: { id: "staff" } }),
}));
jest.mock("@/features/messages/state/chatStore", () => ({
  useChatStore: () => jest.fn(),
}));
jest.mock("@/features/messages/api/queries", () => ({
  ensureConversationForRelated: jest.fn(),
}));
jest.mock("@/features/forms/components/StudentExitRequestDialog", () => ({
  StudentExitRequestDialog: () => null,
}));
jest.mock("@/features/enrollments", () => ({
  EnrollStudentModal: () => null,
  UnenrollStudentModal: () => null,
  ChangeClassModal: ({
    isOpen,
    onChange,
  }: {
    isOpen: boolean;
    onChange: (params: object) => Promise<void>;
  }) =>
    isOpen ? (
      <button
        onClick={() =>
          void onChange({
            studentId: "student",
            oldClassId: "old",
            newClassId: "new",
            lastOldClassDate: "2026-09-01",
            firstNewClassDate: "2026-09-02",
            staffId: "staff",
          })
        }
      >
        Confirm transfer
      </button>
    ) : null,
}));
jest.mock("@altitutor/ui", () => {
  const actual = jest.requireActual("@altitutor/ui");
  return { ...actual, useToast: () => ({ toast: jest.fn() }) };
});

const student = {
  id: "student",
  first_name: "Test",
  last_name: "Student",
  account_class: "CUSTOMER",
} as Tables<"students">;
const oldClass = { id: "old" } as Tables<"classes">;
const newClass = { id: "new" } as Tables<"classes">;
const enrollment = {
  id: "enrollment",
  student_id: "student",
  class_id: "old",
  enrolled_at: "2026-08-01T00:00:00Z",
  unenrolled_at: null,
} as Tables<"classes_students">;

function StudentEnrollmentObserver() {
  const { data } = useStudentClasses(student.id);
  return (
    <div data-testid="student-enrollments">
      {data
        ?.map(
          (item) =>
            `${item.class.id}:${item.isPreviousEnrollment ? "previous" : "current"}`,
        )
        .join(",")}
    </div>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(Date, "now")
    .mockReturnValue(new Date("2026-10-22T00:00:00Z").getTime());
});
afterEach(() => jest.restoreAllMocks());

it.each([
  {
    observer: "open",
    exit: "completed",
    exitAt: "2026-09-02T00:00:00Z",
    expected: "old:previous,new:current",
  },
  {
    observer: "cached",
    exit: "completed",
    exitAt: "2026-09-02T00:00:00Z",
    expected: "old:previous,new:current",
  },
  {
    observer: "open",
    exit: "scheduled",
    exitAt: "2026-11-02T00:00:00Z",
    expected: "old:current,new:current",
  },
  {
    observer: "cached",
    exit: "scheduled",
    exitAt: "2026-11-02T00:00:00Z",
    expected: "old:current,new:current",
  },
])(
  "refreshes $observer student enrollment after a $exit transfer",
  async ({ observer, exitAt, expected }) => {
    let transferred = false;
    jest
      .mocked(classesApi.getStudentClassEnrollments)
      .mockImplementation(async () => [
        {
          class: oldClass,
          subject: undefined,
          staff: [],
          students: [student],
          hasOccurredSession: true,
          enrollment: {
            ...enrollment,
            unenrolled_at: transferred ? exitAt : null,
          },
        },
        ...(transferred
          ? [
              {
                class: newClass,
                subject: undefined,
                staff: [],
                students: [student],
                hasOccurredSession: false,
                enrollment: {
                  ...enrollment,
                  id: "new-enrollment",
                  class_id: "new",
                  enrolled_at: exitAt,
                },
              },
            ]
          : []),
      ]);
    jest.mocked(classesApi.changeClass).mockImplementation(async () => {
      transferred = true;
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const renderSurfaces = (showStudent: boolean) => (
      <QueryClientProvider client={client}>
        {showStudent && <StudentEnrollmentObserver />}
        <ClassStudentsTab
          classData={oldClass}
          classStaff={[]}
          classStudents={[{ ...student, enrolled_at: enrollment.enrolled_at }]}
          allStudents={[]}
          loadingStudents={false}
        />
      </QueryClientProvider>
    );
    const { rerender, unmount } = render(renderSurfaces(true));
    await waitFor(() =>
      expect(screen.getByTestId("student-enrollments")).toHaveTextContent(
        "old:current",
      ),
    );
    if (observer === "cached") rerender(renderSurfaces(false));
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Test Student" }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Change Class" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm transfer" }),
    );
    await waitFor(() =>
      expect(classesApi.changeClass).toHaveBeenCalledTimes(1),
    );
    if (observer === "cached") rerender(renderSurfaces(true));
    await waitFor(() =>
      expect(screen.getByTestId("student-enrollments")).toHaveTextContent(
        expected,
      ),
    );
    unmount();
    client.clear();
  },
);
