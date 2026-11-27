import type { ReactNode } from "react";
import type { RenderOptions } from "@testing-library/react";
import { ToastProvider } from "@altitutor/ui";
import { QuickActionsProvider } from "@/shared/contexts/QuickActionsContext";
import { render as rtlRender, screen, within, waitFor, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { Tables } from "@altitutor/shared";
import { SessionsCard } from "@/features/sessions/components/SessionsCard";
import { ClassCard } from "../ClassCard";
import { CalendarDetailsTooltip } from "../CalendarDetailsTooltip";
import { AdminShiftCard } from "../AdminShiftCard";

function render(ui: ReactNode, options?: RenderOptions) { return rtlRender(<ToastProvider><QuickActionsProvider>{ui}</QuickActionsProvider></ToastProvider>, options); }

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
  const sessionCard = screen.getByLabelText("Extension session details");
  expect(sessionCard).not.toHaveTextContent(/\d+\/\d+ attended/);
  await userEvent.hover(sessionCard);
  const tooltip = within(await screen.findByRole("dialog"));
  expect(tooltip.getByText("Extension session")).toBeVisible();
  expect(tooltip.getByText("Thu 22 Oct")).toBeVisible();
  expect(tooltip.getByText("Students (0/1 attended)")).toBeVisible();
  expect(tooltip.getByText("Staff (1/1 attended)")).toBeVisible();
  expect(tooltip.getByText("Alice Student")).toBeVisible();
  expect(tooltip.getByText("Absent")).toBeVisible();
  expect(
    tooltip.queryByRole("img", { name: "Actual: Absent" }),
  ).not.toBeInTheDocument();
  expect(tooltip.getByRole("img", { name: "Actual: Attended" })).toBeVisible();
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
  const tooltip = within(await screen.findByRole("dialog"));
  expect(tooltip.getByText("Extension class")).toBeVisible();
  expect(tooltip.getByText("Students (1)")).toBeVisible();
  expect(tooltip.getByText("Staff (1)")).toBeVisible();
  expect(tooltip.getByText("Future enrollment")).toBeVisible();
  expect(tooltip.getByText("Bob Tutor")).toBeVisible();
});
it("shows explicit zero student and staff counts for an empty class", async () => {
  render(
    <ClassCard
      isCalendarView
      compact
      class={{
        id: "empty-class",
        long_name: "Empty class",
        day_of_week: 1,
        start_time: "16:00",
        end_time: "17:00",
      } as Tables<"classes">}
      staff={[]}
    />,
  );

  await userEvent.hover(screen.getByLabelText("Empty class details"));
  const tooltip = within(await screen.findByRole("dialog"));
  expect(tooltip.getByText("Students (0)")).toBeVisible();
  expect(tooltip.getByText("Staff (0)")).toBeVisible();
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
  const tooltip = within(await screen.findByRole("dialog"));
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
  const tooltip = within(await screen.findByRole("dialog"));
  expect(tooltip.getByText("Alice Student")).toBeVisible();
  expect(tooltip.getByText("Bob Tutor")).toBeVisible();
  expect(
    tooltip.queryByRole("img", { name: /Actual:/ }),
  ).not.toBeInTheDocument();
});

