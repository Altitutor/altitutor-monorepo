import { randomUUID } from "node:crypto";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnnouncementsModal } from "../AnnouncementsModal";
import { useAuthStore } from "@/shared/lib/supabase/auth";
import type { User } from "@supabase/supabase-js";

jest.mock("@/shared/components", () => ({
  AdminDialogShell: ({
    children,
    footer,
    title,
  }: {
    children: React.ReactNode;
    footer: React.ReactNode;
    title: string;
  }) => (
    <div role="dialog" aria-label={title}>
      {children}
      {footer}
    </div>
  ),
}));
jest.mock("@/shared/components/EntityActionChip", () => ({
  EntityActionChip: ({ label }: { label: string }) => <span>{label}</span>,
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
const students = [
  {
    id: "alice",
    first_name: "Alice",
    last_name: "Williams",
    phone: "+61400000001",
    registration_public_token: "fixture-registration-alice",
    deleted_at: null,
  },
  {
    id: "bob",
    first_name: "Bob",
    last_name: "Taylor",
    phone: "+61400000002",
    registration_public_token: "fixture-registration-bob",
    deleted_at: null,
  },
];
const insert = jest.fn();
let insertError: { code: string; message: string } | null = null;
let sessionRows: Array<{ id: string; short_name: string; start_at: string }> =
  [];
let deliveryStatuses: string[] = [];
let deliveryRead = 0;
const requests: string[] = [];
const dispatch = jest.fn();
function query(table: string) {
  let inserting = false;
  let selected = "";
  const parent = {
    id: "parent",
    first_name: "Robert",
    last_name: "Williams",
    phone: "+61400000003",
    deleted_at: null,
  };
  const rows: Record<string, unknown[]> = {
    parents: [parent],
    parents_students: [
      {
        parent_id: "parent",
        student_id: "alice",
        student: students[0],
        parent,
      },
    ],
    students,
    sessions: sessionRows,
    sessions_students: [{ student: students[0] }, { student: students[0] }],
    staff: [
      {
        id: "staff",
        user_id: "auth",
        first_name: "Admin",
        last_name: "User",
        role: "ADMINSTAFF",
        status: "ACTIVE",
      },
    ],
    owned_numbers: [
      {
        id: "sender",
        label: "iMessage",
        is_default: true,
        provider: "IMESSAGE",
        sender_type: "PHONE",
        phone_e164: "+61400000000",
      },
    ],
    contacts: [
      { id: "contact-parent", parent_id: "parent", is_opted_out: false },
      ...students.map((row) => ({
        id: `contact-${row.id}`,
        student_id: row.id,
        is_opted_out: false,
      })),
    ],
    conversations: [
      { id: "conversation-parent", contact_id: "contact-parent" },
      ...students.map((row) => ({
        id: `conversation-${row.id}`,
        contact_id: `contact-${row.id}`,
      })),
    ],
    messages: insertError
      ? []
      : [
          { id: "message-alice", status: "QUEUED", error_message: null },
          { id: "message-bob", status: "QUEUED", error_message: null },
        ],
  };
  const chain = {
    select: (columns: string) => {
      selected = columns;
      return chain;
    },
    eq: () => chain,
    is: () => chain,
    or: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    ilike: () => chain,
    gte: () => chain,
    lt: () => chain,
    range: () => chain,
    insert: (value: unknown) => {
      inserting = true;
      insert(value);
      return chain;
    },
    single: async () => ({
      data: inserting
        ? { id: `message-${insert.mock.calls.length === 1 ? "alice" : "bob"}` }
        : rows[table]?.[0],
      error: inserting ? insertError : null,
    }),
    maybeSingle: async () => ({ data: rows[table]?.[0] ?? null, error: null }),
    then: (resolve: (result: { data: unknown[]; error: null }) => unknown) => {
      requests.push(`${table}:${selected}`);
      const status =
        table === "messages" && !inserting && deliveryStatuses.length
          ? deliveryStatuses[
              Math.min(deliveryRead++, deliveryStatuses.length - 1)
            ]
          : null;
      const data = status
        ? (rows[table] ?? []).map((row) => ({
            ...(row as Record<string, unknown>),
            status,
          }))
        : (rows[table] ?? []);
      return Promise.resolve(resolve({ data, error: null }));
    },
  };
  return chain;
}
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({ from: query, functions: { invoke: dispatch } }),
}));
function setup(
  props: Partial<React.ComponentProps<typeof AnnouncementsModal>> = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const close = jest.fn();
  return {
    client,
    close,
    ...render(
      <QueryClientProvider client={client}>
        <AnnouncementsModal
          isOpen
          onClose={close}
          initialStudentIds={["alice", "bob"]}
          {...props}
        />
      </QueryClientProvider>,
    ),
  };
}
beforeEach(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: randomUUID,
  });
  insertError = null;
  sessionRows = [];
  deliveryStatuses = [];
  deliveryRead = 0;
  insert.mockClear();
  requests.length = 0;
  useAuthStore.setState({ user: { id: "auth" } as User, loading: false });
});

