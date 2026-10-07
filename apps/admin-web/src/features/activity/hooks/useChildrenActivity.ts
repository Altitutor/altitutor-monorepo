"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { activityApi } from "../api";
import { activityKeys, ACTIVITY_PAGE_SIZE } from "./useActivityEvents";
import { mergeActivityPages } from "../lib/mergeActivityPages";
import { childActivitySourceId } from "../lib/entityCommunication";

/** Each selected child has its own cached, paginated activity feed. */
export function useChildrenActivity(
  children: Array<{ id: string; label: string }>,
  sources: string[],
  enabled: boolean,
) {
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const selected = children.filter((child) =>
    sources.includes(childActivitySourceId(child.id)),
  );
  const requests = selected.flatMap((child) =>
    Array.from({ length: pageCounts[child.id] ?? 1 }, (_, page) => ({
      child,
      page,
    })),
  );
  const queries = useQueries({
    queries: requests.map(({ child, page }) => ({
      queryKey: [
        ...activityKeys.student(child.id),
        { limit: ACTIVITY_PAGE_SIZE, offset: page * ACTIVITY_PAGE_SIZE },
      ],
      queryFn: () =>
        activityApi.getStudentActivity(
          child.id,
          ACTIVITY_PAGE_SIZE,
          page * ACTIVITY_PAGE_SIZE,
        ),
      enabled,
      staleTime: 0,
    })),
  });
  const feeds = selected.map((child) => {
    const pages = queries.flatMap((query, index) =>
      requests[index].child.id === child.id && query.data ? [query.data] : [],
    );
    return { child, data: mergeActivityPages(pages) };
  });
  return {
    feeds,
    isLoading: queries.some((query) => query.isLoading),
    error: queries.find((query) => query.error)?.error,
    hasMore: feeds.some((feed) => feed.data.hasMore),
    loadMore: () =>
      setPageCounts((current) => {
        const next = { ...current };
        for (const feed of feeds) {
          if (feed.data.hasMore)
            next[feed.child.id] = (current[feed.child.id] ?? 1) + 1;
        }
        return next;
      }),
  };
}
