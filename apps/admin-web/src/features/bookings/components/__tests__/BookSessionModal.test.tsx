import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/shared/test-utils";
import { ManualMeetingModal } from "../ManualMeetingModal";

const mockOriginalSession = jest.fn();
const mockDurationSetting = jest.fn();

jest.mock("@/shared/hooks", () => ({
  useCurrentStaff: () => ({ data: null }),
}));
jest.mock("@/features/sessions/api/sessions", () => ({
  sessionsApi: {
    getSessionWithTutorLog: (...args: unknown[]) =>
      mockOriginalSession(...args),
    getAllSessionsWithDetails: async () => ({
      sessions: [],
      classesById: {},
      subjectsById: {},
      sessionStaff: {},
      sessionStudents: {},
      tutorLogs: {},
    }),
  },
}));
jest.mock("../../api/settings", () => ({
  bookingSettingsApi: {
    getSessionDurationMinutes: () => mockDurationSetting(),
  },
}));
jest.mock("../../api/meeting-family", () => ({
  getMeetingFamilySuggestions: async (
    _students: string[],
    parents: string[],
  ) => ({
    students: [],
    parents: parents.length
      ? []
      : [
          {
            id: "00000000-0000-4000-8000-000000000003",
            first_name: "Suggested",
            last_name: "Parent",
          },
        ],
  }),
}));
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => {
    const result = { data: [], error: null };
    const query = {
      select: () => query,
      filter: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      then: (resolve: (value: typeof result) => void) =>
        Promise.resolve(result).then(resolve),
    };
    return { from: () => query };
  },
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
});
beforeEach(() => {
  mockDurationSetting.mockResolvedValue(60);
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => ({
    ok: true,
    json: async () =>
      init?.method === "POST"
        ? { sessionId: "created-meeting" }
        : [
            {
              staff_id: "00000000-0000-4000-8000-000000000004",
              reason: "Staff has a blockout",
            },
          ],
  })) as jest.Mock;
});

it("keeps flexible participant tables and makes family suggestions optional", async () => {
  renderWithProviders(
    <ManualMeetingModal
      isOpen
      onClose={jest.fn()}
      sessionType="ADMIN_MEETING"
      initialPrefill={{
        students: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            first_name: "First",
            last_name: "Student",
          },
          {
            id: "00000000-0000-4000-8000-000000000002",
            first_name: "Second",
            last_name: "Student",
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("Students (2)")).toBeVisible();
  expect(screen.getByText("Parents (0)")).toBeVisible();
  fireEvent.click(
    await screen.findByRole("button", { name: "Add parent Suggested Parent" }),
  );
  expect(screen.getByText("Parents (1)")).toBeVisible();
  expect(screen.getByText("Suggested Parent")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByLabelText("Sessions calendar")).toBeInTheDocument();
});

it("allows confirmation despite an availability warning and keeps messaging optional after booking", async () => {
  const onCreated = jest.fn();
  renderWithProviders(
    <ManualMeetingModal
      isOpen
      onClose={jest.fn()}
      sessionType="CHECK_IN"
      onBookingCreated={onCreated}
      initialPrefill={{
        staff: [
          {
            id: "00000000-0000-4000-8000-000000000004",
            first_name: "Busy",
            last_name: "Staff",
          },
        ],
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(
    await screen.findByText(/Busy Staff: Staff has a blockout/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/sessions/manual-meeting",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"type":"CHECK_IN"'),
      }),
    ),
  );
  expect(await screen.findByText("Check-in booked successfully")).toBeVisible();
  expect(onCreated).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(onCreated).toHaveBeenCalledWith("created-meeting", [
    "00000000-0000-4000-8000-000000000004",
  ]);
});

it("waits for existing meeting hydration before allowing a reschedule", () => {
  mockOriginalSession.mockReturnValue(new Promise(() => {}));
  renderWithProviders(
    <ManualMeetingModal
      isOpen
      onClose={jest.fn()}
      sessionType="TRIAL_SESSION"
      originalSessionId="00000000-0000-4000-8000-000000000009"
    />,
  );
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(screen.getByText("Loading existing meeting…")).toBeVisible();
});

it("applies a configured duration after it loads", async () => {
  mockDurationSetting.mockResolvedValue(75);
  renderWithProviders(
    <ManualMeetingModal
      isOpen
      onClose={jest.fn()}
      sessionType="TRIAL_SESSION"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Duration" })).toHaveTextContent(
      "75",
    ),
  );
});
