"use client";

import { useQuery } from "@tanstack/react-query";

export const UCAT_PROFILE_QUERY_KEY = ["ucat", "profile"] as const;

export type UcatProfile = {
  timezone: string;
  timezoneOptions: string[];
  firstName: string | null;
  lastName: string | null;
  email: string;
};

async function fetchUcatProfile(): Promise<UcatProfile> {
  const res = await fetch("/api/ucat/profile");
  if (!res.ok) {
    throw new Error("Failed to load profile");
  }
  return res.json() as Promise<UcatProfile>;
}

export function useUcatProfile(enabled = true) {
  return useQuery({
    queryKey: UCAT_PROFILE_QUERY_KEY,
    queryFn: fetchUcatProfile,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
