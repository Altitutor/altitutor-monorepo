import { QuickActionsProvider } from "@/shared/contexts/QuickActionsContext";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MailPage } from "../MailPage";
import { AdminPageActionsTarget } from "@/shared/components/AdminPageActions";
import type { MailboxData } from "../../types";

jest.mock("@/features/quick-filters/hooks/useQuickFilters", () => ({
  useQuickFilters: () => ({ data: [] }),
}));
jest.mock("@/features/command-palette/RecordActionsContext", () => ({
  useRegisterPageActions: () => {},
}));
const mockOpenThread = jest.fn();
const mockComposeEmail = jest.fn();
jest.mock("../../hooks/useOpenEmailThread", () => ({
  useOpenEmailThread: () => mockOpenThread,
  useComposeEmail: () => mockComposeEmail,
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
const mailbox: MailboxData = {
  configured: false,
  mailboxAddress: "admin@development.altitutor.com",
  mailboxEnvironment: "development",
  currentStaffId: "admin",
  staff: [],
  templates: [],
  signature: "",
  sync: [],
  hasMore: false,
  folders: [
    { id: "inbox", role: "inbox", name: "Inbox", parent_id: null },
    { id: "archive", role: "archive", name: "Archive", parent_id: null },
  ],
  threads: [
    {
      id: "thread-one",
      messageIds: ["message-one"],
      subject: "Lesson update",
      preview: "A class update",
      sender: "parent@example.test",
      senderName: "Parent",
      at: null,
      read: false,
      draft: false,
      assignedStaffId: null,
    },
  ],
};
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
it("keeps folder navigation visible while another folder is loading", async () => {
  global.fetch = jest.fn(async (input) => {
    const url = String(input);
    if (url.includes("folder=archive"))
      return await new Promise<Response>(() => {});
    return { ok: true, json: async () => mailbox } as Response;
  });
  render(
    <QuickActionsProvider>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MailPage />
      </QueryClientProvider>
    </QuickActionsProvider>,
  );
  await screen.findByRole("button", { name: "Open Lesson update" });
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("folder=archive"),
      expect.anything(),
    ),
  );
  expect(screen.getByRole("button", { name: "Inbox" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
});
it("moves a dragged email immediately and restores it if Microsoft rejects the move", async () => {
  let failMove: (response: Response) => void = () => {};
  global.fetch = jest.fn(async (_input, init) =>
    init?.body
      ? await new Promise<Response>((resolve) => {
          failMove = resolve;
        })
      : ({ ok: true, json: async () => mailbox } as Response),
  );
  render(
    <QuickActionsProvider>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <MailPage />
      </QueryClientProvider>
    </QuickActionsProvider>,
  );
  const row = await screen.findByRole("button", { name: "Open Lesson update" });
  const values = new Map<string, string>();
  const dataTransfer = {
    types: ["application/x-altitutor-email-message-ids"],
    setData: (key: string, value: string) => values.set(key, value),
    getData: (key: string) => values.get(key) ?? "",
  };
  fireEvent.dragStart(row.parentElement!, { dataTransfer });
  fireEvent.drop(screen.getByRole("button", { name: "Archive" }), {
    dataTransfer,
  });
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Open Lesson update" }),
    ).not.toBeInTheDocument(),
  );
  await act(async () =>
    failMove({
      ok: false,
      json: async () => ({ error: "Move rejected" }),
    } as Response),
  );
  await screen.findByRole("button", { name: "Open Lesson update" });
});

it("opens a conversation when the non-button space inside its highlighted row is clicked", async () => {
  mockOpenThread.mockClear();
  global.fetch = jest.fn(
    async () => ({ ok: true, json: async () => mailbox }) as Response,
  );
  render(
    <QuickActionsProvider>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MailPage />
      </QueryClientProvider>
    </QuickActionsProvider>,
  );
  const rowButton = await screen.findByRole("button", {
    name: "Open Lesson update",
  });
  fireEvent.click(rowButton.parentElement!);
  expect(mockOpenThread).toHaveBeenCalledWith("thread-one", "Lesson update");
});

it("offers an Undo toast for a successful folder move and executes its server receipt", async () => {
  const { toast } = await import("sonner");
  const success = jest.spyOn(toast, "success");
  const commands: Array<{ action: string; ids?: string[] }> = [];
  global.fetch = jest.fn(async (_input, init) => {
    if (!init?.body) return { ok: true, json: async () => mailbox } as Response;
    const command = JSON.parse(String(init.body));
    commands.push(command);
    return {
      ok: true,
      json: async () =>
        command.action === "undo"
          ? { state: "undone" }
          : {
              state: "saved",
              undoIds: ["fa250000-0000-4000-8000-000000000099"],
            },
    } as Response;
  });
  render(
    <QuickActionsProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MailPage />
      </QueryClientProvider>
    </QuickActionsProvider>,
  );
  const row = await screen.findByRole("button", { name: "Open Lesson update" });
  const values = new Map<string, string>();
  const dataTransfer = {
    types: ["application/x-altitutor-email-message-ids"],
    setData: (key: string, value: string) => values.set(key, value),
    getData: (key: string) => values.get(key) ?? "",
  };
  fireEvent.dragStart(row.parentElement!, { dataTransfer });
  fireEvent.drop(screen.getByRole("button", { name: "Archive" }), {
    dataTransfer,
  });
  await waitFor(() =>
    expect(success).toHaveBeenCalledWith(
      "Email moved",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Undo" }),
      }),
    ),
  );
  const feedback = success.mock.calls.find(
    ([label]) => label === "Email moved",
  )?.[1];
  await act(async () => {
    const action = feedback?.action;
    if (action && typeof action === "object" && "onClick" in action)
      action.onClick({} as React.MouseEvent<HTMLButtonElement>);
  });
  await waitFor(() =>
    expect(commands.at(-1)).toEqual({
      action: "undo",
      ids: ["fa250000-0000-4000-8000-000000000099"],
    }),
  );
  success.mockRestore();
});
it("lets received and preview be independently hidden, including hiding both", async () => {
  global.fetch = jest.fn(
    async () => ({ ok: true, json: async () => mailbox }) as Response,
  );
  render(
    <QuickActionsProvider>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MailPage />
      </QueryClientProvider>
    </QuickActionsProvider>,
  );
  await screen.findByRole("button", { name: "Open Lesson update" });
  fireEvent.click(screen.getByRole("button", { name: "Display options" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Preview", pressed: true }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Received", pressed: true }),
  );
  for (const property of ["Sender", "Subject", "Assignee"])
    fireEvent.click(
      screen.getByRole("button", { name: property, pressed: true }),
    );
  for (const property of ["Sender", "Subject", "Assignee"])
    expect(
      screen.getByRole("button", { name: property, pressed: false }),
    ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Preview", pressed: false }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Received", pressed: false }),
  ).toBeInTheDocument();
});
it("selects Inbox once its first sync discovers folders", async () => {
  let discovered = false;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  global.fetch = jest.fn(
    async () =>
      ({
        ok: true,
        json: async () => ({
          ...mailbox,
          folders: discovered ? mailbox.folders : [],
        }),
      }) as Response,
  );
  render(
    <QuickActionsProvider>
      <QueryClientProvider client={client}>
        <MailPage />
      </QueryClientProvider>
    </QuickActionsProvider>,
  );
  await screen.findByRole("button", { name: "Open Lesson update" });
  await screen.findByRole("heading", { name: "All mail" });
  discovered = true;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["email", "mailbox"] });
  });
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("folder=inbox"),
      expect.anything(),
    ),
  );
});

it("places filled Compose in the shared primary header and opens the existing compose workflow", async () => {
  mockComposeEmail.mockClear();
  global.fetch = jest.fn(
    async () => ({ ok: true, json: async () => mailbox }) as Response,
  );
  const header = document.createElement("div");
  document.body.appendChild(header);
  try {
    render(
      <QuickActionsProvider>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <AdminPageActionsTarget.Provider
            value={{ primary: header, secondary: null }}
          >
            <MailPage />
          </AdminPageActionsTarget.Provider>
        </QueryClientProvider>
      </QuickActionsProvider>,
    );
    const compose = await screen.findByRole("button", {
      name: "Compose",
    });
    expect(header).toContainElement(compose);
    await waitFor(() => expect(compose).toBeEnabled());
    fireEvent.click(compose);
    expect(mockComposeEmail).toHaveBeenCalledTimes(1);
  } finally {
    header.remove();
  }
});
