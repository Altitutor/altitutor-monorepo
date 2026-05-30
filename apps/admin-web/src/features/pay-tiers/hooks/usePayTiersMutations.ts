import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StaffPayTierRequirementKind } from '@altitutor/shared/pay-tiers';
import { payTiersClient } from '../api/payTiersClient';
import { payTiersKeys } from '../api/queryKeys';

export function useUpdatePayTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tierNumber,
      updates,
    }: {
      tierNumber: number;
      updates: { name?: string | null; base_pay_rate_cents?: number; currency?: string };
    }) => payTiersClient.updateTier(tierNumber, updates),
    onSuccess: (_data, { tierNumber }) => {
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.tiers() });
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.requirements(tierNumber) });
    },
  });
}

export function useCreatePayTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payTiersClient.createTier,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.tiers() });
    },
  });
}

export function useDeletePayTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tierNumber: number) => payTiersClient.deleteTier(tierNumber),
    onSuccess: (_data, tierNumber) => {
      queryClient.removeQueries({ queryKey: payTiersKeys.requirements(tierNumber) });
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.tiers() });
    },
  });
}

export function useAddPayTierRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tierNumber,
      requirement_kind,
      params,
    }: {
      tierNumber: number;
      requirement_kind: StaffPayTierRequirementKind;
      params: Record<string, unknown>;
    }) => payTiersClient.addRequirement(tierNumber, { requirement_kind, params }),
    onSuccess: (_data, { tierNumber }) => {
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.requirements(tierNumber) });
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.staffSummaries() });
    },
  });
}

export function useUpdatePayTierRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tierNumber,
      id,
      params,
      requirement_kind,
    }: {
      tierNumber: number;
      id: string;
      params?: Record<string, unknown>;
      requirement_kind?: StaffPayTierRequirementKind;
    }) => payTiersClient.updateRequirement(tierNumber, { id, params, requirement_kind }),
    onSuccess: (_data, { tierNumber }) => {
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.requirements(tierNumber) });
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.staffSummaries() });
    },
  });
}

export function useDeletePayTierRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tierNumber, requirementId }: { tierNumber: number; requirementId: string }) =>
      payTiersClient.deleteRequirement(tierNumber, requirementId),
    onSuccess: (_data, { tierNumber }) => {
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.requirements(tierNumber) });
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.staffSummaries() });
    },
  });
}

export function useUpdateStaffTierProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      staffId,
      updates,
    }: {
      staffId: string;
      updates: {
        employment_started_at?: string;
        metric_overrides?: Record<string, number>;
        current_tier_number?: number;
      };
    }) => payTiersClient.updateStaffTierProfile(staffId, updates),
    onSuccess: (progress, { staffId }) => {
      queryClient.setQueryData(payTiersKeys.staffProgress(staffId), progress);
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.staffSummaries() });
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.staffCheckIns(staffId) });
    },
  });
}

export function useRecordPayTierPromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      staffId,
      payload,
    }: {
      staffId: string;
      payload: Parameters<typeof payTiersClient.recordPromotion>[1];
    }) => payTiersClient.recordPromotion(staffId, payload),
    onSuccess: (result, { staffId }) => {
      queryClient.setQueryData(payTiersKeys.staffProgress(staffId), result.progress);
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.staffSummaries() });
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.staffCheckIns(staffId) });
    },
  });
}

export function useUpdatePayTierPromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      staffId,
      promotionId,
      payload,
    }: {
      staffId: string;
      promotionId: string;
      payload: Parameters<typeof payTiersClient.updatePromotion>[2];
    }) => payTiersClient.updatePromotion(staffId, promotionId, payload),
    onSuccess: (result, { staffId }) => {
      queryClient.setQueryData(payTiersKeys.staffProgress(staffId), result.progress);
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.staffSummaries() });
      void queryClient.invalidateQueries({ queryKey: payTiersKeys.staffCheckIns(staffId) });
    },
  });
}
