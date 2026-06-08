"use client";

import { useQuery } from "@tanstack/react-query";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";

export function useSkillTrainers() {
  return useQuery({
    queryKey: ["skill-trainers", "catalog"],
    queryFn: () => skillTrainerApi.listTrainers(),
  });
}

export function useSkillTrainerLeaderboard(
  trainerKey: string,
  window: "week" | "all_time",
) {
  return useQuery({
    queryKey: ["skill-trainers", "leaderboard", trainerKey, window],
    queryFn: () => skillTrainerApi.getLeaderboard(trainerKey, window),
    enabled: Boolean(trainerKey),
  });
}
