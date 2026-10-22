import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Tables } from "@altitutor/shared";
import { SessionsCard } from "@/features/sessions/components/SessionsCard";
import { ClassCard } from "../ClassCard";
import { AdminShiftCard } from "../AdminShiftCard";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
const student = {
  id: "student",
  first_name: "Alice",
  last_name: "Student",
  enrolled_at: "2099-01-01",
  planned_absence: true,
  actual_attended: false,
} as Tables<"students"> & {
  enrolled_at: string;
  planned_absence: boolean;
  actual_attended: boolean;
};
const staff = {
  id: "staff",
  first_name: "Bob",
  last_name: "Tutor",
  planned_absence: false,
  actual_attended: true,
} as Tables<"staff"> & { planned_absence: boolean; actual_attended: boolean };

it("shows full session details and planned/actual attendance on calendar hover", async () => {
  render(
    <SessionsCard
      hasTutorLog
      isCalendarView
      compact
      session={
        {
          id: "s",
          long_name: "Extension session",
          start_at: "2026-10-22T06:30:00Z",
          end_at: "2026-10-22T07:30:00Z",
          status: "COMPLETED",
        } as Tables<"sessions">
      }
      students={[{ ...student, actual_attended: null }]}
      staff={[staff]}
    />,
  );
  await userEvent.hover(screen.getByLabelText("Extension session details"));
  const tooltip = within(await screen.findByRole("tooltip"));
  expect(tooltip.getByText("Extension session")).toBeVisible();
  expect(tooltip.getByText("Thu 22 Oct")).toBeVisible();
  expect(tooltip.getByText("Alice Student")).toBeVisible();
  expect(tooltip.getByText("Planned: Absent")).toBeVisible();
  expect(tooltip.getByText("Actual: Did not attend")).toBeVisible();
  expect(tooltip.getByText("Actual: Attended")).toBeVisible();
});
it("shows class enrollment details on keyboard focus", async () => {
  render(
    <ClassCard
      isCalendarView
      compact
      class={
        {
          id: "c",
          long_name: "Extension class",
          day_of_week: 1,
          start_time: "16:00",
          end_time: "17:00",
          status: "ACTIVE",
        } as Tables<"classes">
      }
      students={[student]}
      staff={[staff]}
    />,
  );
  await userEvent.tab();
  const tooltip = within(await screen.findByRole("tooltip"));
  expect(tooltip.getByText("Extension class")).toBeVisible();
  expect(tooltip.getByText("Future enrollment")).toBeVisible();
  expect(tooltip.getByText("Bob Tutor")).toBeVisible();
});
it("shows admin shift day/time and staff on hover", async () => {
  render(
    <AdminShiftCard
      isCalendarView
      compact
      adminShift={
        {
          id: "a",
          day_of_week: 2,
          start_time: "16:00",
          end_time: "17:00",
        } as Tables<"admin_shifts">
      }
      staff={[staff]}
    />,
  );
  await userEvent.hover(screen.getByLabelText("Admin shift details"));
  const tooltip = within(await screen.findByRole("tooltip"));
  expect(tooltip.getByText("Admin shift")).toBeVisible();
  expect(tooltip.getByText("Tuesday")).toBeVisible();
  expect(tooltip.getByText("Bob Tutor")).toBeVisible();
});

it("keeps full details when card properties are hidden and identifies unlogged attendance", async () => {
  render(
    <SessionsCard
      isCalendarView
      compact
      session={
        {
          id: "hidden",
          long_name: "Hidden properties session",
          start_at: "2026-10-22T06:30:00Z",
          end_at: "2026-10-22T07:30:00Z",
        } as Tables<"sessions">
      }
      students={[]}
      staff={[]}
      details={{
        students: [{ ...student, actual_attended: null }],
        staff: [{ ...staff, actual_attended: null }],
      }}
    />,
  );
  await userEvent.hover(
    screen.getByLabelText("Hidden properties session details"),
  );
  const tooltip = within(await screen.findByRole("tooltip"));
  expect(tooltip.getByText("Alice Student")).toBeVisible();
  expect(tooltip.getByText("Bob Tutor")).toBeVisible();
  expect(tooltip.getAllByText("Actual: Not logged")).toHaveLength(2);
});
