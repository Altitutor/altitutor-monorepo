'use client';

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { activityApi } from '../api';
import type { ActivityEventsParams, ActivityEventsResponse, SessionActivityResponse } from '../types';
import { mergeActivityPages, mergeSessionActivityPages } from '../lib/mergeActivityPages';
import { useSupabaseRealtimeInvalidation } from '@/shared/hooks/useSupabaseRealtimeInvalidation';

export const ACTIVITY_PAGE_SIZE = 50;

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
  issue: (issueId: string) => [...activityKeys.all, 'issue', issueId] as const,
  adminShift: (adminShiftId: string) => [...activityKeys.all, 'adminShift', adminShiftId] as const,
};

type ActivityFeedQueryResult = {
  data: ActivityEventsResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

function toFeedResult(
  query: {
    data?: { pages: ActivityEventsResponse[] };
    isLoading: boolean;
    error: Error | null;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
  }
): ActivityFeedQueryResult {
  return {
    data: query.data ? mergeActivityPages(query.data.pages) : undefined,
    isLoading: query.isLoading,
    error: query.error,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
  };
}

function getNextOffset(lastPage: ActivityEventsResponse, allPages: ActivityEventsResponse[]) {
  if (!lastPage.hasMore) return undefined;
  return allPages.reduce((sum, page) => sum + page.events.length, 0);
}

/**
 * Get activity events with filters
 */
export function useActivityEvents(params: ActivityEventsParams & { enabled?: boolean }) {
  const { enabled = true, limit = ACTIVITY_PAGE_SIZE, ...queryParams } = params;

  const query = useInfiniteQuery({
    queryKey: activityKeys.list({ ...queryParams, limit }),
    queryFn: ({ pageParam }) =>
      activityApi.getActivityEvents({ ...queryParams, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled:
      enabled &&
      (!!queryParams.entityId ||
        !!queryParams.studentId ||
        !!queryParams.staffId ||
        !!queryParams.classId ||
        !!queryParams.sessionId ||
        !!queryParams.parentId ||
        !!queryParams.issueId),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  return toFeedResult(query);
}

export function useStudentActivity(
  studentId: string | null,
  enabled = true,
  limit = ACTIVITY_PAGE_SIZE
): ActivityFeedQueryResult {
  const query = useInfiniteQuery({
    queryKey: [...activityKeys.student(studentId || ''), { limit }] as const,
    queryFn: ({ pageParam }) => activityApi.getStudentActivity(studentId!, limit, pageParam),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  return toFeedResult(query);
}

export function useStaffActivity(
  staffId: string | null,
  enabled = true,
  limit = ACTIVITY_PAGE_SIZE
): ActivityFeedQueryResult {
  const query = useInfiniteQuery({
    queryKey: [...activityKeys.staff(staffId || ''), { limit }] as const,
    queryFn: ({ pageParam }) => activityApi.getStaffActivity(staffId!, limit, pageParam),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: enabled && !!staffId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  return toFeedResult(query);
}

export function useClassActivity(
  classId: string | null,
  enabled = true,
  limit = ACTIVITY_PAGE_SIZE
): ActivityFeedQueryResult {
  const query = useInfiniteQuery({
    queryKey: [...activityKeys.class(classId || ''), { limit }] as const,
    queryFn: ({ pageParam }) => activityApi.getClassActivity(classId!, limit, pageParam),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: enabled && !!classId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  return toFeedResult(query);
}

/**
 * Session activity. Admin meetings invalidate from notes/tasks/issues/projects realtime
 * and fall back to a 30s poll while live.
 */
export function useSessionActivity(
  sessionId: string | null,
  enabled = true,
  limit = ACTIVITY_PAGE_SIZE
) {
  const query = useInfiniteQuery({
    queryKey: [...activityKeys.session(sessionId || ''), { limit }] as const,
    queryFn: ({ pageParam }) => activityApi.getSessionActivity(sessionId!, limit, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => getNextOffset(lastPage, allPages),
    enabled: enabled && !!sessionId,
    staleTime: 1000 * 5,
    gcTime: 1000 * 60 * 5,
    refetchInterval: (q) => {
      if (!enabled) return false;
      const isLive = q.state.data?.pages.some((page) => page.isAdminMeetingLive);
      return isLive ? 30_000 : false;
    },
  });

  const isLive = useMemo(
    () => Boolean(query.data?.pages.some((page) => page.isAdminMeetingLive)),
    [query.data?.pages]
  );

  const sessionQueryKey = activityKeys.session(sessionId || '');
  const realtimeEnabled = enabled && !!sessionId && isLive;

  useSupabaseRealtimeInvalidation({
    table: 'notes',
    queryKey: sessionQueryKey,
    debounceMs: 400,
    enabled: realtimeEnabled,
  });
  useSupabaseRealtimeInvalidation({
    table: 'tasks',
    queryKey: sessionQueryKey,
    debounceMs: 400,
    enabled: realtimeEnabled,
  });
  useSupabaseRealtimeInvalidation({
    table: 'issues',
    queryKey: sessionQueryKey,
    debounceMs: 400,
    enabled: realtimeEnabled,
  });
  useSupabaseRealtimeInvalidation({
    table: 'projects',
    queryKey: sessionQueryKey,
    debounceMs: 400,
    enabled: realtimeEnabled,
  });

  const data: SessionActivityResponse | undefined = query.data
    ? mergeSessionActivityPages(query.data.pages)
    : undefined;

  return {
    data,
    isLoading: query.isLoading,
    error: query.error,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
  };
}

export function useParentActivity(
  parentId: string | null,
  enabled = true,
  limit = ACTIVITY_PAGE_SIZE
): ActivityFeedQueryResult {
  const query = useInfiniteQuery({
    queryKey: [...activityKeys.parent(parentId || ''), { limit }] as const,
    queryFn: ({ pageParam }) => activityApi.getParentActivity(parentId!, limit, pageParam),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: enabled && !!parentId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  return toFeedResult(query);
}

export function useTaskActivity(
  taskId: string | null,
  enabled = true,
  limit = ACTIVITY_PAGE_SIZE
): ActivityFeedQueryResult {
  const query = useInfiniteQuery({
    queryKey: [...activityKeys.task(taskId || ''), { limit }] as const,
    queryFn: ({ pageParam }) => activityApi.getTaskActivity(taskId!, limit, pageParam),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: enabled && !!taskId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  return toFeedResult(query);
}

export function useIssueActivity(params: {
  issueId: string | null;
  studentIds?: string[];
  staffIds?: string[];
  classIds?: string[];
  sessionIds?: string[];
  invoiceIds?: string[];
  enabled?: boolean;
  limit?: number;
}): ActivityFeedQueryResult {
  const { issueId, enabled = true, limit = ACTIVITY_PAGE_SIZE, ...ids } = params;

  const query = useInfiniteQuery({
    queryKey: [...activityKeys.issue(issueId || ''), ids, { limit }] as const,
    queryFn: ({ pageParam }) =>
      activityApi.getIssueActivity({ issueId: issueId!, limit, offset: pageParam, ...ids }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: enabled && !!issueId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  return toFeedResult(query);
}

export function useAdminShiftActivity(
  adminShiftId: string | null,
  enabled = true,
  limit = ACTIVITY_PAGE_SIZE
): ActivityFeedQueryResult {
  const query = useInfiniteQuery({
    queryKey: [...activityKeys.adminShift(adminShiftId || ''), { limit }] as const,
    queryFn: ({ pageParam }) =>
      activityApi.getAdminShiftActivity(adminShiftId!, limit, pageParam),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: enabled && !!adminShiftId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  return toFeedResult(query);
}
