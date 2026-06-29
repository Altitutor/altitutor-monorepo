import { useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeSlug } from '@altitutor/shared';
import { resourcesApi } from '../api/resources';
import type { ResourceSubject, ResourceSubjectNavItem } from '../lib/types';

export function useResourceSubjectNavItems() {
  return useQuery({
    queryKey: ['tutor-resources', 'subject-nav'],
    queryFn: resourcesApi.getMySubjectNavItems,
  });
}

export function useResourceSubjects() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['tutor-resources', 'subjects'],
    queryFn: resourcesApi.getMySubjects,
    placeholderData: () => {
      const subjects = queryClient.getQueryData<ResourceSubjectNavItem[]>(['tutor-resources', 'subject-nav']);
      return subjects as ResourceSubject[] | undefined;
    },
  });
}

export function useResourceSubject(subjectShortName: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['tutor-resources', 'subject', subjectShortName],
    queryFn: () => resourcesApi.getSubjectByShortName(subjectShortName),
    enabled: Boolean(subjectShortName),
    initialData: () => {
      const subjects = queryClient.getQueryData<ResourceSubjectNavItem[]>(['tutor-resources', 'subject-nav']);
      if (!subjects) return undefined;
      const slug = normalizeSlug(subjectShortName);
      const subject =
        subjects?.find((item) => normalizeSlug(item.short_name ?? '') === slug) ??
        subjects?.find((item) => normalizeSlug(item.name ?? '') === slug) ??
        null;
      return subject as ResourceSubject | null;
    },
  });
}

export function useResourceTopics(subjectId: string | null) {
  return useQuery({
    queryKey: ['tutor-resources', 'topics', subjectId],
    queryFn: () => {
      if (!subjectId) throw new Error('Subject ID is required');
      return resourcesApi.getTopicsBySubject(subjectId);
    },
    enabled: Boolean(subjectId),
  });
}

export function useResourceTopic(subjectId: string | null, topicCode: string | null) {
  return useQuery({
    queryKey: ['tutor-resources', 'topic', subjectId, topicCode],
    queryFn: () => {
      if (!subjectId || !topicCode) throw new Error('Subject ID and topic code are required');
      return resourcesApi.getTopicByCode(subjectId, topicCode);
    },
    enabled: Boolean(subjectId && topicCode),
  });
}

export function useResourceFileCountsBySubject(subjectId: string | null) {
  return useQuery({
    queryKey: ['tutor-resources', 'file-counts', subjectId],
    queryFn: () => {
      if (!subjectId) throw new Error('Subject ID is required');
      return resourcesApi.getFileCountsBySubject(subjectId);
    },
    enabled: Boolean(subjectId),
  });
}

export function useResourceTopicFiles(topicId: string | null) {
  return useQuery({
    queryKey: ['tutor-resources', 'topic-files', topicId],
    queryFn: () => {
      if (!topicId) throw new Error('Topic ID is required');
      return resourcesApi.getTopicFiles(topicId);
    },
    enabled: Boolean(topicId),
  });
}

export function useResourceTopicFile(topicId: string | null, fileCode: string | null) {
  return useQuery({
    queryKey: ['tutor-resources', 'topic-file', topicId, fileCode],
    queryFn: () => {
      if (!topicId || !fileCode) throw new Error('Topic ID and file code are required');
      return resourcesApi.getTopicFileByCode(topicId, fileCode);
    },
    enabled: Boolean(topicId && fileCode),
  });
}

export function useResourceSignedFileUrl(topicId: string | null, fileCode: string | null) {
  return useQuery({
    queryKey: ['tutor-resources', 'topic-file-url', topicId, fileCode],
    queryFn: async () => {
      if (!topicId || !fileCode) throw new Error('Topic ID and file code are required');
      const file = await resourcesApi.getTopicFileByCode(topicId, fileCode);
      if (!file) return null;
      return resourcesApi.getSignedFileUrl(file);
    },
    enabled: Boolean(topicId && fileCode),
  });
}
