import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminShiftsApi } from '../api/admin-shifts';
import type { Tables, TablesUpdate } from '@altitutor/shared';

// Query Keys
export const adminShiftsKeys = {
  all: ['admin-shifts'] as const,
  lists: () => [...adminShiftsKeys.all, 'list'] as const,
  list: (filters: string) => [...adminShiftsKeys.lists(), { filters }] as const,
  minimal: (params?: any) => [...adminShiftsKeys.all, 'minimal', params] as const,
  details: () => [...adminShiftsKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminShiftsKeys.details(), id] as const,
  detailFull: (id: string) => [...adminShiftsKeys.detail(id), 'details'] as const,
  withDetails: () => [...adminShiftsKeys.all, 'withDetails'] as const,
};

// For table display - minimal data
export interface UseAdminShiftsListParams {
  search?: string;
  dayOfWeek?: number;
  daysOfWeek?: number[];
  page?: number;
  pageSize?: number;
  orderBy?: keyof Tables<'admin_shifts'>;
  ascending?: boolean;
}

export function useAdminShiftsMinimalPaginated(params: UseAdminShiftsListParams = {}) {
  const {
    search = '',
    dayOfWeek,
    daysOfWeek = [],
    page = 1,
    pageSize = 50,
    orderBy = 'day_of_week',
    ascending = true,
  } = params;

  const offset = (Math.max(page, 1) - 1) * pageSize;

  return useQuery({
    queryKey: adminShiftsKeys.minimal({ search, dayOfWeek, daysOfWeek, page, pageSize, orderBy, ascending }),
    queryFn: () =>
      adminShiftsApi.listMinimal({
        search,
        dayOfWeek,
        daysOfWeek,
        limit: pageSize,
        offset,
        orderBy,
        ascending,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

export function useAdminShiftsMinimal(params?: { dayOfWeek?: number; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: adminShiftsKeys.minimal(params),
    queryFn: () => adminShiftsApi.listMinimal(params),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

// Get all admin shifts with details
export function useAdminShiftsWithDetails() {
  return useQuery({
    queryKey: adminShiftsKeys.withDetails(),
    queryFn: adminShiftsApi.getAllAdminShiftsWithDetails,
    staleTime: 1000 * 60 * 2, // 2 minutes - frequently updated data
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get single admin shift with details
export function useAdminShiftDetails(adminShiftId: string, enabled = true) {
  return useQuery({
    queryKey: adminShiftsKeys.detailFull(adminShiftId),
    queryFn: () => adminShiftsApi.getAdminShiftById(adminShiftId),
    enabled: enabled && !!adminShiftId,
    staleTime: 1000 * 60 * 2, // 2min
    gcTime: 1000 * 60 * 5,
  });
}

// Get all admin shifts (basic)
export function useAdminShifts() {
  return useQuery({
    queryKey: adminShiftsKeys.lists(),
    queryFn: adminShiftsApi.getAllAdminShifts,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Mutations
export function useCreateAdminShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminShiftsApi.createAdminShift,
    onSuccess: () => {
      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['admin-shifts', 'minimal'] });
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.withDetails() });
    },
  });
}

export function useUpdateAdminShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'admin_shifts'> }) =>
      adminShiftsApi.updateAdminShift(id, data),
    onSuccess: (updatedAdminShift, { id }) => {
      // Update specific entity in cache
      queryClient.setQueryData(adminShiftsKeys.detailFull(id), (old: any) => {
        if (!old) return old;
        return { ...old, adminShift: updatedAdminShift };
      });

      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['admin-shifts', 'minimal'] });
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.withDetails() });
    },
  });
}

export function useDeleteAdminShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminShiftsApi.deleteAdminShift,
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: adminShiftsKeys.detailFull(deletedId) });
      
      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['admin-shifts', 'minimal'] });
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.withDetails() });
    },
  });
}

export function useAssignStaffToAdminShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      adminShiftId,
      staffId,
      createdBy,
    }: {
      adminShiftId: string;
      staffId: string;
      createdBy?: string;
    }) => adminShiftsApi.assignStaff(adminShiftId, staffId, createdBy),
    onSuccess: (_, { adminShiftId }) => {
      // Invalidate specific admin shift details
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.detailFull(adminShiftId) });
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.withDetails() });
    },
  });
}

export function useUnassignStaffFromAdminShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adminShiftStaffId: string) => adminShiftsApi.unassignStaff(adminShiftStaffId),
    onSuccess: () => {
      // Invalidate all admin shifts since we don't know which one was affected
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.all });
    },
  });
}
