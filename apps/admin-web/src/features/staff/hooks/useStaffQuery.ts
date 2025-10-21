import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '../api/staff';
import type { Tables, TablesInsert } from '@altitutor/shared';
type Staff = Tables<'staff'>;
type Subject = Tables<'subjects'>;
type StaffRole = string;
type StaffStatus = string;

// Query Keys
export const staffKeys = {
  all: ['staff'] as const,
  lists: () => [...staffKeys.all, 'list'] as const,
  list: (filters: string) => [...staffKeys.lists(), { filters }] as const,
  details: () => [...staffKeys.all, 'detail'] as const,
  detail: (id: string) => [...staffKeys.details(), id] as const,
  withSubjects: () => [...staffKeys.all, 'withSubjects'] as const,
  current: () => [...staffKeys.all, 'current'] as const,
  byRole: (role: StaffRole) => [...staffKeys.all, 'byRole', role] as const,
  byStatus: (status: StaffStatus) => [...staffKeys.all, 'byStatus', status] as const,
};

// Get all staff with subjects (optimized query)
export function useStaffWithSubjects() {
  return useQuery({
    queryKey: staffKeys.withSubjects(),
    queryFn: staffApi.getAllStaffWithSubjects,
    staleTime: 1000 * 60 * 2, // 2 minutes - frequently updated data
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get all staff (basic)
export function useStaff() {
  return useQuery({
    queryKey: staffKeys.lists(),
    queryFn: staffApi.getAllStaff,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Get single staff member with subjects
export function useStaffWithSubjectsById(staffId: string) {
  return useQuery({
    queryKey: staffKeys.detail(staffId),
    queryFn: () => staffApi.getStaffWithSubjects(staffId),
    enabled: !!staffId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get single staff member (basic)
export function useStaffById(staffId: string) {
  return useQuery({
    queryKey: [...staffKeys.detail(staffId), 'basic'],
    queryFn: () => staffApi.getStaff(staffId),
    enabled: !!staffId,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Get current staff member (logged in user)
export function useCurrentStaff() {
  return useQuery({
    queryKey: staffKeys.current(),
    queryFn: staffApi.getCurrentStaff,
    staleTime: 1000 * 60 * 5, // 5 minutes - user data doesn't change often
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Get staff subjects
export function useStaffSubjects(staffId: string) {
  return useQuery({
    queryKey: [...staffKeys.detail(staffId), 'subjects'],
    queryFn: () => staffApi.getStaffSubjects(staffId),
    enabled: !!staffId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Mutations
export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, password }: { data: TablesInsert<'staff'>; password: string }) => {
      // Convert data to the expected format for createStaff
      const staffData: TablesInsert<'staff'> = {
        id: data.id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        role: data.role || 'TUTOR',
        status: data.status || 'TRIAL',
        phone_number: data.phone_number || null,
        office_key_number: data.office_key_number || null,
        has_parking_remote: data.has_parking_remote || null,
        availability_monday: data.availability_monday || false,
        availability_tuesday: data.availability_tuesday || false,
        availability_wednesday: data.availability_wednesday || false,
        availability_thursday: data.availability_thursday || false,
        availability_friday: data.availability_friday || false,
        availability_saturday_am: data.availability_saturday_am || false,
        availability_saturday_pm: data.availability_saturday_pm || false,
        availability_sunday_am: data.availability_sunday_am || false,
        availability_sunday_pm: data.availability_sunday_pm || false,
        notes: data.notes || null,
        user_id: data.user_id || null,
        created_at: data.created_at || null,
        updated_at: data.updated_at || null,
      };
      return staffApi.createStaff(staffData, password);
    },
    onSuccess: (result) => {
      // Invalidate and refetch staff lists
      queryClient.invalidateQueries({ queryKey: staffKeys.all });
      
      // Optimistically add the new staff member to the cache
      queryClient.setQueryData(staffKeys.withSubjects(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          staff: [...(old.staff || []), result.staff],
          staffSubjects: { ...old.staffSubjects, [result.staff.id]: [] },
        };
      });
    },
  });
}

export function useInviteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: staffApi.inviteStaff,
    onSuccess: (result) => {
      // Invalidate and refetch staff lists
      queryClient.invalidateQueries({ queryKey: staffKeys.all });
      
      // Optimistically add the new staff member to the cache
      queryClient.setQueryData(staffKeys.withSubjects(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          staff: [...(old.staff || []), result.staff],
          staffSubjects: { ...old.staffSubjects, [result.staff.id]: [] },
        };
      });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Staff> }) =>
      staffApi.updateStaff(id, data),
    onSuccess: (updatedStaff, { id }) => {
      // Update the staff member in all relevant caches
      queryClient.setQueryData(staffKeys.detail(id), (old: any) => {
        if (!old) return old;
        return { ...old, staff: updatedStaff };
      });

      // Update in the main staff list
      queryClient.setQueryData(staffKeys.withSubjects(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          staff: old.staff.map((staff: Staff) =>
            staff.id === id ? updatedStaff : staff
          ),
        };
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: staffKeys.all });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: staffApi.deleteStaff,
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: staffKeys.detail(deletedId) });
      
      // Remove from lists
      queryClient.setQueryData(staffKeys.withSubjects(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          staff: old.staff.filter((staff: Staff) => staff.id !== deletedId),
          staffSubjects: Object.fromEntries(
            Object.entries(old.staffSubjects).filter(([id]) => id !== deletedId)
          ),
        };
      });

      // Invalidate all staff queries
      queryClient.invalidateQueries({ queryKey: staffKeys.all });
    },
  });
}

export function useAssignSubjectToStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ staffId, subjectId }: { staffId: string; subjectId: string }) =>
      staffApi.assignSubjectToStaff(staffId, subjectId),
    onSuccess: (_, { staffId, subjectId }) => {
      // Invalidate staff details to refetch with new subject
      queryClient.invalidateQueries({ queryKey: staffKeys.detail(staffId) });
      queryClient.invalidateQueries({ queryKey: staffKeys.withSubjects() });
      
      // Also invalidate class queries since staff assignments affect classes
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useRemoveSubjectFromStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ staffId, subjectId }: { staffId: string; subjectId: string }) =>
      staffApi.removeSubjectFromStaff(staffId, subjectId),
    onSuccess: (_, { staffId, subjectId }) => {
      // Invalidate staff details to refetch without the subject
      queryClient.invalidateQueries({ queryKey: staffKeys.detail(staffId) });
      queryClient.invalidateQueries({ queryKey: staffKeys.withSubjects() });
      
      // Also invalidate class queries since staff assignments affect classes
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
} 