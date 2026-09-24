"use client";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { evidenceSchema, type Journey } from "../lib/model";

export const onboardingKey = ["onboarding"] as const;
export function useOnboardingJourneys() {
  return useQuery({
    queryKey: [...onboardingKey, "journeys"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<Journey[]> => {
      const db = getSupabaseClient();
      const rows: Journey[] = [];
      // Page explicitly: closed history must not silently stop at the API row cap.
      for (let offset = 0; ; offset += 200) {
        const { data, error } = await db
          .from("onboarding_journeys")
          .select("*, onboarding_action_preferences(*)")
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 199);
        if (error) throw error;
        rows.push(
          ...(await Promise.all(
            data.map(async ({ onboarding_action_preferences, ...journey }) => {
              const result = await db.rpc("onboarding_evidence", {
                p_journey_id: journey.id,
              });
              if (result.error) throw result.error;
              return {
                ...journey,
                preferences: onboarding_action_preferences,
                evidence: evidenceSchema.parse(
                  journey.closed_evidence ?? result.data,
                ),
              };
            }),
          )),
        );
        if (data.length < 200) return rows;
      }
    },
  });
}
export function useOnboardingSettings() {
  return useQuery({
    queryKey: [...onboardingKey, "settings"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from("onboarding_settings")
        .select("*")
        .eq("id", true)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
