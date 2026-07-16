import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  ProgressAttemptFilter,
  ProgressAttemptsResponse,
} from "@/app/api/ucat/progress/attempts/route";
import type { GraphDateRange } from "../lib/progress-mode";

export function useProgressAttempts(params: {
  source: ProgressAttemptFilter;
  page: number;
  pageSize: number;
  dateRange: GraphDateRange;
  sectionNumber?: number;
  completedOnly?: boolean;
  date?: string | null;
  dateTo?: string | null;
  enabled?: boolean;
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
      if (params.sectionNumber != null)
        search.set("sectionNumber", String(params.sectionNumber));
      if (params.completedOnly) search.set("completedOnly", "true");
      if (params.date) search.set("date", params.date);
      if (params.dateTo) search.set("dateTo", params.dateTo);
      const response = await fetch(`/api/ucat/progress/attempts?${search}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to fetch attempts");
      }
      return response.json();
    },
    placeholderData: keepPreviousData,
    enabled: params.enabled ?? true,
  });
}
