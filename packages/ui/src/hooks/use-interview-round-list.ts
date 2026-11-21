"use client";

import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { InterviewRoundListSnapshot } from "@altitutor/shared";

function accessDenied(error: unknown) {
  return !!error && typeof error === "object" && "status" in error &&
    (error.status === 401 || error.status === 403);
}

/** Poll current summaries and a cheap history revision manifest, not old payloads. */
export function useInterviewRoundList<Round extends { id: string; version: number; phase: string }>(options: {
  queryKey: QueryKey;
  enabled: boolean;
  poll: boolean;
  readCurrent: (signal: AbortSignal) => Promise<InterviewRoundListSnapshot<Round>>;
  readHistory: (signal: AbortSignal) => Promise<Round[]>;
}) {
  const client = useQueryClient();
  const currentKey = [...options.queryKey, "current"];
  const scope = JSON.stringify(options.queryKey);
  const historyKey = (snapshot: InterviewRoundListSnapshot<Round> | undefined) =>
    [...options.queryKey, "history", JSON.stringify(snapshot?.history ?? [])];
  const retainedKey = [...options.queryKey, "history-cache"];
  // Keep one same-actor recovery payload rather than one full copy per revision.
  const retained = useQuery<Round[]>({
    queryKey: retainedKey,
    queryFn: () => Promise.resolve([]),
    enabled: false,
    staleTime: Infinity,
  });
  const readHistory = async (snapshot: InterviewRoundListSnapshot<Round> | undefined, signal: AbortSignal) => {
    const rows = snapshot?.history.length ? await options.readHistory(signal) : [];
    const active = client.getQueryCache().findAll({ queryKey: currentKey, exact: true }).some((entry) => entry.isActive());
    if (!signal.aborted && active) client.setQueryData(retainedKey, rows);
    return rows;
  };
  const current = useQuery({
    queryKey: currentKey,
    queryFn: async ({ signal }) => {
      const snapshot = await options.readCurrent(signal);
      const previous = client.getQueryData<InterviewRoundListSnapshot<Round>>(currentKey);
      const currentIds = new Set(snapshot.rounds.map((round) => round.id));
      const completedIds = new Set(snapshot.history.map((round) => round.id));
      // A new history revision loads asynchronously. Keep the known summary of
      // a just-completed round until that bounded read supplies its fresh body.
      const completing = previous?.rounds.filter((round) =>
        !currentIds.has(round.id) && completedIds.has(round.id),
      ).map((round) => ({ ...round, phase: "completed" })) ?? [];
      return { ...snapshot, rounds: [...snapshot.rounds, ...completing] };
    },
    enabled: options.enabled,
    refetchInterval: options.poll ? 15_000 : false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    staleTime: 30_000,
  });
  const history = useQuery({
    // A new revision gets its own request, even if an older read is in flight.
    queryKey: historyKey(current.data),
    queryFn: ({ signal }) => readHistory(current.data, signal),
    enabled: options.enabled && current.isSuccess,
    // Only carry data within this actor's scope. The fresh manifest below
    // immediately removes rows whose visibility has changed.
    placeholderData: (previous, query) =>
      JSON.stringify(query?.queryKey.slice(0, -2)) === scope ? previous : undefined,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  // Query placeholders disappear after a failed request. A temporary history
  // failure can still use this actor's last successful payload, with visibility
  // checked against the fresh manifest rather than the old payload's members.
  const historyRows = history.data ?? retained.data;
  let data: Round[] | undefined;
  if (current.data && historyRows && !accessDenied(current.error) && !accessDenied(history.error)) {
    const visibleHistory = new Set(current.data.history.map((entry) => entry.id));
    const rows = new Map(historyRows.filter((round) => visibleHistory.has(round.id)).map((round) => [round.id, round]));
    for (const round of current.data.rounds) {
      const completed = rows.get(round.id);
      if (round.phase !== "completed" || !completed || completed.version < round.version)
        rows.set(round.id, round);
    }
    data = [...rows.values()];
  }
  return {
    ...current,
    data,
    error: current.error ?? history.error,
    isPending: current.isPending || (current.isSuccess && history.isPending),
    isLoading: current.isLoading || (current.isSuccess && history.isLoading),
    isFetching: current.isFetching || history.isFetching,
    isError: current.isError || history.isError,
    refetch: async (_options: Parameters<typeof current.refetch>[0] = {}) => {
      const result = await current.refetch({ cancelRefetch: false });
      const active = client.getQueryCache().findAll({ queryKey: currentKey, exact: true }).some((entry) => entry.isActive());
      if (!result.isError && active) {
        await client.fetchQuery({
          queryKey: historyKey(result.data),
          queryFn: ({ signal }) => readHistory(result.data, signal),
          staleTime: Infinity,
        }).catch(() => undefined);
      }
    },
  };
}
