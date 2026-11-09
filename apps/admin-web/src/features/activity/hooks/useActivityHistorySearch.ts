"use client";

import { useEffect, useRef } from "react";
import type { ActivityFilters } from "../lib/activityFeedFilters";

/** Continue through the existing pages until the first match or the end of history. */
export function useActivityHistorySearch({
  filters,
  search,
  matches,
  cursor,
  hasMore,
  pending,
  loadMore,
}: {
  filters: ActivityFilters;
  search: string;
  matches: number;
  cursor: string | number;
  hasMore: boolean;
  pending?: boolean;
  loadMore?: () => void;
}) {
  const filtering = Boolean(
    search.trim() || Object.values(filters).some((values) => values.length),
  );
  const searching = filtering && matches === 0 && hasMore && Boolean(loadMore);
  const request = searching
    ? JSON.stringify([filters, search.trim(), cursor])
    : null;
  const lastRequest = useRef<string | null>(null);

  useEffect(() => {
    if (request === null) {
      lastRequest.current = null;
      return;
    }
    if (pending || lastRequest.current === request) return;
    lastRequest.current = request;
    loadMore?.();
  }, [loadMore, pending, request]);

  return { filtering, searching };
}
