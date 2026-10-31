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
import { useComposeEmail } from "../../hooks/useOpenEmailThread";
import { EmailThreadView } from "../EmailThreadView";
import { AccessoryTabs } from "@/shared/components/accessory-panel/AccessoryTabs";
jest.mock("@/shared/components/accessory-panel/AccessoryRootViews", () => ({
  AccessoryRootViews: () => null,
}));
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
});
