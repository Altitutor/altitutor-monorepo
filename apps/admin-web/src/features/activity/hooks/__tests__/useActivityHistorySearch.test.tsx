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
