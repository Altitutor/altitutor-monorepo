"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUcatNotifications,
  markUcatNotificationsRead,
  dismissUcatNotifications,
} from "@/features/notifications/api";

export const UCAT_NOTIFICATIONS_QUERY_KEY = ["ucat", "notifications"] as const;

export function useUcatNotifications(enabled = true) {
  return useQuery({
    queryKey: UCAT_NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchUcatNotifications,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useMarkUcatNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markUcatNotificationsRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: UCAT_NOTIFICATIONS_QUERY_KEY }),
  });
}

export function useDismissUcatNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dismissUcatNotifications,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: UCAT_NOTIFICATIONS_QUERY_KEY }),
  });
}
