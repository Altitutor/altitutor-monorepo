"use client";

import { useAuthStore } from "@/shared/lib/supabase/auth";
import { useToast } from "@altitutor/ui";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import {
  getInterviewCatalog,
  getInterviewRound,
  getInterviewRounds,
  sendInterviewCommand,
} from "../api/interviews";

export const interviewKeys = {
  catalog: ["interviews", "catalog"] as const,
  rounds: ["interviews", "rounds"] as const,
  round: (id: string) => ["interviews", "round", id] as const,
};
export function useInterviewCatalog() {
  const { user, loading } = useAuthStore();
  return useQuery({
    enabled: !loading && !!user,
    queryKey: [...interviewKeys.catalog, user?.id],
    queryFn: getInterviewCatalog,
    staleTime: 10_000,
  });
}
export function useInterviewRounds() {
  const { user, loading } = useAuthStore();
  return useQuery({
    enabled: !loading && !!user,
    queryKey: [...interviewKeys.rounds, user?.id],
    queryFn: getInterviewRounds,
    refetchInterval: 15_000,
  });
}
export function useInterviewCommand() {
  const { toast } = useToast();
  const client = useQueryClient();
  return useMutation({
    mutationFn: sendInterviewCommand,
    onSuccess: async (result) => {
      if (result.mediaWarning)
        toast({
          title: "Interview updated · media needs attention",
          description: result.mediaWarning,
          variant: "destructive",
        });
      await client.invalidateQueries({ queryKey: ["interviews"] });
    },
  });
}
export function useInterviewRound(id: string) {
  const { user, loading } = useAuthStore();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...interviewKeys.round(id), user?.id],
    enabled: !loading && !!user && !!id,
    queryFn: () => getInterviewRound(id),
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
  });
  useEffect(() => {
    if (!user || loading || !id) return;
    const channel = getSupabaseClient()
      .channel(`interview-round:${id}`, { config: { private: true } })
      .on("broadcast", { event: "changed" }, () => {
        void client.invalidateQueries({ queryKey: interviewKeys.round(id) });
      })
      .subscribe();
    const heartbeat = () => {
      void sendInterviewCommand({
        type: "heartbeat",
        roundId: id,
        commandId: crypto.randomUUID(),
      }).catch(() => undefined);
    };
    heartbeat();
    const interval = setInterval(heartbeat, 10_000);
    const reconnect = () => {
      heartbeat();
      void client.invalidateQueries({ queryKey: interviewKeys.round(id) });
    };
    window.addEventListener("online", reconnect);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", reconnect);
      void getSupabaseClient().removeChannel(channel);
    };
  }, [client, id, user, loading]);
  return query;
}
