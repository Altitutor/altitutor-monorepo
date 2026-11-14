import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Tables } from "@altitutor/shared";
import { SessionsCalendarView } from "../SessionsCalendarView";

jest.mock("../../hooks/useInterviewRoundEvents", () => ({
  useInterviewRoundEvents: () => ({ data: [], isPending: false }),
}));
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
it("shows the shared subject preview for a session without a class and omits day/week controls", async () => {
  const client = new QueryClient();
  client.setQueryData(["entity-reference", "session", "11111111-1111-4111-8111-111111111111"], { title: "Private lesson", fields: [{ label: "Subject", value: "Biology" }], people: [], logged: false });
  render(
    <QueryClientProvider client={client}>
      <SessionsCalendarView
        initialDate="2026-10-22"
        source={{
          sessions: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              long_name: "Private lesson",
              type: "DRAFTING",
              subject_id: "bio",
              class_id: null,
              start_at: "2026-10-22T06:30:00Z",
              end_at: "2026-10-22T07:30:00Z",
            } as Tables<"sessions">,
          ],
          classesById: {},
          subjectsById: {
            bio: {
              id: "bio",
              long_name: "Biology",
              color: "#336699",
            } as Tables<"subjects">,
          },
          sessionStudents: {},
          sessionStaff: {},
          tutorLogs: {},
        }}
      />
    </QueryClientProvider>,
  );
  expect(screen.queryByText("1 day")).not.toBeInTheDocument();
  expect(screen.queryByText("1 week")).not.toBeInTheDocument();
  await userEvent.hover(screen.getByLabelText("Private lesson details"));
  const details = within(
    await screen.findByRole("dialog", { name: "Private lesson details" }),
  );
  expect(details.getByText("Biology")).toBeVisible();
  client.clear();
});

it("updates an unsaved meeting preview across midnight and calendar navigation", async () => {
  const client = new QueryClient();
  const source = {
    sessions: [],
    classesById: {},
    subjectsById: {},
    sessionStudents: {},
    sessionStaff: {},
    tutorLogs: {},
  };
  const view = (startAt: string, endAt: string) => (
    <QueryClientProvider client={client}>
      <SessionsCalendarView
        initialDate="2026-11-02"
        source={source}
        expandToSessions
        preview={{ title: "Check-in", startAt, endAt }}
      />
    </QueryClientProvider>
  );
  const { rerender } = render(
    view("2026-11-01T22:30:00Z", "2026-11-01T23:30:00Z"),
  );
  expect(
    screen.getByRole("note", { name: "Preview: Check-in" }),
  ).toHaveTextContent("9:00 am – 10:00 am");
  rerender(view("2026-11-02T13:00:00Z", "2026-11-02T14:00:00Z"));
  expect(
    screen.getAllByRole("note", { name: "Preview: Check-in" }),
  ).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "Next week" }));
  expect(
    screen.queryByRole("note", { name: "Preview: Check-in" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Previous week" }));
  expect(
    screen.getAllByRole("note", { name: "Preview: Check-in" }),
  ).toHaveLength(2);
  client.clear();
});

it("expands the default hours and dims the student’s session without hiding its roster", () => {
  const client = new QueryClient();
  const session = (id: string, start: string, end: string) => ({
    id, long_name: id, type: "CLASS", start_at: start, end_at: end,
  } as Tables<"sessions">);
  const absent = {
    id: "alice", first_name: "Alice", last_name: "Williams", planned_absence: true,
  } as Tables<"students"> & { planned_absence: boolean };
  const peer = { id: "bob", first_name: "Bob", last_name: "Taylor" } as Tables<"students">;
  const tutor = { id: "jo", first_name: "Jo", last_name: "Chan" } as Tables<"staff">;

  render(
    <QueryClientProvider client={client}>
      <SessionsCalendarView
        initialDate="2026-11-03"
        focusedStudentId={absent.id}
        source={{
          sessions: [
            session("Early class", "2026-11-02T22:00:00Z", "2026-11-02T23:00:00Z"),
            session("Late class", "2026-11-03T10:30:00Z", "2026-11-03T11:00:00Z"),
          ],
          classesById: {},
          subjectsById: {},
          sessionStudents: { "Early class": [absent, peer] },
          sessionStaff: { "Early class": [tutor] },
          tutorLogs: {},
        }}
      />
    </QueryClientProvider>,
  );

  expect(screen.getByText("8 AM")).toBeVisible();
  expect(screen.getByText("9 PM")).toBeVisible();
  const card = screen.getByLabelText("Early class details");
  expect(card.closest(".absolute")).toHaveClass("opacity-50");
  expect(within(card).getByText("Alice Williams")).toHaveClass("opacity-50");
  expect(within(card).getByText("Bob Taylor")).toBeVisible();
  expect(within(card).getByText("Jo Chan")).toBeVisible();
  client.clear();
});
