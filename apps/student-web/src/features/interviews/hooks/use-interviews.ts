"use client";

import { useEffect, useState } from "react";
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
  const [heartbeatFailed, setHeartbeatFailed] = useState(false);
  const query = useQuery({
    queryKey: ["interviews", "round", id, user?.id],
    enabled: !loading && Boolean(user),
    queryFn: () => getInterviewRound(id),
    refetchInterval: participate ? 3_000 : 15_000,
    refetchIntervalInBackground: participate,
    refetchOnWindowFocus: "always",
  });
  useEffect(() => {
    if (!participate || loading || !user?.id) return;
    let mounted = true;
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ["interviews", "round", id] });
    };
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`interview-round:${id}`, { config: { private: true } })
      .on("broadcast", { event: "changed" }, refresh)
      .subscribe();
    const heartbeat = async () => {
      try {
        await sendInterviewCommand({
          type: "heartbeat",
          roundId: id,
          commandId: crypto.randomUUID(),
        });
        if (mounted) setHeartbeatFailed(false);
        await sendInterviewCommand({
          type: "tick",
          roundId: id,
          commandId: crypto.randomUUID(),
        });
        refresh();
      } catch {
        if (mounted) setHeartbeatFailed(true);
      }
    };
    void heartbeat();
    const interval = setInterval(() => {
      void heartbeat();
    }, 5_000);
    const reconnect = () => {
      void heartbeat();
      refresh();
    };
    window.addEventListener("online", reconnect);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("online", reconnect);
      void supabase.removeChannel(channel);
    };
  }, [client, id, participate, loading, user?.id]);
  return { ...query, heartbeatFailed };
}
