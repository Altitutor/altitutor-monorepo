import * as React from "react";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/test-utils";
import { SessionsTable } from "../SessionsTable";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => "/sessions",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/shared/hooks", () => ({
  useCurrentStaff: () => ({ data: { id: "staff-1" } }),
}));
jest.mock("@/features/quick-filters/hooks/useQuickFilters", () => ({
  useQuickFilters: () => ({ data: [] }),
}));
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    rpc: async () => ({ data: { students: [], total: 0 }, error: null }),
  }),
}));
jest.mock("@/features/staff/api/staff", () => ({
  staffApi: { listMinimal: async () => ({ staff: [], total: 0 }) },
}));
jest.mock("@/features/reconciliation/api/reconciliation", () => ({
  reconciliationApi: { getUninvoicedSessions: async () => [] },
}));
jest.mock("../../api/sessions", () => ({
  sessionsApi: {
    getAllSessionsWithDetails: async () => ({
      sessions: [
        {
          id: "bio",
          type: "CLASS",
          class_id: "bio-class",
          start_at: new Date(2026, 9, 22, 10).toISOString(),
          end_at: new Date(2026, 9, 22, 11).toISOString(),
          is_active: true,
        },
        {
          id: "math",
          type: "CLASS",
          class_id: "math-class",
          start_at: new Date(2026, 9, 22, 12).toISOString(),
          end_at: new Date(2026, 9, 22, 13).toISOString(),
          is_active: true,
        },
      ],
      classesById: {
        "bio-class": {
          id: "bio-class",
          subject_id: "bio-subject",
          short_name: "Bio class",
        },
        "math-class": {
          id: "math-class",
          subject_id: "math-subject",
          short_name: "Math class",
        },
      },
      subjectsById: {
        "bio-subject": {
          id: "bio-subject",
          long_name: "Biology",
          name: "Biology",
        },
        "math-subject": {
          id: "math-subject",
          long_name: "Mathematics",
          name: "Mathematics",
        },
      },
      sessionStudents: {},
      sessionStaff: {},
      tutorLogs: {},
    }),
  },
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.hasPointerCapture = jest.fn(() => false);
  Element.prototype.releasePointerCapture = jest.fn();
});

it("shares subject filtering and property visibility between the calendar and table layouts", async () => {
  function Sessions() {
    const [mode, setMode] = React.useState<"calendar" | "table">("calendar");
    return (
      <SessionsTable
        skipUrlSync
        renderMode={mode}
        initialCalendarDate="2026-10-22"
        toolbarView={{
          value: mode,
          options: [
            { value: "table", label: "Table" },
            { value: "calendar", label: "Calendar" },
          ],
          onChange: (next) => setMode(next as "table" | "calendar"),
        }}
      />
    );
  }
  renderWithProviders(<Sessions />);
  const calendar = await screen.findByLabelText("Sessions calendar");
  await waitFor(() =>
    expect(within(calendar).getAllByText("Biology").length).toBeGreaterThan(0),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Add filter" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Subject" }));
  await userEvent.click(await screen.findByRole("option", { name: "Biology" }));
  await userEvent.keyboard("{Escape}");
  await waitFor(() =>
    expect(within(calendar).queryByText("Mathematics")).not.toBeInTheDocument(),
  );
  if (!screen.queryByRole("button", { name: "Table" }))
    await userEvent.click(
      screen.getByRole("button", { name: "Display options" }),
    );
  await userEvent.click(screen.getByRole("button", { name: "Table" }));
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(
    within(screen.getByRole("table")).queryByText("Mathematics"),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Calendar" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Subject", pressed: true }),
  );
  expect(
    within(screen.getByLabelText("Sessions calendar")).queryByText("Biology"),
  ).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
});

it("changes a subject filter operator and filters the same sessions in both layouts", async () => {
  renderWithProviders(<SessionsTable skipUrlSync renderMode="table" />);
  await screen.findByText("Biology");
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Add filter" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Subject" }));
  await userEvent.click(await screen.findByRole("option", { name: "Biology" }));
  await userEvent.click(screen.getByRole("option", { name: "Mathematics" }));
  await userEvent.keyboard("{Escape}");
  if (!screen.queryByRole("button", { name: "Change operator for Subject" }))
    await userEvent.click(
      screen.getByRole("button", { name: "Display options" }),
    );
  await userEvent.click(
    screen.getByRole("button", { name: "Change operator for Subject" }),
  );
  await userEvent.click(
    await screen.findByRole("option", { name: "contains all" }),
  );
  expect(
    within(screen.getByRole("table")).queryByText("Biology"),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("table")).queryByText("Mathematics"),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Change operator for Subject" }),
  );
  await userEvent.click(
    await screen.findByRole("option", { name: "contains any" }),
  );
  expect(within(screen.getByRole("table")).getByText("Biology")).toBeVisible();
  expect(
    within(screen.getByRole("table")).getByText("Mathematics"),
  ).toBeVisible();
  await userEvent.keyboard("{Escape}");
});
