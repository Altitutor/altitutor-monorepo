import { renderHook, act } from "@testing-library/react";
import { usePaneNavigation } from "../usePaneNavigation";
const push = jest.fn();
const updateQuery = jest.fn();
const openTab = jest.fn();
const navigate = jest.fn();
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
  useAccessoryPanel: () => ({ updateQuery, openTab }),
}));
jest.mock("@/shared/contexts/AccessoryTabContext", () => ({
  useAccessoryTab: () => ({ tab, navigate }),
}));
beforeEach(() => jest.clearAllMocks());
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
