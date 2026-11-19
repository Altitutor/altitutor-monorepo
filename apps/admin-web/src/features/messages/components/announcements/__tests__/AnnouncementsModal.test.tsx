import { randomUUID } from "node:crypto";
import { render, screen, waitFor, within } from "@testing-library/react";
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
const students = [
  {
    id: "alice",
    first_name: "Alice",
    last_name: "Williams",
    phone: "+61400000001",
    deleted_at: null,
  },
  {
    id: "bob",
    first_name: "Bob",
    last_name: "Taylor",
    phone: "+61400000002",
    deleted_at: null,
  },
];
const insert = jest.fn();
let insertError: { code: string; message: string } | null = null;
const requests: string[] = [];
const dispatch = jest.fn();
function query(table: string) {
  let inserting = false;
  let selected = "";
  const rows: Record<string, unknown[]> = {
    students,
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
    contacts: students.map((row) => ({
      id: `contact-${row.id}`,
      student_id: row.id,
      is_opted_out: false,
    })),
    conversations: students.map((row) => ({
      id: `conversation-${row.id}`,
      contact_id: `contact-${row.id}`,
    })),
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
      return Promise.resolve(resolve({ data: rows[table] ?? [], error: null }));
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
