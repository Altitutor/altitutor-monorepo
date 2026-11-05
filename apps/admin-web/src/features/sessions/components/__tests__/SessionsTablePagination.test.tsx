import * as React from "react";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/test-utils";
import { SessionsTable } from "../SessionsTable";
import { formatSessionTableDate } from "../../utils/sessionsTableHelpers";

jest.setTimeout(15000);

const mockSearchParams = new URLSearchParams();
const mockRouter = { replace: jest.fn(), push: jest.fn() };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/classes",
  useSearchParams: () => mockSearchParams,
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
jest.mock("../../hooks/useStudentSessionBillingDetails", () => ({
  useStudentSessionBillingDetails: () => ({
    invoiceDetailsById: {},
    previewsBySessionId: {},
  }),
}));
jest.mock("../../api/sessions", () => ({
  sessionsApi: {
    getAllSessionsWithDetails: async (args?: { ascending?: boolean }) => ({
      sessions: Array.from({ length: 51 }, (_, position) => {
        const index = args?.ascending === false ? 50 - position : position;
        return {
          id: `session-${index + 1}`,
          type: "CLASS",
          class_id: "class-1",
          start_at: new Date(Date.UTC(2026, 0, index + 1, 2)).toISOString(),
          end_at: new Date(Date.UTC(2026, 0, index + 1, 3)).toISOString(),
          is_active: true,
        };
      }),
      classesById: {},
      subjectsById: {},
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

function dateAt(index: number) {
  return formatSessionTableDate(
    new Date(Date.UTC(2026, 0, index + 1, 2)).toISOString(),
  );
}

it.each<[string, React.ComponentProps<typeof SessionsTable>]>([
  ["class", { classId: "class-1", skipUrlSync: false }],
  [
    "student",
    {
      skipUrlSync: true,
      studentId: "student-1",
      attendanceView: "student" as const,
    },
  ],
  [
    "staff",
    { skipUrlSync: true, staffId: "staff-1", attendanceView: "staff" as const },
  ],
  ["parent", { skipUrlSync: true, parentId: "parent-1" }],
])(
  "paginates embedded %s sessions with next, previous and page-number controls",
  async (_context, props) => {
    const user = userEvent.setup();
    renderWithProviders(<SessionsTable {...props} />);
    await screen.findByText("Page 1 of 2 • 51 total");
    const table = within(screen.getByRole("table"));
    expect(table.getByText(dateAt(0))).toBeVisible();
    expect(table.queryByText(dateAt(50))).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 2 • 51 total")).toBeVisible();
    expect(table.getByText(dateAt(50))).toBeVisible();
    expect(table.queryByText(dateAt(0))).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Page 1 of 2 • 51 total")).toBeVisible();
    expect(table.getByText(dateAt(0))).toBeVisible();

    await user.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Page 2 of 2 • 51 total")).toBeVisible();
    expect(table.getByText(dateAt(50))).toBeVisible();
    expect(table.queryByText(dateAt(0))).not.toBeInTheDocument();
  },
);

it.each([false, true])(
  "resets pagination after filter, sort and page-size changes (skipUrlSync=%s)",
  async (skipUrlSync) => {
    const user = userEvent.setup();
    renderWithProviders(
      <SessionsTable classId="class-1" skipUrlSync={skipUrlSync} />,
    );
    await screen.findByText("Page 1 of 2 • 51 total");
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 2 • 51 total")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Display options" }));
    await user.click(screen.getByRole("button", { name: "Add filter" }));
    await user.click(screen.getByRole("menuitem", { name: "Session Type" }));
    await user.click(
      await screen.findByRole("option", { name: "Class" }),
    );
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(screen.getByText("Page 1 of 2 • 51 total")).toBeVisible();
    expect(
      within(screen.getByRole("table")).getByText(dateAt(0)),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("columnheader", { name: "Date" }));
    expect(screen.getByText("Page 1 of 2 • 51 total")).toBeVisible();
    await waitFor(() =>
      expect(
        within(screen.getByRole("table")).getByText(dateAt(50)),
      ).toBeVisible(),
    );

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("combobox"));
    await user.click(
      await screen.findByRole("option", { name: "20" }),
    );
    expect(screen.getByText("Page 1 of 3 • 51 total")).toBeVisible();
    const table = within(screen.getByRole("table"));
    expect(table.getByText(dateAt(50))).toBeVisible();
    expect(table.getByText(dateAt(31))).toBeVisible();
    expect(table.queryByText(dateAt(30))).not.toBeInTheDocument();
    expect(table.getAllByRole("row")).toHaveLength(21);
  },
);
