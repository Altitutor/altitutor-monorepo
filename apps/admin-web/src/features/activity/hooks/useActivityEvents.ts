import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../api';
import type { ActivityEventsParams } from '../types';

/**
 * Query keys for activity events
 */
export const activityKeys = {
  all: ['activity'] as const,
  lists: () => [...activityKeys.all, 'list'] as const,
  list: (params: ActivityEventsParams) => [...activityKeys.lists(), params] as const,
  student: (studentId: string) => [...activityKeys.all, 'student', studentId] as const,
  staff: (staffId: string) => [...activityKeys.all, 'staff', staffId] as const,
  class: (classId: string) => [...activityKeys.all, 'class', classId] as const,
  session: (sessionId: string) => [...activityKeys.all, 'session', sessionId] as const,
  parent: (parentId: string) => [...activityKeys.all, 'parent', parentId] as const,
  task: (taskId: string) => [...activityKeys.all, 'task', taskId] as const,
  adminShift: (adminShiftId: string) => [...activityKeys.all, 'adminShift', adminShiftId] as const,
};

/**
 * Get activity events with filters
 */
export function useActivityEvents(params: ActivityEventsParams & { enabled?: boolean }) {
  const { enabled = true, ...queryParams } = params;

  return useQuery({
    queryKey: activityKeys.list(queryParams),
    queryFn: () => activityApi.getActivityEvents(queryParams),
    enabled: enabled && (!!queryParams.entityId || !!queryParams.studentId || !!queryParams.staffId || !!queryParams.classId || !!queryParams.sessionId || !!queryParams.parentId),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get activity events for a student
 */
export function useStudentActivity(studentId: string | null, enabled = true, limit = 50) {
  return useQuery({
    queryKey: activityKeys.student(studentId || ''),
    queryFn: () => activityApi.getStudentActivity(studentId!, limit),
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Get activity events for a staff member
 */
export function useStaffActivity(staffId: string | null, enabled = true, limit = 50) {
  return useQuery({
    queryKey: activityKeys.staff(staffId || ''),
    queryFn: () => activityApi.getStaffActivity(staffId!, limit),
    enabled: enabled && !!staffId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Get activity events for a class
 */
export function useClassActivity(classId: string | null, enabled = true, limit = 50) {
  return useQuery({
    queryKey: activityKeys.class(classId || ''),
    queryFn: () => activityApi.getClassActivity(classId!, limit),
    enabled: enabled && !!classId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Get activity events for a session
 */
export function useSessionActivity(sessionId: string | null, enabled = true, limit = 50) {
  return useQuery({
    queryKey: activityKeys.session(sessionId || ''),
    queryFn: () => activityApi.getSessionActivity(sessionId!, limit),
    enabled: enabled && !!sessionId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Get activity events for a parent
 */
export function useParentActivity(parentId: string | null, enabled = true, limit = 50) {
  return useQuery({
    queryKey: activityKeys.parent(parentId || ''),
    queryFn: () => activityApi.getParentActivity(parentId!, limit),
    enabled: enabled && !!parentId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Get activity events for a task
 */
export function useTaskActivity(taskId: string | null, enabled = true, limit = 50) {
  return useQuery({
    queryKey: activityKeys.task(taskId || ''),
    queryFn: () => activityApi.getTaskActivity(taskId!, limit),
    enabled: enabled && !!taskId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Get activity events for an admin shift
 */
export function useAdminShiftActivity(adminShiftId: string | null, enabled = true, limit = 50) {
  return useQuery({
    queryKey: activityKeys.adminShift(adminShiftId || ''),
    queryFn: () => activityApi.getAdminShiftActivity(adminShiftId!, limit),
    enabled: enabled && !!adminShiftId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}