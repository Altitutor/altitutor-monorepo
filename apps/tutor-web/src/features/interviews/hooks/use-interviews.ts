"use client";

import { useCurrentStaff } from "@/features/staff/hooks/useStaffQuery";
import { useInterviewAccess } from "./use-interview-access";
import { useAuthStore } from "@/shared/lib/supabase/auth";
import { useToast } from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import { useInterviewRoundSync } from "@altitutor/ui/hooks/use-interview-round-sync";
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
export function useInterviewRounds(
  options: { enabled?: boolean; poll?: boolean } = {},
) {
  const { user, loading } = useAuthStore();
  return useQuery({
    enabled: !loading && !!user && options.enabled !== false,
    queryKey: [...interviewKeys.rounds, user?.id],
    queryFn: getInterviewRounds,
    refetchInterval: options.poll === false ? false : 15_000,
    staleTime: 30_000,
  });
}
export function useInterviewCommand() {
  const { toast } = useToast();
  const client = useQueryClient();
  return useMutation({
    mutationFn: sendInterviewCommand,
    onSuccess: async (result, command) => {
      if (result.mediaWarning)
        toast({
          title: "Interview updated · media needs attention",
          description: result.mediaWarning,
          variant: "destructive",
        });
      if ("roundId" in command) {
        await Promise.all([
          client.invalidateQueries({
            queryKey: interviewKeys.round(command.roundId),
          }),
          ...(command.type === "saveAttempt"
            ? []
            : [client.invalidateQueries({ queryKey: interviewKeys.rounds })]),
        ]);
      } else
        await client.invalidateQueries({ queryKey: interviewKeys.catalog });
    },
  });
}
export function useInterviewRound(id: string, participate = false) {
  const { user, loading } = useAuthStore();
  const client = useQueryClient();
  const enabled = !loading && !!user && !!id;
  const query = useQuery({
    queryKey: [...interviewKeys.round(id), user?.id],
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
        client.invalidateQueries({ queryKey: interviewKeys.round(id) }),
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

export function useInterviewCalendarRounds() {
  const access = useInterviewAccess();
  const allowed = access.data === true;
  const staff = useCurrentStaff(allowed);
  const query = useInterviewRounds({ enabled: allowed, poll: false });
  return {
    ...query,
    data:
      allowed && staff.data
        ? query.data?.filter((round) =>
            round.tutors.some((tutor) => tutor.id === staff.data?.id),
          )
        : undefined,
    isPending: allowed ? query.isPending || staff.isPending : access.isPending,
    isError: access.isError || (allowed && (query.isError || staff.isError)),
  };
}
