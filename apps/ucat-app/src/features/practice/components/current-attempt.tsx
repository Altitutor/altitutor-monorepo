import { useCallback } from "react";
import { Alert } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
export const loadActiveAttempt = () =>
  api<{ active: ActiveExamAttempt | null }>("/exam-attempts/active");
export const discardAttempt = (active: ActiveExamAttempt) =>
  api("/exam-attempts/discard", {
    method: "POST",
    body: { kind: active.kind, attemptId: active.attemptId },
  });
export function useCurrentAttempt() {
  const router = useRouter();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["active"], queryFn: loadActiveAttempt });
  useFocusEffect(
    useCallback(() => {
      void client.invalidateQueries({ queryKey: ["active"] });
    }, [client]),
  );
  const resume = (active: ActiveExamAttempt) =>
    router.push({
      pathname: "/exam",
      params: { kind: active.kind, id: active.resourceId, resume: "true" },
    });
  async function beforeStart(start: () => Promise<void>) {
    // Always refresh: an attempt may have been started on another device.
    const { active } = await loadActiveAttempt();
    client.setQueryData(["active"], { active });
    if (!active) {
      await start();
      return;
    }
    Alert.alert(
      "Continue your current attempt?",
      `You have an unfinished ${active.label}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard attempt and continue",
          style: "destructive",
          onPress: () => {
            void discardAttempt(active)
              .then(async () => {
                await client.invalidateQueries({ queryKey: ["active"] });
                await start();
              })
              .catch((error) =>
                Alert.alert(
                  "Unable to start",
                  error instanceof Error ? error.message : "Please try again.",
                ),
              );
          },
        },
        { text: "Continue current attempt", onPress: () => resume(active) },
      ],
    );
  }
  return { query, resume, beforeStart };
}
