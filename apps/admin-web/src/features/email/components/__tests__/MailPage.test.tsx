import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MailPage } from "../MailPage";
import type { MailboxData } from "../../types";

jest.mock("@/features/quick-filters/hooks/useQuickFilters", () => ({
  useQuickFilters: () => ({ data: [] }),
}));
jest.mock("@/features/command-palette/RecordActionsContext", () => ({
  useRegisterPageActions: () => {},
}));
jest.mock("../../hooks/useOpenEmailThread", () => ({
  useOpenEmailThread: () => jest.fn(),
  useComposeEmail: () => jest.fn(),
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
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MailPage />
    </QueryClientProvider>,
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
    </QueryClientProvider>,
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
