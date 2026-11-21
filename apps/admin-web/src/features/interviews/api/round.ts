import type { InterviewRound } from "@altitutor/shared";
import type { AdminInterviewObserverState } from "../types/observer";

export const adminInterviewObserverKey = (
  roundId: string | undefined,
  stationId: string | null,
) => ["admin-interview-observer", roundId, stationId] as const;

export async function fetchAdminInterviewRound(
  roundId: string,
): Promise<InterviewRound> {
  const response = await fetch(
    `/api/interviews/rounds/${encodeURIComponent(roundId)}`,
    { cache: "no-store" },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to load interview.");
  return data;
}

export async function fetchAdminInterviewObserver(
  roundId: string,
  stationId: string | null,
  previous?: AdminInterviewObserverState,
  signal?: AbortSignal,
): Promise<AdminInterviewObserverState> {
  const sameSelection =
    previous?.id === roundId && previous.selectedStationId === stationId;
  const params = new URLSearchParams({ observer: "1" });
  if (stationId) params.set("stationId", stationId);
  if (sameSelection && previous.content && previous.contentRevision)
    params.set("contentRevision", previous.contentRevision);
  const response = await fetch(
    `/api/interviews/rounds/${encodeURIComponent(roundId)}?${params}`,
    {
      cache: "no-store",
      signal,
    },
  );
  const data: AdminInterviewObserverState & { error?: string } =
    await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to load interview.");
  if (
    data.id !== roundId ||
    data.round?.id !== roundId ||
    data.selectedStationId !== stationId ||
    (data.content && data.content.station.id !== stationId)
  )
    throw new Error("Interview selection changed. Try again.");
  const selectionExists =
    stationId &&
    data.round.stations.some((station) => station.id === stationId);
  if (
    selectionExists &&
    !data.content &&
    (!sameSelection ||
      data.contentRevision !== previous.contentRevision ||
      !previous.content)
  )
    throw new Error("Interview content changed. Try again.");
  return {
    ...data,
    content: selectionExists
      ? (data.content ?? (sameSelection ? previous.content : null))
      : null,
    receivedAt: Date.now(),
  };
}
