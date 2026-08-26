"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { isUcatOnlineTier, type UcatOnlineTier } from "@altitutor/shared";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth";

export type UcatAccessFlags = {
  hasOnlineAccess: boolean;
  hasInPersonAccess: boolean;
  hasUcatAccess: boolean;
  onlineTier: UcatOnlineTier | null;
  isQuotaExempt: boolean;
  /** Plan or referral-gift choice recorded (step 4). */
  onboardingCompleted: boolean;
  /** Full signup wizard finished. */
  signupCompleted: boolean;
  signupStep: number;
  unlimitedTrialEligible: boolean;
  analyticsAccountClass: "external" | "internal_test";
  testYear: number | null;
  testDate: string | null;
  isLoading: boolean;
  /** The access lookup failed, so route guards must not infer missing access. */
  accessLoadFailed: boolean;
};

type VstudentUcatMyAccessRow = {
  has_online_access: boolean | null;
  has_in_person_access: boolean | null;
  has_ucat_access: boolean | null;
  online_tier: string | null;
  is_quota_exempt: boolean | null;
  ucat_onboarding_completed_at: string | null;
  ucat_signup_step: number | null;
  ucat_signup_completed_at: string | null;
  unlimited_trial_eligible: boolean | null;
  ucat_analytics_account_class: string | null;
  ucat_test_year: number | null;
  ucat_test_date: string | null;
};

const EMPTY_FLAGS: Omit<UcatAccessFlags, "isLoading" | "accessLoadFailed"> = {
  hasOnlineAccess: false,
  hasInPersonAccess: false,
  hasUcatAccess: false,
  onlineTier: null,
  isQuotaExempt: false,
  onboardingCompleted: false,
  signupCompleted: false,
  signupStep: 1,
  unlimitedTrialEligible: false,
  analyticsAccountClass: "external",
  testYear: null,
  testDate: null,
};

function parseAnalyticsAccountClass(
  value: string | null,
): UcatAccessFlags["analyticsAccountClass"] {
  return value === "internal_test" ? "internal_test" : "external";
}

function parseOnlineTier(value: string | null): UcatOnlineTier | null {
  return isUcatOnlineTier(value) ? value : null;
}

function mapAccessRow(
  data: VstudentUcatMyAccessRow,
): Omit<UcatAccessFlags, "isLoading" | "accessLoadFailed"> {
  return {
    hasOnlineAccess: Boolean(data.has_online_access),
    hasInPersonAccess: Boolean(data.has_in_person_access),
    hasUcatAccess: Boolean(data.has_ucat_access),
    onlineTier: parseOnlineTier(data.online_tier),
    isQuotaExempt: Boolean(data.is_quota_exempt),
    onboardingCompleted: Boolean(data.ucat_onboarding_completed_at),
    signupCompleted: Boolean(data.ucat_signup_completed_at),
    signupStep: data.ucat_signup_step ?? 1,
    unlimitedTrialEligible: Boolean(data.unlimited_trial_eligible),
    analyticsAccountClass: parseAnalyticsAccountClass(
      data.ucat_analytics_account_class,
    ),
    testYear: data.ucat_test_year,
    testDate: data.ucat_test_date,
  };
}

async function fetchUcatAccess(): Promise<
  Omit<UcatAccessFlags, "isLoading" | "accessLoadFailed">
> {
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
 * Source: vstudent_ucat_my_access.
 */
export function useUcatAccess(): UcatAccessFlags {
  const { user, isLoading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["ucat-access", user?.id],
    queryFn: fetchUcatAccess,
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (query.error) {
      console.error("[ucat access] Failed to load access state", query.error);
    }
  }, [query.error]);

  return useMemo(() => {
    if (!user || authLoading) {
      return { ...EMPTY_FLAGS, isLoading: true, accessLoadFailed: false };
    }
    if (query.isLoading || query.isPending) {
      return { ...EMPTY_FLAGS, isLoading: true, accessLoadFailed: false };
    }
    if (query.data) {
      return { ...query.data, isLoading: false, accessLoadFailed: false };
    }
    return {
      ...EMPTY_FLAGS,
      isLoading: false,
      accessLoadFailed: query.isError,
    };
  }, [
    user,
    authLoading,
    query.isLoading,
    query.isPending,
    query.isError,
    query.data,
  ]);
}
