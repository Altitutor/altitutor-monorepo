"use client";

import { useEffect, useRef, useState } from "react";
import type { ActivityFilters } from "../lib/activityFeedFilters";

const AUTO_PAGE_LIMIT = 4;

/** Check a few earlier pages automatically. The feed still offers manual paging. */
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
  const criteria = JSON.stringify([filters, search.trim()]);
  const [scan, setScan] = useState({ criteria, pages: 0 });
  const pages = scan.criteria === criteria ? scan.pages : 0;
  const canScan = filtering && matches === 0 && hasMore && Boolean(loadMore);
  const searching = canScan && (pending || pages < AUTO_PAGE_LIMIT);
  const request =
    canScan && pages < AUTO_PAGE_LIMIT ? `${criteria}:${cursor}` : null;
  const lastRequest = useRef<string | null>(null);

  useEffect(() => {
    if (request === null) {
      lastRequest.current = null;
      return;
    }
    if (pending || lastRequest.current === request) return;
    lastRequest.current = request;
    setScan({ criteria, pages: pages + 1 });
    loadMore?.();
  }, [criteria, loadMore, pages, pending, request]);

  return { filtering, searching };
}
