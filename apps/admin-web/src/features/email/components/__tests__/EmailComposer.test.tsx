import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmailComposer } from "../EmailComposer";
import type { EmailMessage, MailboxData } from "../../types";
const draft: EmailMessage = {
  id: "shared-draft",
  threadId: "mail-thread",
  folderId: "drafts",
  subject: "Class change",
  bodyText: "Original work",
  sender: "admin@altitutor.com",
  to: ["parent@example.test"],
  cc: [],
  bcc: [],
  draft: true,
  read: true,
  removed: false,
  changeKey: "version-one",
};
const mailbox: MailboxData = {
  threads: [],
  hasMore: false,
  folders: [],
  staff: [],
  currentStaffId: "fixture-admin",
  configured: true,
  signature: "Admin Staff",
  templates: [],
  sync: [],
};
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});
it("autosaves to the shared draft and prevents another submission while the send outcome is uncertain", async () => {
  jest.useFakeTimers();
  localStorage.clear();
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "fa250000-0000-4000-8000-000000000099",
  });
  const commands: Array<{
    action: string;
    content?: { bodyText: string; expectedChangeKey: string };
    changeKey?: string;
  }> = [];
  global.fetch = jest.fn(async (_input, init) => {
    const command = JSON.parse(String(init?.body)) as (typeof commands)[number];
    commands.push(command);
    return {
      ok: true,
      json: async () =>
        command.action === "save"
          ? {
              state: "saved",
              message: {
                ...draft,
                bodyText: command.content?.bodyText,
                changeKey: "version-two",
              },
            }
          : { state: "uncertain" },
    } as Response;
  });
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
      <EmailComposer
        draft={draft}
        mailbox={mailbox}
        inline
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Email body" }), {
    target: { value: "My saved reply" },
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1100);
  });
  await waitFor(() =>
    expect(
      screen.getByText("Saved to Microsoft · shared draft"),
    ).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() =>
    expect(screen.getByText(/Send outcome is unresolved/)).toBeInTheDocument(),
  );
  expect(screen.getByRole("textbox", { name: "Email body" })).toHaveValue(
    "My saved reply",
  );
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(commands.filter((command) => command.action === "send")).toEqual([
    {
      action: "send",
      id: "shared-draft",
      changeKey: "version-two",
      commandId: "fa250000-0000-4000-8000-000000000099",
    },
  ]);
  expect(
    commands.find((command) => command.action === "save")?.content,
  ).toMatchObject({
    bodyText: "My saved reply",
    expectedChangeKey: "version-one",
  });
});
