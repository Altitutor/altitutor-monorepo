import { useQueries, useQuery } from '@tanstack/react-query';
import { payTiersClient } from '../api/payTiersClient';
import { payTiersKeys } from '../api/queryKeys';

const STALE_TIME = 5 * 60 * 1000;

export function usePayTiers() {
  return useQuery({
    queryKey: payTiersKeys.tiers(),
    queryFn: () => payTiersClient.getTiers(),
    staleTime: STALE_TIME,
  });
}

export function usePayTierRequirements(tierNumber: number, enabled = true) {
  return useQuery({
    queryKey: payTiersKeys.requirements(tierNumber),
    queryFn: () => payTiersClient.getRequirements(tierNumber),
    enabled: enabled && tierNumber > 0,
    staleTime: STALE_TIME,
  });
}

/** Requirement counts for ladder table rows (cached per tier). */
export function usePayTierRequirementCounts(tierNumbers: number[]) {
  return useQueries({
    queries: tierNumbers.map((tierNumber) => ({
      queryKey: payTiersKeys.requirements(tierNumber),
      queryFn: () => payTiersClient.getRequirements(tierNumber),
      staleTime: STALE_TIME,
    })),
  });
}

export function usePayTiersStaffSummaries() {
  return useQuery({
    queryKey: payTiersKeys.staffSummaries(),
    queryFn: async () => {
      const data = await payTiersClient.getStaffSummaries();
      return data.staff;
    },
    staleTime: 60 * 1000,
  });
}

export function usePayTierStaffProgress(staffId: string | null) {
  return useQuery({
    queryKey: payTiersKeys.staffProgress(staffId ?? ''),
    queryFn: () => payTiersClient.getStaffProgress(staffId!),
    enabled: !!staffId,
    staleTime: 60 * 1000,
  });
}

export function usePayTierStaffCheckIns(staffId: string | null, enabled = true) {
  return useQuery({
    queryKey: payTiersKeys.staffCheckIns(staffId ?? ''),
    queryFn: async () => {
      const data = await payTiersClient.getStaffCheckIns(staffId!);
      return data.checkIns;
    },
    enabled: !!staffId && enabled,
    staleTime: 60 * 1000,
  });
}
