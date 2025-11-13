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
  minimal: (params: any) => [...staffKeys.all, 'minimal', params] as const,
  details: () => [...staffKeys.all, 'detail'] as const,
  detail: (id: string) => [...staffKeys.details(), id] as const,
  detailFull: (id: string) => [...staffKeys.detail(id), 'details'] as const,
  withSubjects: () => [...staffKeys.all, 'withSubjects'] as const,
  current: () => [...staffKeys.all, 'current'] as const,
  byRole: (role: StaffRole) => [...staffKeys.all, 'byRole', role] as const,
  byStatus: (status: StaffStatus) => [...staffKeys.all, 'byStatus', status] as const,
};

// For table display - minimal data
export function useStaffMinimal(params?: { search?: string; role?: string; status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: staffKeys.minimal(params),
    queryFn: () => staffApi.listMinimal(params || {}),
    staleTime: 1000 * 30, // 30s
    gcTime: 1000 * 60 * 5,
  });
}

// For modal - full details
export function useStaffDetails(staffId: string, enabled = true) {
  return useQuery({
    queryKey: staffKeys.detailFull(staffId),
    queryFn: () => staffApi.getStaffDetails(staffId),
    enabled: enabled && !!staffId,
    staleTime: 1000 * 60 * 2, // 2min
    gcTime: 1000 * 60 * 5,
  });
}

// Get all staff with subjects (optimized query)
// DEPRECATED: Use useStaffMinimal() + useStaffDetails() instead
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
export function useInviteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: staffApi.inviteStaff,
    onSuccess: () => {
      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['staff', 'minimal'] });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Staff> }) =>
      staffApi.updateStaff(id, data),
    onSuccess: (updatedStaff, { id }) => {
      // Update specific entity in cache
      queryClient.setQueryData(staffKeys.detailFull(id), (old: any) => {
        if (!old) return old;
        return { ...old, staff: updatedStaff };
      });

      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['staff', 'minimal'] });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: staffApi.deleteStaff,
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: staffKeys.detailFull(deletedId) });
      
      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['staff', 'minimal'] });
    },
  });
}

export function useAssignSubjectToStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ staffId, subjectId }: { staffId: string; subjectId: string }) =>
      staffApi.assignSubjectToStaff(staffId, subjectId),
    onSuccess: (_, { staffId }) => {
      // Invalidate specific staff details
      queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staffId) });
    },
  });
}

export function useRemoveSubjectFromStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ staffId, subjectId }: { staffId: string; subjectId: string }) =>
      staffApi.removeSubjectFromStaff(staffId, subjectId),
    onSuccess: (_, { staffId }) => {
      // Invalidate specific staff details
      queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staffId) });
    },
  });
}

// Get students taught by a staff member (via their classes) with their subjects
export function useStaffStudents(staffId: string, enabled = true) {
  return useQuery({
    queryKey: [...staffKeys.detail(staffId), 'students'],
    queryFn: async () => {
      const { classesApi } = await import('@/features/classes/api');
      const { studentsApi } = await import('@/features/students/api');
      const { classStudents } = await classesApi.getClassesForStaffWithDetails(staffId);
      
      // Get all unique students from all classes
      const studentMap = new Map<string, Tables<'students'>>();
      Object.values(classStudents).forEach(students => {
        students.forEach(student => {
          if (!studentMap.has(student.id)) {
            studentMap.set(student.id, student);
          }
        });
      });
      
      const students = Array.from(studentMap.values());
      
      // Fetch subjects for all students in parallel
      if (students.length > 0) {
        const studentIds = students.map(s => s.id);
        const { studentSubjects } = await studentsApi.getDetailsForStudentIds(studentIds);
        
        return {
          students,
          studentSubjects
        };
      }
      
      return {
        students: [],
        studentSubjects: {}
      };
    },
    enabled: enabled && !!staffId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
} 