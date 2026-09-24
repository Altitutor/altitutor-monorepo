import { useQuery } from "@tanstack/react-query";
import {
  fetchUcatReferralSummary,
  type UcatReferralSummary,
} from "@/features/subscription/api/referrals";

export const UCAT_REFERRALS_QUERY_KEY = ["ucat-referrals"] as const;

export function useUcatReferralSummary(enabled = true) {
  return useQuery<UcatReferralSummary>({
    queryKey: UCAT_REFERRALS_QUERY_KEY,
    queryFn: fetchUcatReferralSummary,
    enabled,
    staleTime: 60_000,
  });
}