test("prefilled people have individual parent toggles defaulting off, with a toggle for all", async () => {
  const view = setup();
  await screen.findByText("Alice Williams");
  expect(
    screen.getByRole("switch", { name: "Send to parent of Alice Williams" }),
  ).not.toBeChecked();
  await userEvent.click(
    screen.getByRole("switch", { name: "Toggle all parents" }),
  );
  expect(
    screen.getByRole("switch", { name: "Send to parent of Alice Williams" }),
  ).toBeChecked();
  expect(
    screen.getByRole("switch", { name: "Send to parent of Bob Taylor" }),
  ).toBeChecked();
  await userEvent.click(
    screen.getByRole("switch", { name: "Send to parent of Alice Williams" }),
  );
  expect(
    screen.getByRole("switch", { name: "Send to parent of Bob Taylor" }),
  ).toBeChecked();
  view.unmount();
  view.client.clear();
});

test("a plain-name broadcast queues once per person without class lookups or claiming it was sent", async () => {
  const view = setup();
  await screen.findByText("Alice Williams");
  await userEvent.click(screen.getByRole("button", { name: "Compose" }));
  await userEvent.type(screen.getByLabelText("Message"), "Hello there");
  await userEvent.click(screen.getByRole("button", { name: "Review" }));
  await screen.findByRole("button", { name: "Queue 2 messages" });
  expect(
    requests.filter(
      (value) =>
        value.startsWith("classes_students:") ||
        value.startsWith("sessions_students:"),
    ),
  ).toHaveLength(0);
  await userEvent.dblClick(
    screen.getByRole("button", { name: "Queue 2 messages" }),
  );
  await waitFor(() => expect(insert).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getAllByText("QUEUED")).toHaveLength(2));
  expect(screen.queryByText("Announcements Sent!")).not.toBeInTheDocument();
  expect(dispatch).not.toHaveBeenCalled(); // Durable iMessage commands are trigger-owned.
  const dialog = screen.getByRole("dialog", { name: "Bulk message" });
  expect(within(dialog).getByText("Alice Williams")).toBeInTheDocument();
  view.unmount();
  view.client.clear();
});

test("lost insert acknowledgements remain unconfirmed and are never retried automatically", async () => {
  const view = setup();
  await screen.findByText("Alice Williams");
  await userEvent.click(screen.getByRole("button", { name: "Compose" }));
  await userEvent.type(screen.getByLabelText("Message"), "A local test");
  await userEvent.click(screen.getByRole("button", { name: "Review" }));
  await screen.findByRole("button", { name: "Queue 2 messages" });
  insertError = { code: "", message: "TypeError: Failed to fetch" };
  await userEvent.click(
    screen.getByRole("button", { name: "Queue 2 messages" }),
  );
  await waitFor(() =>
    expect(screen.getAllByText("UNCONFIRMED")).toHaveLength(2),
  );
  expect(screen.queryByText("FAILED")).not.toBeInTheDocument();
  expect(insert).toHaveBeenCalledTimes(2);
  expect(insert.mock.calls[0][0].id).toMatch(/^[0-9a-f-]{36}$/);
  view.unmount();
  view.client.clear();
});

test("overlapping selected sessions add a student only once", async () => {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(1, 0, 0, 0);
  sessionRows = [
    { id: "a", short_name: "Session A", start_at: monday.toISOString() },
    { id: "b", short_name: "Session B", start_at: monday.toISOString() },
  ];
  const view = setup({ initialStudentIds: [] });
  await userEvent.click(
    screen.getByRole("combobox", { name: "Add by session" }),
  );
  await screen.findAllByRole("button", { name: "Session A" });
  await userEvent.click(
    screen.getAllByRole("button", { name: "Session A" })[0],
  );
  await userEvent.click(
    screen.getAllByRole("button", { name: "Session B" })[0],
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Add students from 2 sessions" }),
  );
  await waitFor(() =>
    expect(
      screen.getAllByText("Alice Williams"),
    ).toHaveLength(1),
  );
  expect(screen.queryByRole("checkbox", { name: "Include Alice Williams" })).not.toBeInTheDocument();
  view.unmount();
  view.client.clear();
});

test("a directly selected parent previews the linked child and a nested link placeholder", async () => {
  const view = setup({ initialStudentIds: [] });
  await userEvent.click(screen.getByText("Add parent"));
  await userEvent.type(screen.getByPlaceholderText("Search name…"), "Robert");
  await userEvent.click(
    await screen.findByRole("option", { name: "Robert Williams" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Compose" }));
  fireEvent.change(screen.getByLabelText("Message"), {
    target: {
      value:
        "Hi {parent.student1.first_name}. {parent.student1.registration_link}",
    },
  });
  await userEvent.click(screen.getByRole("button", { name: "Review" }));
  expect(
    await screen.findByText("Hi Alice. [registration link]"),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Queue 1 messages" }),
  );
  await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
  expect(insert.mock.calls[0][0].body).toContain("fixture-registration-alice");
  expect(insert.mock.calls[0][0].conversation_id).toBe("conversation-parent");
  view.unmount();
  view.client.clear();
});

test("delivery progress observes a SENT message becoming UNDELIVERED", async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  deliveryStatuses = ["SENT", "UNDELIVERED"];
  const view = setup();
  try {
    await screen.findByText("Alice Williams");
    await user.click(screen.getByRole("button", { name: "Compose" }));
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Hello" },
    });
    await user.click(screen.getByRole("button", { name: "Review" }));
    await screen.findByRole("button", { name: "Queue 2 messages" });
    await user.click(screen.getByRole("button", { name: "Queue 2 messages" }));
    await waitFor(() => expect(screen.getAllByText("SENT")).toHaveLength(2));
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    await waitFor(() =>
      expect(screen.getAllByText("UNDELIVERED")).toHaveLength(2),
    );
  } finally {
    view.unmount();
    view.client.clear();
    jest.useRealTimers();
  }
});
