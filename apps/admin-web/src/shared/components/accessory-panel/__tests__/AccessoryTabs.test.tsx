import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AccessoryPanelProvider,
  useAccessoryPanel,
} from "@/shared/contexts/AccessoryPanelContext";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { EntityNavigationEvents } from "@/shared/contexts/EntityNavigation";
import { AccessoryTabs } from "../AccessoryTabs";
jest.mock("@/features/messages/api/queries", () => ({
  useUnreadConversationCount: () => ({ data: 3 }),
}));
jest.mock("@/features/topics/components", () => ({
  FilePreviewModal: () => null,
  GenericFilePreviewModal: () => null,
}));
const mockPrimaryPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPrimaryPush }),
  usePathname: () => "/students",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/shared/lib/supabase/auth", () => ({
  useAuthStore: () => ({ user: { id: "test-tabs" } }),
}));
jest.mock("@/shared/hooks/usePanelMediaQuery", () => ({
  ResponsivePane: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock("../AccessoryTabPicker", () => ({
  AccessoryTabPicker: () => <button>Add tab</button>,
}));
jest.mock("../AccessoryViews", () => ({
  AccessoryView: () => {
    const scope = useAccessoryTab()!;
    return (
      <>
        <button
          onClick={() =>
            scope.navigate({ kind: "issue", id: "a", title: "Issue A" })
          }
        >
          Open issue
        </button>
        <button
          onClick={() =>
            scope.navigate({ kind: "task", id: "b", title: "Task B" })
          }
        >
          Linked task
        </button>
        <button
          onClick={() => scope.navigate({ kind: "issue", id: "original", title: "Original issue" })}
        >
          Back to issues
        </button>
        <button
          data-testid="mention"
          onClick={(event) =>
            event.currentTarget.dispatchEvent(
              new CustomEvent("mentionClick", {
                bubbles: true,
                detail: { type: "issue", id: "mentioned" },
              }),
            )
          }
        >
          Mention
        </button>
        {/* A test-only plain anchor exercises navigation interception. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/issues/linked">Linked issue</a>
      </>
    );
  },
}));
function Harness() {
  const panel = useAccessoryPanel()!;
  return (
    <>
      <button
        onClick={() =>
          panel.openTab({
            kind: "issue",
            id: "original",
            title: "Original issue",
            query: "search=math",
          })
        }
      >
        Start
      </button>
      <output data-testid="workspace">{JSON.stringify(panel.tabs)}</output>
      <AccessoryTabs />
    </>
  );
}
const tabs = () => JSON.parse(screen.getByTestId("workspace").textContent!);
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => `${Math.random()}`,
  });
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({ matches: false, media: query, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  Element.prototype.hasPointerCapture = jest.fn(() => false);
  Element.prototype.releasePointerCapture = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
test("same-family records replace the current tab, cross-family links add a tab, and returning restores filters", async () => {
  render(
    <AccessoryPanelProvider>
      <Harness />
    </AccessoryPanelProvider>,
  );
  fireEvent.click(await screen.findByText("Start"));
  const key = tabs()[0].key;
  fireEvent.click(screen.getByText("Open issue"));
  expect(tabs()).toHaveLength(1);
  expect(tabs()[0]).toMatchObject({ key, kind: "issue", id: "a" });
  fireEvent.click(screen.getByText("Back to issues"));
  expect(tabs()[0]).toMatchObject({ kind: "issue", id: "original", query: "search=math" });
  fireEvent.click(screen.getByText("Open issue"));
  fireEvent.click(screen.getByText("Linked task"));
  expect(tabs()).toHaveLength(2);
  expect(tabs()[1].kind).toBe("task");
  await waitFor(() =>
    expect(localStorage.getItem("admin-accessory-v1:test-tabs")).toContain(
      "search=math",
    ),
  );
});

test("links and bubbled mentions navigate their originating accessory tab", async () => {
  render(
    <AccessoryPanelProvider>
      <EntityNavigationEvents>
        <Harness />
      </EntityNavigationEvents>
    </AccessoryPanelProvider>,
  );
  fireEvent.click(await screen.findByText("Start"));
  fireEvent.click(screen.getByText("Linked issue"));
  expect(tabs()).toHaveLength(1);
  expect(tabs()[0]).toMatchObject({ kind: "issue", id: "linked" });
  fireEvent.click(screen.getByTestId("mention"));
  expect(tabs()).toHaveLength(1);
  expect(tabs()[0]).toMatchObject({ kind: "issue", id: "mentioned" });
});

it("offers only recently closed in an empty panel", () => {
  render(<AccessoryPanelProvider><Harness /></AccessoryPanelProvider>);
  expect(screen.getByText("Recently closed")).toBeInTheDocument();
  for (const title of ["Messages", "Tasks", "Issues", "Projects", "Documents"]) {
    expect(screen.queryByRole("button", { name: title })).not.toBeInTheDocument();
  }
});
