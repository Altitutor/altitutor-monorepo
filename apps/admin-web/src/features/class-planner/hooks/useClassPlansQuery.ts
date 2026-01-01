import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classPlansApi } from '../api/classPlans';
import type { CreateClassPlanData, UpdateClassPlanData } from '../api/classPlans';

// Query Keys
export const classPlansKeys = {
  all: ['classPlans'] as const,
  lists: () => [...classPlansKeys.all, 'list'] as const,
  list: () => [...classPlansKeys.lists()] as const,
  details: () => [...classPlansKeys.all, 'detail'] as const,
  detail: (id: string) => [...classPlansKeys.details(), id] as const,
};

/**
 * Get all class plans
 */
export function useClassPlans() {
  return useQuery({
    queryKey: classPlansKeys.list(),
    queryFn: () => classPlansApi.getAllClassPlans(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get a single class plan with all details
 */
export function useClassPlan(planId: string, enabled = true) {
  return useQuery({
    queryKey: classPlansKeys.detail(planId),
    queryFn: () => classPlansApi.getClassPlan(planId),
    enabled: enabled && !!planId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Create a new class plan
 */
export function useCreateClassPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClassPlanData) => classPlansApi.createClassPlan(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classPlansKeys.list() });
    },
  });
}

/**
 * Update a class plan
 */
export function useUpdateClassPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClassPlanData }) =>
      classPlansApi.updateClassPlan(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: classPlansKeys.list() });
      qc.invalidateQueries({ queryKey: classPlansKeys.detail(variables.id) });
    },
  });
}

/**
 * Delete a class plan
 */
export function useDeleteClassPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => classPlansApi.deleteClassPlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classPlansKeys.list() });
    },
  });
}

/**
 * Duplicate a class plan
 */
export function useDuplicateClassPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newName, createdBy }: { id: string; newName: string; createdBy: string }) =>
      classPlansApi.duplicateClassPlan(id, newName, createdBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classPlansKeys.list() });
    },
  });
}

/**
 * Copy current classes to draft plan
 */
export function useCopyCurrentClassesToDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ year, planName, createdBy }: { year: number; planName: string; createdBy: string }) =>
      classPlansApi.copyCurrentClassesToDraft(year, planName, createdBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classPlansKeys.list() });
    },
  });
}

/**
 * Apply a class plan
 */
export function useApplyClassPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      sessionStartDate,
      staffId,
    }: {
      planId: string;
      sessionStartDate: Date;
      staffId: string;
    }) => classPlansApi.applyClassPlan(planId, sessionStartDate, staffId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: classPlansKeys.list() });
      qc.invalidateQueries({ queryKey: classPlansKeys.detail(variables.planId) });
      // Invalidate classes and sessions queries since we've modified them
      qc.invalidateQueries({ queryKey: ['classes'] });
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}
