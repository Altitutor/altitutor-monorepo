import { QuickActionsProvider } from "@/shared/contexts/QuickActionsContext";
import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AccessoryPanelProvider,
  useAccessoryPanel,
} from "@/shared/contexts/AccessoryPanelContext";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import {
  useComposeEmail,
  useOpenEmailThread,
} from "../../hooks/useOpenEmailThread";
import { EmailThreadView } from "../EmailThreadView";
import { AccessoryTabs } from "@/shared/components/accessory-panel/AccessoryTabs";
jest.mock("@/features/messages/api/queries", () => ({
  useUnreadConversationCount: () => ({ data: 0 }),
}));
jest.mock("@/shared/hooks/usePanelMediaQuery", () => ({
  ResponsivePane: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock("@/shared/components/accessory-panel/AccessoryTabPicker", () => ({
  AccessoryTabPicker: () => <button>Add tab</button>,
}));
jest.mock("@/shared/components/accessory-panel/AccessoryViews", () => ({
  AccessoryView: () => {
    const scope = useAccessoryTab()!;
    return <EmailThreadView threadId={scope.tab.id!} />;
  },
}));
beforeAll(() => {
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "fa250000-0000-4000-8000-000000000099",
  });
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
  Element.prototype.scrollIntoView = jest.fn();
});
jest.mock("@/shared/lib/supabase/auth", () => ({
  useAuthStore: () => ({ user: { id: "mail-ui-admin" } }),
}));
jest.mock("@/shared/contexts/EntityNavigation", () => ({
  useEntityNavigation: () => ({ openEntity: jest.fn() }),
}));
jest.mock("@/features/command-palette/RecordActionsContext", () => ({
  useRegisterRecordActions: () => {},
}));
const mockPrimaryNavigation = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPrimaryNavigation,
    replace: mockPrimaryNavigation,
  }),
  usePathname: () => "/email",
  useSearchParams: () => new URLSearchParams(),
}));
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
function Workspace() {
  const compose = useComposeEmail();
  const panel = useAccessoryPanel()!;
  const tab = panel.tabs.find((item) => item.key === panel.activeKey);
  return (
    <>
      <button onClick={compose}>Compose</button>
      <output>{tab?.id ?? "No thread"}</output>
      <AccessoryTabs />
    </>
  );
}
it("opens new composition inside the existing accessory workspace and preserves typing when Microsoft gives it a thread identity", async () => {
  localStorage.clear();
  let sequence = 0;
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () =>
      `fa250700-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  });
  let prepared: (response: Response) => void = () => {};
  const create = jest.fn();
  const message = {
    id: "provider-draft",
    threadId: "provider-thread",
    subject: "",
    bodyText: "",
    sender: "admin@development.altitutor.com",
    to: [],
    cc: [],
    bcc: [],
    draft: true,
    changeKey: "one",
    removed: false,
  };
  global.fetch = jest.fn(async (input, init) => {
    if (init?.body) {
      const command = JSON.parse(String(init.body));
      if (command.action === "draft") {
        create();
        return await new Promise<Response>((resolve) => {
          prepared = resolve;
        });
      }
      return {
        ok: true,
        json: async () => ({
          state: "saved",
          message: { ...message, ...command.content, changeKey: "two" },
        }),
      } as Response;
    }
    return {
      ok: true,
      json: async () =>
        String(input).includes("/thread")
          ? {
              id: "provider-thread",
              assignedStaffId: null,
              assignedAt: null,
              links: [],
              messages: [message],
              sends: [],
            }
          : {
              threads: [],
              hasMore: false,
              folders: [],
              staff: [],
              currentStaffId: "admin",
              configured: true,
              mailboxAddress: "admin@development.altitutor.com",
              mailboxEnvironment: "development",
              signature: "",
              templates: [],
              sync: [],
            },
    } as Response;
  });
  render(
    <StrictMode>
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
          <AccessoryPanelProvider>
            <Workspace />
          </AccessoryPanelProvider>
        </QueryClientProvider>
      </QuickActionsProvider>
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Compose" }));
  const subject = await screen.findByRole("textbox", { name: "Email subject" });
  fireEvent.change(subject, { target: { value: "Work written immediately" } });
  expect(
    screen.queryByRole("dialog", { name: "Compose email" }),
  ).not.toBeInTheDocument();
  await act(async () =>
    prepared({
      ok: true,
      json: async () => ({ state: "draft", message }),
    } as Response),
  );
  await waitFor(() =>
    expect(
      screen.getByText("provider-thread", { exact: true }),
    ).toBeInTheDocument(),
  );
  expect(screen.getByRole("textbox", { name: "Email subject" })).toBe(subject);
  expect(subject).toHaveValue("Work written immediately");
  expect(
    screen.getByRole("tab", { name: "Work written immediately" }),
  ).toBeInTheDocument();
  expect(create).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Email" }));
  expect(mockPrimaryNavigation).toHaveBeenCalledWith("/email", undefined);
  expect(screen.getByRole("textbox", { name: "Email subject" })).toBe(subject);
});
const existingDraft = {
  id: "existing-draft",
  threadId: "thread-existing",
  subject: "Re: Lesson",
  bodyText: "Work already written",
  sender: "admin@development.altitutor.com",
  to: ["parent@example.test"],
  cc: [],
  bcc: [],
  draft: true,
  removed: false,
  folderId: "drafts",
  changeKey: "one",
  replyToMessageId: "original",
};
const originalMessage = {
  ...existingDraft,
  id: "original",
  subject: "Lesson",
  bodyText: "A question",
  sender: "parent@example.test",
  to: ["admin@development.altitutor.com"],
  draft: false,
  folderId: "inbox",
  read: true,
};
function existingThread(
  messages: object[],
  workspace?: React.ReactNode,
  sends: object[] = [],
) {
  global.fetch = jest.fn(
    async (input) =>
      ({
        ok: true,
        json: async () =>
          String(input).includes("/people")
            ? { person: null, ambiguous: false }
            : String(input).includes("/thread")
              ? {
                  id: "thread-existing",
                  assignedStaffId: null,
                  assignedAt: null,
                  links: [],
                  messages,
                  sends,
                }
              : {
                  threads: [],
                  hasMore: false,
                  folders: [
                    {
                      id: "drafts",
                      role: "drafts",
                      name: "Drafts",
                      parent_id: null,
                    },
                    {
                      id: "deleted",
                      role: "deleteditems",
                      name: "Deleted Items",
                      parent_id: null,
                    },
                  ],
                  staff: [],
                  currentStaffId: "admin",
                  configured: false,
                  mailboxAddress: "admin@development.altitutor.com",
                  mailboxEnvironment: "development",
                  signature: "",
                  templates: [],
                  sync: [],
                },
      }) as Response,
  );
  return render(
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
        {workspace ?? <EmailThreadView threadId="thread-existing" />}
      </QueryClientProvider>
    </QuickActionsProvider>,
  );
}
it("opens existing drafts as editable cards without an Edit step", async () => {
  existingThread([originalMessage, existingDraft]);
  expect(
    await screen.findByRole("textbox", { name: "Email subject" }),
  ).toHaveValue("Re: Lesson");
  expect(
    screen.queryByRole("button", { name: /^Edit$/ }),
  ).not.toBeInTheDocument();
});
it("does not render a deleted draft that remains in cached conversation history", async () => {
  existingThread([
    originalMessage,
    {
      ...existingDraft,
      folderId: "deleted",
      bodyText: "Deleted draft content",
    },
  ]);
  await screen.findByRole("article", { name: "Email: Lesson" });
  expect(screen.queryByText("Deleted draft content")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: "Email subject" }),
  ).not.toBeInTheDocument();
});
it("offers the same-message draft before creating another reply", async () => {
  existingThread([originalMessage, { ...existingDraft, draftMode: "reply" }]);
  await screen.findByRole("textbox", { name: "Email subject" });
  fireEvent.click(screen.getAllByRole("button", { name: /^Reply$/ })[0]);
  expect(
    await screen.findByRole("dialog", {
      name: "Continue existing reply draft?",
    }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit existing draft" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("textbox", { name: "Email subject" })).toHaveFocus();
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      body: expect.stringContaining('"action":"draft"'),
    }),
  );
});
function DraftWorkspace() {
  const open = useOpenEmailThread();
  return (
    <>
      <button
        onClick={() =>
          open("thread-existing", "Lesson", "draft", "existing-draft")
        }
      >
        Open selected draft
      </button>
      <AccessoryTabs />
    </>
  );
}
it("scrolls and focuses the specific draft selected in the folder", async () => {
  localStorage.clear();
  const scroll = jest.spyOn(Element.prototype, "scrollIntoView");
  scroll.mockClear();
  existingThread(
    [originalMessage, existingDraft],
    <AccessoryPanelProvider>
      <DraftWorkspace />
    </AccessoryPanelProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open selected draft" }));
  const subject = await screen.findByRole("textbox", { name: "Email subject" });
  await waitFor(() => expect(subject).toHaveFocus());
  expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
});
it("recognizes an Outlook draft by explicit In-Reply-To rather than its subject", async () => {
  existingThread([
    { ...originalMessage, internetMessageId: "<original@example.test>" },
    {
      ...existingDraft,
      replyToMessageId: undefined,
      replyToInternetMessageIds: ["<original@example.test>"],
    },
  ]);
  await screen.findByRole("textbox", { name: "Email subject" });
  fireEvent.click(screen.getAllByRole("button", { name: /^Reply$/ })[0]);
  expect(
    await screen.findByRole("dialog", {
      name: "Continue existing reply draft?",
    }),
  ).toBeInTheDocument();
});
it("flushes both dirty drafts before closing their shared tab", async () => {
  localStorage.clear();
  const drafts = [
    existingDraft,
    { ...existingDraft, id: "second-draft", subject: "Second draft" },
  ];
  existingThread(
    [originalMessage, ...drafts],
    <AccessoryPanelProvider>
      <DraftWorkspace />
    </AccessoryPanelProvider>,
  );
  const get = global.fetch!;
  const pending = new Map<string, (value: Response) => void>();
  const savedIds: string[] = [];
  global.fetch = jest.fn(async (input, init) => {
    if (!init?.body) return get(input, init);
    const command = JSON.parse(String(init.body));
    if (command.action === "save") {
      savedIds.push(command.id);
      return await new Promise<Response>((resolve) =>
        pending.set(command.id, resolve),
      );
    }
    return { ok: true, json: async () => ({ state: "released" }) } as Response;
  });
  fireEvent.click(screen.getByRole("button", { name: "Open selected draft" }));
  const subjects = await screen.findAllByRole("textbox", {
    name: "Email subject",
  });
  expect(subjects).toHaveLength(2);
  subjects.forEach((subject, index) =>
    fireEvent.change(subject, { target: { value: "Changed " + index } }),
  );
  fireEvent.click(screen.getByRole("button", { name: /^Close .* tab$/ }));
  const legacyMenu = screen.queryByRole("menuitem", { name: "Close draft" });
  if (legacyMenu) fireEvent.click(legacyMenu);
  await waitFor(() => expect(pending.size).toBe(1));
  // The browser must prevent further edits/replies while a multi-draft flush waits.
  const conversation = screen.getByLabelText("Email conversation");
  expect(conversation).toHaveAttribute("inert");
  expect(conversation).toHaveAttribute("aria-busy", "true");
  const [firstId, resolveFirst] = [...pending.entries()][0];
  await act(async () =>
    resolveFirst({
      ok: true,
      json: async () => ({
        state: "saved",
        message: {
          ...drafts.find((item) => item.id === firstId),
          subject: "Saved work",
          changeKey: "two",
        },
      }),
    } as Response),
  );
  await waitFor(() =>
    expect(new Set(savedIds)).toEqual(new Set(drafts.map((item) => item.id))),
  );
  expect(screen.getByRole("tab")).toBeInTheDocument();
  expect(conversation).toHaveAttribute("inert");
  const [secondId, resolveSecond] = [...pending.entries()].find(
    ([id]) => id !== firstId,
  )!;
  await act(async () =>
    resolveSecond({
      ok: true,
      json: async () => ({
        state: "saved",
        message: {
          ...drafts.find((item) => item.id === secondId),
          subject: "Saved work",
          changeKey: "two",
        },
      }),
    } as Response),
  );
  await waitFor(() =>
    expect(screen.queryByRole("tab")).not.toBeInTheDocument(),
  );
});
it("keeps the same draft editor mounted when Messages are hidden and shown", async () => {
  existingThread([originalMessage, existingDraft]);
  const subject = await screen.findByRole("textbox", { name: "Email subject" });
  fireEvent.change(subject, {
    target: { value: "Work retained across visibility" },
  });
  fireEvent.keyDown(
    screen.getByRole("button", { name: "Show messages and Activity" }),
    { key: "Enter", code: "Enter" },
  );
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: "Messages" }),
  );
  expect(subject).toBeInTheDocument();
  expect(subject).not.toBeVisible();
  fireEvent.keyDown(document.activeElement!, { key: "Escape", code: "Escape" });
  fireEvent.keyDown(
    screen.getByRole("button", { name: "Show messages and Activity" }),
    { key: "Enter", code: "Enter" },
  );
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: "Messages" }),
  );
  expect(screen.getByRole("textbox", { name: "Email subject" })).toBe(subject);
  expect(subject).toHaveValue("Work retained across visibility");
});

it("shows a full scheduled-email preview and send time instead of an editable draft", async () => {
  existingThread([originalMessage, existingDraft], undefined, [
    {
      message_id: existingDraft.id,
      state: "scheduled",
      scheduled_at: "2026-12-01T02:30:00Z",
      command_id: "fa250000-0000-4000-8000-000000000099",
      updated_at: "2026-11-01T00:00:00Z",
    },
  ]);
  expect(
    await screen.findByRole("region", { name: "Scheduled email" }),
  ).toHaveTextContent("Work already written");
  expect(
    screen.getByRole("region", { name: "Scheduled email" }),
  ).toHaveTextContent("1 Dec 2026");
  expect(
    screen.queryByRole("textbox", { name: "Email body" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Cancel schedule" }),
  ).toBeInTheDocument();
});
