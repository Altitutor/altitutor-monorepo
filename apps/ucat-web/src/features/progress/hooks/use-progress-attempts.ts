import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  ProgressAttemptSource,
  ProgressAttemptsResponse,
} from "@/app/api/ucat/progress/attempts/route";
import type { GraphDateRange } from "../lib/progress-mode";

export function useProgressAttempts(params: {
  source: ProgressAttemptSource;
  page: number;
  pageSize: number;
  dateRange: GraphDateRange;
  sectionNumber?: number;
}) {
  return useQuery({
    queryKey: ["ucat", "progress", "attempts", params],
    queryFn: async (): Promise<ProgressAttemptsResponse> => {
      const search = new URLSearchParams({
        source: params.source,
        page: String(params.page),
        pageSize: String(params.pageSize),
      });
      if (params.dateRange !== "all") search.set("days", params.dateRange);
      if (params.sectionNumber != null) search.set("sectionNumber", String(params.sectionNumber));
      const response = await fetch(`/api/ucat/progress/attempts?${search}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to fetch attempts");
      }
      return response.json();
    },
    placeholderData: keepPreviousData,
  });
}
