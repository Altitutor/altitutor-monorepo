import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  AccessoryPanelProvider,
  useAccessoryPanel,
} from "@/shared/contexts/AccessoryPanelContext";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { usePaneNavigation } from "@/shared/hooks/usePaneNavigation";
import { useAccessoryTitle } from "@/shared/hooks/useAccessoryTitle";
import { AccessoryTabs } from "../AccessoryTabs";

const mockRenders = new Map<string, number>();
const mockRouter = { push: jest.fn() };
const mockSearch = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/students",
  useSearchParams: () => mockSearch,
}));
jest.mock("@/shared/lib/supabase/auth", () => ({
  useAuthStore: () => ({ user: { id: "tab-performance" } }),
}));
jest.mock("@/features/messages/api/queries", () => ({
  useUnreadConversationCount: () => ({ data: 0 }),
}));
jest.mock("@/shared/hooks/usePanelMediaQuery", () => ({
  ResponsivePane: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock("../AccessoryTabPicker", () => ({ AccessoryTabPicker: () => null }));
jest.mock("../AccessoryViews", () => ({
  AccessoryView: () => {
    const { tab } = useAccessoryTab()!;
    // Exercise the actual shared hooks used by lists and detail editors.
    usePaneNavigation();
    useAccessoryTitle(tab.title);
    const [draft, setDraft] = useState("");
    mockRenders.set(tab.id!, (mockRenders.get(tab.id!) ?? 0) + 1);
    return (
      <input
        aria-label={`Draft ${tab.id}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    );
  },
}));
function Harness() {
  const panel = useAccessoryPanel()!;
  return (
    <>
      <button onClick={() => panel.setWidth(600)}>Resize</button>
      <button
        onClick={() => panel.updateQuery(panel.activeKey!, "search=updated")}
      >
        Filter
      </button>
      <button onClick={panel.collapse}>Collapse</button>
      <button onClick={panel.toggle}>Toggle</button>
      <AccessoryTabs />
    </>
  );
}
function openWorkspace(count = 8) {
  localStorage.setItem(
    "admin-accessory-v1:tab-performance",
    JSON.stringify({
      tabs: Array.from({ length: count }, (_, index) => ({
        key: `tab-${index}`,
        kind: "document",
        id: `${index}`,
        title: `Document ${index}`,
        query: "",
      })),
      activeKey: "tab-0",
      expanded: true,
      width: 520,
    }),
  );
  render(
    <AccessoryPanelProvider>
      <Harness />
    </AccessoryPanelProvider>,
  );
  mockRenders.clear();
}
beforeEach(() => {
  localStorage.clear();
  mockRenders.clear();
  Element.prototype.scrollIntoView = jest.fn();
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
test("resizing the panel does not rerender any open editor", () => {
  openWorkspace();
  fireEvent.click(screen.getByText("Resize"));
  expect([...mockRenders.entries()]).toEqual([]);
});
test("filter changes rerender only the affected tab", () => {
  openWorkspace();
  fireEvent.click(screen.getByText("Filter"));
  expect([...mockRenders.keys()]).toEqual(["0"]);
});
test("switching tabs updates only the two affected editors and preserves drafts", () => {
  openWorkspace();
  fireEvent.change(screen.getByLabelText("Draft 0"), {
    target: { value: "Unsaved work" },
  });
  mockRenders.clear();
  fireEvent.click(screen.getByRole("tab", { name: "Document 1" }));
  expect([...mockRenders.keys()].sort()).toEqual(["0", "1"]);
  fireEvent.click(screen.getByRole("tab", { name: "Document 0" }));
  expect(screen.getByLabelText("Draft 0")).toHaveValue("Unsaved work");
});
test("collapsing and reopening the panel preserves editors and their drafts", () => {
  openWorkspace();
  fireEvent.change(screen.getByLabelText("Draft 0"), {
    target: { value: "Unsaved work" },
  });
  mockRenders.clear();
  fireEvent.click(screen.getByText("Collapse"));
  expect([...mockRenders.keys()]).toEqual(["0"]);
  expect(document.getElementById("accessory-content-tab-0")).toHaveAttribute(
    "hidden",
  );
  fireEvent.click(screen.getByText("Toggle"));
  expect(screen.getByLabelText("Draft 0")).toHaveValue("Unsaved work");
});
