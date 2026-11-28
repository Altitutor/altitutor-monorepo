import { randomUUID } from "node:crypto";
import { QuickActionsProvider } from "@/shared/contexts/QuickActionsContext";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MailPage } from "../MailPage";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useAuthStore } from "@/shared/lib/supabase/auth";
import type { MailboxData } from "../../types";

jest.mock("@/features/quick-filters/hooks/useQuickFilters", () => ({
  useQuickFilters: () => ({ data: [] }),
}));
const mockNavigate = jest.fn();
let mockUserId = 0;
jest.mock("../../hooks/useOpenEmailThread", () => ({
  useOpenEmailThread: () => jest.fn(),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockNavigate }),
  usePathname: () => "/email",
  useSearchParams: () => new URLSearchParams(),
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
beforeAll(() => {
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: randomUUID });
});
beforeEach(() => {
  mockNavigate.mockClear();
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(), disconnect: jest.fn(), unobserve: jest.fn(),
  }));
  HTMLElement.prototype.scrollIntoView = jest.fn();
  sessionStorage.clear();
  useAuthStore.setState({ user: { id: `mail-ui-admin-${++mockUserId}` } as User });
});

afterEach(() => {
  global.fetch = originalFetch;
  useAuthStore.setState({ user: null });
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
  fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
  fireEvent.change(await screen.findByPlaceholderText("Search folders…"), { target: { value: "arch" } });
  fireEvent.click(screen.getByRole("option", { name: "Archive" }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("folder=archive"),
      expect.anything(),
    ),
  );
  expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  expect(await screen.findByRole("option", { name: "Inbox" })).toBeInTheDocument();
});
it("moves a dragged email immediately and restores it if Microsoft rejects the move", async () => {
  const notify = jest.spyOn(toast, "error");
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
  fireEvent.drop(screen.getByRole("option", { name: "Archive" }), {
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
  expect(notify).toHaveBeenCalledWith("Could not move email", { description: "Move rejected" });
  notify.mockRestore();
});

it("opens a conversation when the non-button space inside its highlighted row is clicked", async () => {
  mockNavigate.mockClear();
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
  expect(mockNavigate).toHaveBeenCalledWith("/email?folder=inbox&conversation=thread-one", { scroll: false });
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
  fireEvent.drop(screen.getByRole("option", { name: "Archive" }), {
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
  await screen.findByRole("button", { name: "All mail" });
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

it("opens Create email in a dialog over the mailbox", async () => {
  global.fetch = jest.fn(
    async () => ({ ok: true, json: async () => mailbox }) as Response,
  );
  render(
    <QuickActionsProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MailPage />
      </QueryClientProvider>
    </QuickActionsProvider>,
  );
  const compose = await screen.findByRole("button", { name: "Create email" });
  expect(compose.closest("[data-admin-page-header]")).toHaveTextContent("Email");
  await waitFor(() => expect(compose).toBeEnabled());
  fireEvent.click(compose);
  const composer = await screen.findByRole("dialog", { name: "New email" });
  expect(within(composer).getByRole("textbox", { name: "Email subject" })).toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ method: "POST" }),
  );
});


it("loads more rows in the same list when its end comes into view", async () => {
  const originalObserver = global.IntersectionObserver;
  let intersect: (entries: Array<{ isIntersecting: boolean }>) => void = () => {};
  const observe = jest.fn();
  global.IntersectionObserver = jest.fn().mockImplementation((callback: typeof intersect) => {
    intersect = callback;
    return { observe, disconnect: jest.fn() };
  });
  global.fetch = jest.fn(async (input) => {
    const query = new URL(String(input), "http://localhost").searchParams;
    const next = query.get("offset") === "50";
    return {
      ok: true,
      json: async () => ({
        ...mailbox,
        hasMore: !next,
        threads: next
          ? [{ ...mailbox.threads[0], id: "thread-two", subject: "Older email" }]
          : mailbox.threads,
      }),
    } as Response;
  });
  try {
    render(
      <QuickActionsProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MailPage />
        </QueryClientProvider>
      </QuickActionsProvider>,
    );
    await screen.findByRole("button", { name: "Open Lesson update" });
    await waitFor(() => expect(observe).toHaveBeenCalled());
    await act(async () => intersect([{ isIntersecting: true }]));
    expect(await screen.findByRole("button", { name: "Open Older email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Lesson update" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  } finally {
    global.IntersectionObserver = originalObserver;
  }
});