it("uses the chip session preview with linked people and recorded attendance", async () => {
  const client = new QueryClient();
  client.setQueryData(["entity-reference", "session", "11111111-1111-4111-8111-111111111111"], {
    title: "Trial lesson", fields: [{ label: "Subject", value: "Biology" }], logged: true,
    people: [
      { role: "Student", id: "student", name: "Alice Student", plannedStatus: "attending-extra", actualAttended: null },
      { role: "Staff", id: "staff", name: "Bob Tutor", plannedStatus: "attending", actualAttended: false },
    ],
  });
  render(
    <SessionsCard
      isCalendarView
      compact
      session={
        {
          id: "11111111-1111-4111-8111-111111111111",
          long_name: "Trial lesson",
          type: "TRIAL_SESSION",
          start_at: "2026-10-22T06:30:00Z",
          end_at: "2026-10-22T07:30:00Z",
        } as Tables<"sessions">
      }
      subject={
        {
          id: "bio",
          name: "Biology",
          long_name: "Biology",
          color: "#336699",
        } as Tables<"subjects">
      }
      students={[
        {
          ...student,
          planned_absence: false,
          is_extra: true,
          sessions_students_id: "planned",
          actual_attended: null,
        },
      ]}
      staff={[{ ...staff, actual_attended: false }]}
    />,
    { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> },
  );
  await userEvent.hover(screen.getByLabelText("Trial lesson details"));
  const details = within(
    await screen.findByRole("dialog", { name: "Trial lesson details" }),
  );
  expect(details.getByText("Biology")).toBeVisible();
  expect(details.getByText("Students (0/1 attended)")).toBeVisible();
  expect(details.getByText("Staff (0/1 attended)")).toBeVisible();
  expect(details.getByRole("link", { name: "Alice Student" })).toHaveAttribute(
    "href",
    "/students/student",
  );
  expect(details.getByRole("link", { name: "Bob Tutor" })).toHaveAttribute(
    "href",
    "/staff/staff",
  );
  expect(details.getByText("Attending (extra)")).toBeVisible();
  expect(details.getAllByRole("img", { name: /Actual:/ })).toHaveLength(1);
  expect(details.getByRole("img", { name: "Actual: Absent" })).toBeVisible();
  const trigger = screen.getByRole("button", { name: "Trial lesson details" });
  const dialog = screen.getByRole("dialog", { name: "Trial lesson details" });
  await userEvent.unhover(trigger);
  await userEvent.hover(dialog);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(dialog).toBeVisible();
  const search = details.getByRole("combobox", { name: "Search menu" });
  expect(search).toHaveFocus();
  await userEvent.unhover(dialog);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(dialog).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Trial lesson details" })).not.toBeInTheDocument(),
  );
});

it("allows keyboard entry into details between calendar cards and returns on Escape", async () => {
  render(
    <>
      {["First", "Second"].map((name, index) => (
        <ClassCard
          key={name}
          isCalendarView
          compact
          class={
            {
              id: String(index),
              long_name: name,
              day_of_week: 1,
              start_time: "16:00",
              end_time: "17:00",
            } as Tables<"classes">
          }
          students={[student]}
          staff={[staff]}
        />
      ))}
    </>,
  );
  const trigger = screen.getByLabelText("First details");
  const secondTrigger = screen.getByLabelText("Second details");
  await userEvent.tab();
  await userEvent.keyboard("{ArrowDown}");
  const dialog = await screen.findByRole("dialog", { name: "First details" });
  await waitFor(() =>
    expect(
      within(dialog).getByRole("link", { name: "Alice Student" }),
    ).toHaveFocus(),
  );
  await userEvent.hover(trigger);
  await userEvent.unhover(trigger);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(dialog).toBeVisible();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await userEvent.tab();
  expect(secondTrigger).toHaveFocus();
});


it("opens calendar details on right click and closes the previous preview", async () => {
  render(
    <>
      <AdminShiftCard isCalendarView adminShift={{ id: "monday", day_of_week: 1, start_time: "16:00", end_time: "17:00" } as Tables<"admin_shifts">} staff={[staff]} />
      <AdminShiftCard isCalendarView adminShift={{ id: "tuesday", day_of_week: 2, start_time: "16:00", end_time: "17:00" } as Tables<"admin_shifts">} staff={[staff]} />
    </>,
  );
  const [monday, tuesday] = screen.getAllByRole("button", { name: "Admin shift details" });
  fireEvent.contextMenu(monday);
  expect(within(await screen.findByRole("dialog")).getByText("Monday")).toBeVisible();
  fireEvent.contextMenu(tuesday);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(within(screen.getByRole("dialog")).getByText("Tuesday")).toBeVisible();
});

it("places details vertically when neither side of a calendar card fits in its pane", async () => {
  const paneWidth = jest.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(380);
  render(<CalendarDetailsTooltip enabled title="Calendar edge" subtitle={null} staff={[]}><span>Session</span></CalendarDetailsTooltip>);
  const trigger = screen.getByLabelText("Calendar edge details");
  const bounds = jest.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
    x: 150, y: 200, left: 150, right: 230, top: 200, bottom: 240,
    width: 80, height: 40, toJSON: () => ({}),
  });

  try {
    await userEvent.hover(trigger);
    const details = await screen.findByRole("dialog", { name: "Calendar edge details" });
    expect(details.getAttribute("data-side")).toMatch(/^(top|bottom)$/);
  } finally {
    bounds.mockRestore();
    paneWidth.mockRestore();
  }
});
