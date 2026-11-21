"use client";

import { useInterviewRoundList } from "@altitutor/ui/hooks/use-interview-round-list";

import { refreshInterviewQueries } from "@altitutor/ui/lib/interview-query-refresh";
import { useInterviewRoundSync } from "@altitutor/ui/hooks/use-interview-round-sync";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/lib/supabase/auth";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import {
  getInterviewAccess,
  getInterviewRound,
  getCurrentInterviewRounds,
  getInterviewRoundHistory,
  sendInterviewCommand,
} from "../api/interviews";

export function useInterviewAccess() {
  const { user, loading } = useAuthStore();
  return useQuery({
    queryKey: ["interviews", "access", user?.id],
    enabled: !loading && Boolean(user),
    queryFn: getInterviewAccess,
    staleTime: 60_000,
  });
}

export function useInterviewRounds(
  options: { enabled?: boolean; poll?: boolean } = {},
) {
  const { user, loading } = useAuthStore();
  return useInterviewRoundList({
    queryKey: ["interviews", "rounds", user?.id],
    enabled: !loading && Boolean(user) && options.enabled !== false,
    poll: options.poll !== false,
    readCurrent: getCurrentInterviewRounds,
    readHistory: getInterviewRoundHistory,
  });
}

export function useInterviewRound(id: string, participate = false) {
  const { user, loading } = useAuthStore();
  const client = useQueryClient();
  const enabled = !loading && !!user && !!id;
  const query = useQuery({
    queryKey: ["interviews", "round", id, user?.id],
    enabled,
    queryFn: () => getInterviewRound(id),
    refetchOnWindowFocus: false,
  });
  const sync = useInterviewRoundSync({
    scope: enabled ? `${user.id}:${id}` : null,
    round: query.data,
    participate,
    adapter: {
      refresh: () =>
        refreshInterviewQueries(client, ["interviews", "round", id, user?.id]),
      send: (type) =>
        sendInterviewCommand({ type, roundId: id, commandId: randomUuid() }),
      subscribe: (changed, connected) => {
        const supabase = getSupabaseClient();
        const channel = supabase
          .channel(`interview-round:${id}`, { config: { private: true } })
          .on("broadcast", { event: "changed" }, changed)
          .subscribe((status) => connected(status === "SUBSCRIBED"));
        return () => {
          void supabase.removeChannel(channel);
        };
      },
    },
  });
  return {
    ...query,
    ...sync,
    refetch: (options: Parameters<typeof query.refetch>[0] = {}) =>
      query.refetch({ ...options, cancelRefetch: false }),
  };
}

export function useInterviewCalendarRounds() {
  const { user, loading } = useAuthStore();
  const access = useInterviewAccess();
  const allowed = access.data?.hasAccess === true;
  const query = useInterviewRounds({ enabled: allowed, poll: false });
  return {
    ...query,
    refetch: async () => {
      if (loading || !user) return;
      const refreshedAccess = await access.refetch({ cancelRefetch: false });
      if (refreshedAccess.data?.hasAccess !== true || refreshedAccess.isError) return;
      await query.refetch({ cancelRefetch: false });
    },
    data: allowed ? query.data : undefined,
    isPending: allowed ? query.isPending : access.isPending,
    isError: access.isError || (allowed && query.isError),
  };
}
