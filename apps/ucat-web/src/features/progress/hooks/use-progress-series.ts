import { useQuery } from "@tanstack/react-query";
import type {
  ProgressSeriesResponse,
  ProgressSeriesSource,
} from "@/app/api/ucat/progress/series/route";

async function fetchProgressSeries(
  source: ProgressSeriesSource,
  sectionNumber?: number,
): Promise<ProgressSeriesResponse> {
  const params = new URLSearchParams({ source });
  if (sectionNumber != null) params.set("sectionNumber", String(sectionNumber));
  const response = await fetch(`/api/ucat/progress/series?${params}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to fetch progress series");
  }
  return response.json();
}

export function useProgressSeries(
  source: ProgressSeriesSource,
  sectionNumber?: number,
  enabled = true,
) {
  return useQuery({
    queryKey: ["ucat", "progress", "series", source, sectionNumber ?? "all"],
    queryFn: () => fetchProgressSeries(source, sectionNumber),
    enabled,
  });
}
