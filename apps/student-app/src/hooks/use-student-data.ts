import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { studentApi, type StudentProfileUpdate } from '@/lib/student-api';

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

export function useUpdateProfile(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: StudentProfileUpdate) => studentApi.updateProfile(studentId, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentKeys.profile }),
  });
}
