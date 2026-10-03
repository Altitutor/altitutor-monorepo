import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AccessoryPanelProvider,
  useAccessoryPanel,
} from "@/shared/contexts/AccessoryPanelContext";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { EntityNavigationEvents } from "@/shared/contexts/EntityNavigation";
import { AccessoryTabs } from "../AccessoryTabs";
jest.mock("@/features/topics/components", () => ({
  FilePreviewModal: () => null,
  GenericFilePreviewModal: () => null,
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
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
          onClick={() => scope.navigate({ kind: "issues", title: "Issues" })}
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
            kind: "issues",
            title: "Issues",
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
  expect(tabs()[0]).toMatchObject({ kind: "issues", query: "search=math" });
  expect(tabs()[0].id).toBeUndefined();
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

test("the active list tab owns its persistent List/Board controls", async () => {
  render(
    <AccessoryPanelProvider>
      <Harness />
    </AccessoryPanelProvider>,
  );
  fireEvent.click(await screen.findByText("Start"));
  fireEvent.click(screen.getByRole("button", { name: "Issues board view" }));
  expect(new URLSearchParams(tabs()[0].query).get("view")).toBe("board");
  fireEvent.click(screen.getByText("Open issue"));
  expect(
    screen.queryByRole("button", { name: "Issues board view" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Back to issues"));
  expect(
    screen.getByRole("button", { name: "Issues board view" }),
  ).toHaveAttribute("aria-pressed", "true");
});
