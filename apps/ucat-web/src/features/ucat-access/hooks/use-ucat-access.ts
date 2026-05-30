"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth";

export type UcatAccessFlags = {
  hasOnlineAccess: boolean;
  hasInPersonAccess: boolean;
  hasUcatAccess: boolean;
  isLoading: boolean;
};

async function fetchUcatAccess(): Promise<UcatAccessFlags> {
  const supabase = getSupabaseBrowserClient();
  // Aggregated UCAT flags; DB derives these from vstudent_my_subject_access (class / subscription / students_online_access_manual).
  const { data, error } = await supabase
    .from("vstudent_ucat_my_access")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    hasOnlineAccess: Boolean(data?.has_online_access),
    hasInPersonAccess: Boolean(data?.has_in_person_access),
    hasUcatAccess: Boolean(data?.has_ucat_access),
    isLoading: false,
  };
}

/**
 * UCAT entitlements for the current student (subscription / manual assignment vs in-person class).
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
      return {
        hasOnlineAccess: false,
        hasInPersonAccess: false,
        hasUcatAccess: false,
        isLoading: true,
      };
    }
    if (query.isLoading || query.isPending) {
      return {
        hasOnlineAccess: false,
        hasInPersonAccess: false,
        hasUcatAccess: false,
        isLoading: true,
      };
    }
    if (query.data) {
      return { ...query.data, isLoading: false };
    }
    return {
      hasOnlineAccess: false,
      hasInPersonAccess: false,
      hasUcatAccess: false,
      isLoading: false,
    };
  }, [user, authLoading, query.isLoading, query.isPending, query.data]);
}
