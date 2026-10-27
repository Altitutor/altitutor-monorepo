"use client";

import { useInterviewRoundSync } from "@altitutor/ui/hooks/use-interview-round-sync";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/lib/supabase/auth";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import {
  getInterviewAccess,
  getInterviewRound,
  getInterviewRounds,
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

export function useInterviewRounds() {
  const { user, loading } = useAuthStore();
  return useQuery({
    queryKey: ["interviews", "rounds", user?.id],
    enabled: !loading && Boolean(user),
    queryFn: getInterviewRounds,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
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
        client.invalidateQueries({ queryKey: ["interviews", "round", id] }),
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
  return { ...query, ...sync };
}
