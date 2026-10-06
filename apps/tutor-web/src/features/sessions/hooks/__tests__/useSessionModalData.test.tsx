import * as React from "react";
import { render, screen } from "@testing-library/react";
import { useSessionModalData } from "../useSessionModalData";
import { AttendanceCell } from "../../components/AttendanceCell";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock("@/shared/utils/index", () => ({
  cn: jest.requireActual<typeof import("clsx")>("clsx").clsx,
}));

jest.mock("../../api/sessions", () => ({
  sessionsApi: {
    getSessionWithDetails: jest.fn().mockResolvedValue({
      session_id: "session-1",
      students: [
        {
          id: "attending",
          first_name: "Attending",
          last_name: "Student",
          planned_absence: false,
          is_credited: true,
        },
        {
          id: "credited-absence",
          first_name: "Credit",
          last_name: "Student",
          planned_absence: true,
          is_credited: true,
        },
        {
          id: "absence",
          first_name: "Absent",
          last_name: "Student",
          planned_absence: true,
        },
        {
          id: "rescheduled",
          first_name: "Rescheduled",
          last_name: "Student",
          planned_absence: true,
          is_rescheduled: true,
        },
      ],
      staff: [],
      parents: [],
    }),
    getTutorLogBySessionId: jest.fn().mockResolvedValue(null),
  },
}));

function Attendance() {
  const { studentsData } = useSessionModalData({
    isOpen: true,
    sessionId: "session-1",
  });
  return (
    <>
      {studentsData.map(({ student, plannedStatus }) => (
        <div key={student.id} data-testid={student.id}>
          <AttendanceCell status={plannedStatus} />
        </div>
      ))}
    </>
  );
}

it("renders attendance from the session view without treating credit as attendance", async () => {
  render(<Attendance />);
  expect(await screen.findByTestId("attending")).toHaveTextContent("Attending");
  expect(screen.getByTestId("credited-absence")).toHaveTextContent("Absent");
  expect(screen.getByTestId("absence")).toHaveTextContent("Absent");
  expect(screen.getByTestId("rescheduled")).toHaveTextContent("Rescheduled");
  expect(screen.queryByText("Credited")).not.toBeInTheDocument();
});
