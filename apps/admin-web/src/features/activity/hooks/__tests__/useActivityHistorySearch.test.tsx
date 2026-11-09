import { renderHook } from "@testing-library/react";
import { useActivityHistorySearch } from "../useActivityHistorySearch";

it("looks through earlier pages until a filtered feed finds a match", () => {
  const loadMore = jest.fn();
  const { result, rerender } = renderHook(
    ({ cursor, matches, pending }) =>
      useActivityHistorySearch({
        filters: { from: ["2026-01-01"] },
        search: "",
        cursor,
        matches,
        pending,
        hasMore: true,
        loadMore,
      }),
    { initialProps: { cursor: 50, matches: 0, pending: false } },
  );

  expect(result.current.searching).toBe(true);
  expect(loadMore).toHaveBeenCalledTimes(1);
  rerender({ cursor: 50, matches: 0, pending: true });
  rerender({ cursor: 50, matches: 0, pending: false });
  expect(loadMore).toHaveBeenCalledTimes(1);
  rerender({ cursor: 100, matches: 0, pending: false });
  expect(loadMore).toHaveBeenCalledTimes(2);
  rerender({ cursor: 150, matches: 1, pending: false });
  expect(result.current.searching).toBe(false);
  expect(loadMore).toHaveBeenCalledTimes(2);
});

it("stops automatic requests and leaves older pages available after a bounded scan", () => {
  const loadMore = jest.fn();
  const { result, rerender } = renderHook(
    ({ cursor, search }) =>
      useActivityHistorySearch({
        filters: {},
        search,
        cursor,
        matches: 0,
        hasMore: true,
        loadMore,
      }),
    { initialProps: { cursor: 0, search: "unknown term" } },
  );

  for (const cursor of [50, 100, 150, 200, 250]) {
    rerender({ cursor, search: "unknown term" });
  }

  expect(result.current.searching).toBe(false);
  expect(loadMore).toHaveBeenCalledTimes(4);
  rerender({ cursor: 250, search: "another term" });
  expect(result.current.searching).toBe(true);
  expect(loadMore).toHaveBeenCalledTimes(5);
});
