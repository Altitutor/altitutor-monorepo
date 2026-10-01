import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { applyNotificationPatch } from '@/features/notifications/inbox';
import { studentApi, type NotificationPatch, type StudentNotification } from '@/lib/student-api';

export const studentKeys = {
  sessions: ['student', 'sessions'] as const,
  classes: ['student', 'classes'] as const,
  billing: ['student', 'billing'] as const,
  invoices: ['student', 'invoices'] as const,
  subscriptions: ['student', 'subscriptions'] as const,
  profile: ['student', 'profile'] as const,
  subjects: ['student', 'resources', 'subjects'] as const,
};

export function useUpcomingSessions() {
  return useQuery({ queryKey: studentKeys.sessions, queryFn: studentApi.listUpcomingSessions });
}

export function useDashboardSessions() {
  return useQuery({ queryKey: ['student', 'dashboard', 'sessions'], queryFn: studentApi.listDashboardSessions });
}

export function useRecentResources() {
  return useQuery({ queryKey: ['student', 'dashboard', 'resources'], queryFn: studentApi.listRecentResources });
}

export function useStudentClasses() {
  return useQuery({ queryKey: studentKeys.classes, queryFn: studentApi.listClasses });
}

export function useClassDetail(classId: string) {
  return useQuery({ queryKey: ['student', 'classes', classId], queryFn: () => studentApi.getClass(classId) });
}

export function useClassSessions(classId: string) {
  return useQuery({ queryKey: ['student', 'classes', classId, 'sessions'], queryFn: () => studentApi.listClassSessions(classId) });
}

export function useSessionDetail(sessionId: string) {
  return useQuery({ queryKey: ['student', 'sessions', sessionId], queryFn: () => studentApi.getSession(sessionId), enabled: Boolean(sessionId) });
}

export function useResourceSubjects() {
  return useQuery({ queryKey: studentKeys.subjects, queryFn: studentApi.listSubjects });
}

export function useResourceTopics(subjectId: string) {
  return useQuery({ queryKey: ['student', 'resources', subjectId, 'topics'], queryFn: () => studentApi.listTopics(subjectId) });
}

export function useResourceFiles(topicId: string) {
  return useQuery({ queryKey: ['student', 'resources', topicId, 'files'], queryFn: () => studentApi.listFiles(topicId) });
}

export function useResourceSubjectFiles(subjectId: string, topicIds: string[]) {
  return useQuery({
    queryKey: ['student', 'resources', subjectId, 'files', topicIds],
    queryFn: () => studentApi.listFilesForTopics(topicIds),
    enabled: topicIds.length > 0,
  });
}

export function useBilling() {
  return useQuery({ queryKey: studentKeys.billing, queryFn: studentApi.getBilling });
}

export function useInvoices(limit = 6) {
  return useQuery({ queryKey: [...studentKeys.invoices, limit], queryFn: () => studentApi.listInvoices(limit) });
}

export function useSubscriptions() {
  return useQuery({ queryKey: studentKeys.subscriptions, queryFn: studentApi.listSubscriptions });
}

export function useProfile() {
  return useQuery({ queryKey: studentKeys.profile, queryFn: studentApi.getProfile });
}

const notificationKey = ['student', 'notifications'] as const;

export function useNotifications() {
  return useQuery({ queryKey: notificationKey, queryFn: studentApi.listNotifications });
}

export function useUpdateNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: NotificationPatch) => studentApi.patchNotifications(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: notificationKey });
      const previous = queryClient.getQueryData<StudentNotification[]>(notificationKey);
      if (previous) {
        queryClient.setQueryData(notificationKey, applyNotificationPatch(previous, patch, new Date().toISOString()));
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(notificationKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKey }),
  });
}
