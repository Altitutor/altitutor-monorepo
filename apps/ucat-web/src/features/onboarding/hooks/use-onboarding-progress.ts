"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@altitutor/shared";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth";

/**
 * Per-tour completion state stored in `students.onboarding_progress` JSONB.
 * Writes always go through the SECURITY DEFINER RPCs defined in
 * `supabase/migrations/20260511114849_onboarding_progress_jsonb.sql`.
 */
export interface OnboardingTourState {
  completed_at: string;
  version: number;
}

export type OnboardingProgress = Record<string, OnboardingTourState>;

/**
 * Bump the integer for a single tour to force it to re-show. Tours not listed
 * default to v1. We treat a stored `version` lower than the current version
 * as "not completed" so a content refresh can re-introduce a tour without a
 * destructive reset.
 */
const TOUR_VERSIONS: Record<string, number> = {
  // "ucat-welcome": 2, // bump to re-show welcome to existing users
};

function currentVersion(tourId: string): number {
  return TOUR_VERSIONS[tourId] ?? 1;
}

type StudentProfileView =
  Database["public"]["Views"]["vstudent_profile"]["Row"];

const ONBOARDING_QUERY_KEY = ["ucat", "onboarding-progress"] as const;

function toProgress(value: StudentProfileView["onboarding_progress"]): OnboardingProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as unknown as OnboardingProgress;
}

async function fetchOnboardingProgress(): Promise<OnboardingProgress> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_profile")
    .select("onboarding_progress")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return toProgress(data?.onboarding_progress ?? null);
}

/**
 * Reads the current student's onboarding progress. Only enabled once we know
 * the user is authenticated; otherwise the query stays idle and consumers see
 * `isLoading: true`, which prevents auto-start from racing before auth.
 */
export function useOnboardingProgress() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const enabled = !isAuthLoading && !!user;

  const query = useQuery<OnboardingProgress>({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: fetchOnboardingProgress,
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  const isCompleted = useCallback(
    (tourId: string): boolean => {
      const progress = query.data ?? {};
      const entry = progress[tourId];
      if (!entry?.completed_at) return false;
      return (entry.version ?? 1) >= currentVersion(tourId);
    },
    [query.data],
  );

  return {
    progress: query.data ?? {},
    isLoading: !enabled || query.isLoading,
    isFetching: query.isFetching,
    isCompleted,
  };
}

export function useCompleteOnboardingTour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tourId: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("student_complete_onboarding_tour", {
        p_tour_id: tourId,
        p_version: currentVersion(tourId),
      });
      if (error) throw new Error(error.message);
      return tourId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
  });
}

export function useResetOnboardingTour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tourId: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("student_reset_onboarding_tour", {
        p_tour_id: tourId,
      });
      if (error) throw new Error(error.message);
      return tourId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
  });
}

export function useResetAllOnboardingTours() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc(
        "student_reset_onboarding_progress",
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
  });
}
