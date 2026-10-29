import { fireEvent, render, screen } from "@testing-library/react";
import {
  AccessoryPanelProvider,
  useAccessoryPanel,
} from "@/shared/contexts/AccessoryPanelContext";
import { useOpenEmailThread } from "../useOpenEmailThread";
jest.mock("@/shared/lib/supabase/auth", () => ({
  useAuthStore: () => ({ user: { id: "mail-ui-admin" } }),
}));
function Harness() {
  const open = useOpenEmailThread();
  const panel = useAccessoryPanel()!;
  return (
    <>
      <button onClick={() => open("thread-one", "Class change")}>
        First email
      </button>
      <button onClick={() => open("thread-two", "Absence")}>
        Second email
      </button>
      <button onClick={panel.collapse}>Collapse</button>
      <output>
        {JSON.stringify({
          tabs: panel.tabs.map(({ kind, id, title }) => ({ kind, id, title })),
          expanded: panel.expanded,
          active: panel.tabs.find((tab) => tab.key === panel.activeKey)?.id,
        })}
      </output>
    </>
  );
}
it("opens conversations in the persisted global expandable panel, retaining separate tabs and reusing an existing thread", () => {
  localStorage.clear();
  let sequence = 0;
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => `tab-${++sequence}`,
  });
  const first = render(
    <AccessoryPanelProvider>
      <Harness />
    </AccessoryPanelProvider>,
  );
  fireEvent.click(screen.getByText("First email"));
  fireEvent.click(screen.getByText("Second email"));
  fireEvent.click(screen.getByText("Collapse"));
  fireEvent.click(screen.getByText("First email"));
  const expected = {
    tabs: [
      { kind: "email", id: "thread-one", title: "Class change" },
      { kind: "email", id: "thread-two", title: "Absence" },
    ],
    expanded: true,
    active: "thread-one",
  };
  expect(JSON.parse(screen.getByRole("status").textContent!)).toEqual(expected);
  first.unmount();
  render(
    <AccessoryPanelProvider>
      <Harness />
    </AccessoryPanelProvider>,
  );
  expect(JSON.parse(screen.getByRole("status").textContent!)).toEqual(expected);
});
