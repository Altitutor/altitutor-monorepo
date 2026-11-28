import { renderHook, act } from "@testing-library/react";
import { accessoryDestination, usePaneNavigation } from "../usePaneNavigation";
import { accessoryHref } from "@/shared/contexts/AccessoryPanelContext";
const push = jest.fn();
const updateQuery = jest.fn();
const openTab = jest.fn();
const navigate = jest.fn();
let mockInAccessory = true;
const tab = {
  key: "one",
  kind: "issue",
  id: "record",
  title: "Issue",
  query: "",
};
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/students",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/shared/contexts/AccessoryPanelContext", () => ({
  ...jest.requireActual("@/shared/contexts/AccessoryPanelContext"),
  useAccessoryPanelActions: () => ({ updateQuery, openTab }),
}));
jest.mock("@/shared/contexts/AccessoryTabContext", () => ({
  useAccessoryTab: () => (mockInAccessory ? { tab, navigate } : null),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockInAccessory = true;
});
test("query changes on a detail tab stay in the accessory pane with a plural path", () => {
  const { result } = renderHook(() => usePaneNavigation());
  expect(result.current.pathname).toBe("/issues/record");
  act(() =>
    result.current.router.replace(
      `${result.current.pathname}?sort=priority&order=asc&group=status`,
    ),
  );
  expect(push).not.toHaveBeenCalled();
  expect(updateQuery).toHaveBeenCalledWith(
    "one",
    "sort=priority&order=asc&group=status",
  );
});
test("list and record navigation are handed to the current tab", () => {
  const { result } = renderHook(() => usePaneNavigation());
  act(() => result.current.router.push("/issues/another"));
  expect(navigate).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "issue", id: "another" }),
  );
});
test.each([false, true])(
  "Mail collection opens in the primary page from accessory scope %s",
  (inAccessory) => {
    mockInAccessory = inAccessory;
    const { result } = renderHook(() => usePaneNavigation());
    act(() => result.current.router.push("/email"));
    expect(push).toHaveBeenCalledWith("/email", undefined);
    expect(openTab).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  },
);
test("an email conversation still opens a global accessory tab", () => {
  mockInAccessory = false;
  const { result } = renderHook(() => usePaneNavigation());
  act(() => result.current.router.push("/email/thread-one"));
  expect(openTab).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "email", id: "thread-one" }),
  );
  expect(push).not.toHaveBeenCalled();
});

test("passes the original Outlook conversation ID to the detail view", () => {
  const thread = { kind: "email" as const, id: "AAQk+conversation/ID==", title: "Email" };
  expect(accessoryDestination(accessoryHref(thread))).toMatchObject(thread);
});
