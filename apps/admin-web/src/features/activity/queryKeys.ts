import type { ActivityEventsParams } from './types';

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
  issue: (issueId: string) => [...activityKeys.all, 'issue', issueId] as const,
  project: (projectId: string) => [...activityKeys.all, 'project', projectId] as const,
  adminShift: (adminShiftId: string) => [...activityKeys.all, 'adminShift', adminShiftId] as const,
};
