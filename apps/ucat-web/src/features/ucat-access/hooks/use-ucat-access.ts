"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth";
import type { UcatOnlineTier } from "@/features/ucat-access/types/quota";

export type UcatAccessFlags = {
  hasOnlineAccess: boolean;
  hasInPersonAccess: boolean;
  hasUcatAccess: boolean;
  onlineTier: UcatOnlineTier | null;
  isQuotaExempt: boolean;
  onboardingCompleted: boolean;
  proTrialEligible: boolean;
  isLoading: boolean;
};

type VstudentUcatMyAccessRow = {
  has_online_access: boolean | null;
  has_in_person_access: boolean | null;
  has_ucat_access: boolean | null;
  online_tier: string | null;
  is_quota_exempt: boolean | null;
  ucat_onboarding_completed_at: string | null;
  pro_trial_eligible: boolean | null;
};

const EMPTY_FLAGS: Omit<UcatAccessFlags, "isLoading"> = {
  hasOnlineAccess: false,
  hasInPersonAccess: false,
  hasUcatAccess: false,
  onlineTier: null,
  isQuotaExempt: false,
  onboardingCompleted: false,
  proTrialEligible: false,
};

function parseOnlineTier(value: string | null): UcatOnlineTier | null {
  if (value === "free" || value === "pro_trial" || value === "pro") return value;
  return null;
}

function mapAccessRow(data: VstudentUcatMyAccessRow): Omit<UcatAccessFlags, "isLoading"> {
  return {
    hasOnlineAccess: true,
    hasInPersonAccess: Boolean(data.has_in_person_access),
    hasUcatAccess: Boolean(data.has_ucat_access),
    onlineTier: parseOnlineTier(data.online_tier),
    isQuotaExempt: Boolean(data.is_quota_exempt),
    onboardingCompleted: Boolean(data.ucat_onboarding_completed_at),
    proTrialEligible: Boolean(data.pro_trial_eligible),
  };
}

async function fetchUcatAccess(): Promise<Omit<UcatAccessFlags, "isLoading">> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_ucat_my_access")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return EMPTY_FLAGS;
  }

  return mapAccessRow(data as VstudentUcatMyAccessRow);
}

/**
 * UCAT entitlements for the current student (tier, quotas, in-person add-on).
 * Source: vstudent_ucat_my_access → vstudent_my_subject_access.
 */
export function useUcatAccess(): UcatAccessFlags {
  const { user, isLoading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["ucat-access", user?.id],
    queryFn: fetchUcatAccess,
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (!user || authLoading) {
      return { ...EMPTY_FLAGS, isLoading: true };
    }
    if (query.isLoading || query.isPending) {
      return { ...EMPTY_FLAGS, isLoading: true };
    }
    if (query.data) {
      return { ...query.data, isLoading: false };
    }
    return { ...EMPTY_FLAGS, isLoading: false };
  }, [user, authLoading, query.isLoading, query.isPending, query.data]);
}
