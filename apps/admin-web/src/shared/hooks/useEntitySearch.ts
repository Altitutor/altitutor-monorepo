import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { studentsApi } from '@/features/students/api/students';
import { staffApi } from '@/features/staff/api/staff';
import { parentsApi } from '@/features/parents/api/parents';
import { classesApi } from '@/features/classes/api/classes';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { topicsApi } from '@/features/topics/api/topics';
import { topicsFilesApi } from '@/features/topics/api/topics-files';
import { sessionsApi } from '@/features/sessions/api/sessions';
import type { Tables } from '@altitutor/shared';

/**
 * Entity result type for entity search
 * Represents a searchable entity (student, staff, parent, class, subject, topic, file, or session)
 */
export type EntitySearchResult =
  | { type: 'student'; id: string; data: Tables<'students'> }
  | { type: 'staff'; id: string; data: Pick<Tables<'staff'>, 'id' | 'first_name' | 'last_name' | 'role' | 'status' | 'email' | 'phone_number'> }
  | { type: 'parent'; id: string; data: Pick<Tables<'parents'>, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'> }
  | { type: 'class'; id: string; data: Pick<Tables<'classes'>, 'id' | 'day_of_week' | 'start_time' | 'end_time' | 'status' | 'room' | 'subject_id' | 'level'> & { subject?: Tables<'subjects'> | null } }
  | { type: 'subject'; id: string; data: Tables<'subjects'> }
  | { type: 'topic'; id: string; data: Tables<'topics'> & { subject: Tables<'subjects'> } }
  | { type: 'file'; id: string; data: { id: string; topic_id: string; code: string | null; file: { filename: string }; topic: { id: string; name: string }; subject: { short_name: string | null; long_name: string | null } } }
  | { type: 'session'; id: string; data: Tables<'sessions'> & { class?: Tables<'classes'> & { subject?: Tables<'subjects'> | null } | null } };

/**
 * Options for useEntitySearch hook
 */
export interface UseEntitySearchOptions {
  search: string;
  enabled?: boolean;
  entityTypes?: {
    students?: boolean;
    staff?: boolean;
    parents?: boolean;
    classes?: boolean;
    subjects?: boolean;
    topics?: boolean;
    files?: boolean;
    sessions?: boolean;
  };
  limits?: {
    students?: number;
    staff?: number;
    parents?: number;
    classes?: number;
    subjects?: number;
    topics?: number;
    files?: number;
    sessions?: number;
  };
}

/**
 * Shared hook for searching all entity types in parallel
 * Can be used by both command palette and inline tagging
 */
export function useEntitySearch({ 
  search, 
  enabled = true,
  entityTypes = {},
  limits = {},
}: UseEntitySearchOptions) {
  // Debounce search queries, but allow immediate empty search (when @ is just typed)
  // This ensures autocomplete shows immediately when @ is pressed
  const trimmedSearch = search.trim();
  const isEmptySearch = trimmedSearch.length === 0;
  
  // Debounce non-empty searches to avoid excessive API calls
  // For empty searches, use search directly for immediate results
  const debouncedSearch = useDebounce(search, 150);
  // Use original search immediately if empty, otherwise use debounced value
  const finalSearch = isEmptySearch ? search : debouncedSearch;
  const shouldSearch = enabled; // Always search when enabled

  // Default entity type enables (all enabled by default)
  const {
    students: studentsEnabled = true,
    staff: staffEnabled = true,
    parents: parentsEnabled = true,
    classes: classesEnabled = true,
    subjects: subjectsEnabled = true,
    topics: topicsEnabled = true,
    files: filesEnabled = true,
    sessions: sessionsEnabled = true,
  } = entityTypes;

  // Default limits
  const {
    students: studentsLimit = 8,
    staff: staffLimit = 8,
    parents: parentsLimit = 8,
    classes: classesLimit = 8,
    subjects: subjectsLimit = 8,
    topics: topicsLimit = 8,
    files: filesLimit = 8,
    sessions: sessionsLimit = 8,
  } = limits;

  // Students search
  const studentsQuery = useQuery({
    queryKey: ['entity-search-students', finalSearch.trim()],
    queryFn: async () => {
      const searchTerm = finalSearch.trim();
      const results = await studentsApi.searchStudents(searchTerm, ['ACTIVE', 'TRIAL'], true);
      return results.slice(0, studentsLimit).map((student) => ({
        type: 'student' as const,
        id: student.id,
        data: student,
      }));
    },
    enabled: shouldSearch && studentsEnabled,
    staleTime: 30000,
  });

  // Staff search
  const staffQuery = useQuery({
    queryKey: ['entity-search-staff', finalSearch.trim()],
    queryFn: async () => {
      const searchTerm = finalSearch.trim();
      const result = await staffApi.listMinimal({
        search: searchTerm,
        statuses: ['ACTIVE'],
        limit: staffLimit,
        offset: 0,
        excludeClassSearch: true,
      });
      return result.staff.map((staff) => ({
        type: 'staff' as const,
        id: staff.id,
        data: {
          id: staff.id,
          first_name: staff.first_name,
          last_name: staff.last_name,
          role: staff.role,
          status: staff.status,
          email: staff.email,
          phone_number: staff.phone_number,
        },
      }));
    },
    enabled: shouldSearch && staffEnabled,
    staleTime: 30000,
  });

  // Parents search
  const parentsQuery = useQuery({
    queryKey: ['entity-search-parents', finalSearch.trim()],
    queryFn: async () => {
      const searchTerm = finalSearch.trim();
      const result = await parentsApi.list({
        search: searchTerm,
        limit: parentsLimit,
        offset: 0,
      });
      return result.parents.slice(0, parentsLimit).map((parent) => ({
        type: 'parent' as const,
        id: parent.id,
        data: {
          id: parent.id,
          first_name: parent.first_name,
          last_name: parent.last_name,
          email: parent.email,
          phone: parent.phone,
        },
      }));
    },
    enabled: shouldSearch && parentsEnabled,
    staleTime: 30000,
  });

  // Classes search
  const classesQuery = useQuery({
    queryKey: ['entity-search-classes', finalSearch.trim()],
    queryFn: async () => {
      const searchTerm = finalSearch.trim();
      const result = await classesApi.listMinimal({
        search: searchTerm,
        limit: classesLimit,
        offset: 0,
        excludeStudentSearch: true,
        excludeStaffSearch: true,
      });
      return result.classes.slice(0, classesLimit).map((cls) => ({
        type: 'class' as const,
        id: cls.id,
        data: cls,
      }));
    },
    enabled: shouldSearch && classesEnabled,
    staleTime: 30000,
  });

  // Subjects search
  const subjectsQuery = useQuery({
    queryKey: ['entity-search-subjects', finalSearch.trim()],
    queryFn: async () => {
      const searchTerm = finalSearch.trim();
      const result = await subjectsApi.list({
        search: searchTerm,
        limit: subjectsLimit,
        offset: 0,
      });
      return result.subjects.slice(0, subjectsLimit).map((subject) => ({
        type: 'subject' as const,
        id: subject.id,
        data: subject,
      }));
    },
    enabled: shouldSearch && subjectsEnabled,
    staleTime: 30000,
  });

  // Topics search
  const topicsQuery = useQuery({
    queryKey: ['entity-search-topics', finalSearch.trim()],
    queryFn: async () => {
      const searchTerm = finalSearch.trim();
      const result = await topicsApi.search({
        search: searchTerm,
        limit: topicsLimit,
        offset: 0,
      });
      return result.topics.slice(0, topicsLimit).map((topic) => ({
        type: 'topic' as const,
        id: topic.id,
        data: topic,
      }));
    },
    enabled: shouldSearch && topicsEnabled,
    staleTime: 30000,
  });

  // Files search
  const filesQuery = useQuery({
    queryKey: ['entity-search-files', finalSearch.trim()],
    queryFn: async () => {
      const searchTerm = finalSearch.trim();
      const result = await topicsFilesApi.searchFiles({
        search: searchTerm,
        limit: filesLimit,
        offset: 0,
      });
      return result.files.slice(0, filesLimit).map((file) => ({
        type: 'file' as const,
        id: file.id,
        data: {
          id: file.id,
          topic_id: file.topic_id,
          code: file.code,
          file: {
            filename: file.file.filename,
          },
          topic: {
            id: file.topic.id,
            name: file.topic.name,
          },
          subject: {
            short_name: file.subject.short_name,
            long_name: file.subject.long_name,
          },
        },
      }));
    },
    enabled: shouldSearch && filesEnabled,
    staleTime: 30000,
  });

  // Sessions search
  const sessionsQuery = useQuery({
    queryKey: ['entity-search-sessions', finalSearch.trim()],
    queryFn: async () => {
      const searchTerm = finalSearch.trim();
      const result = await sessionsApi.getAllSessionsWithDetails({
        search: searchTerm,
        includeInactive: false,
        orderBy: 'start_at',
        ascending: false,
      });
      return result.sessions.slice(0, sessionsLimit).map((session) => ({
        type: 'session' as const,
        id: session.id,
        data: {
          ...session,
          class: result.classesById[session.class_id || ''] 
            ? {
                ...result.classesById[session.class_id || ''],
                subject: result.subjectsById[result.classesById[session.class_id || '']?.subject_id || ''] || null,
              }
            : null,
        },
      }));
    },
    enabled: shouldSearch && sessionsEnabled,
    staleTime: 30000,
  });

  // Combine all results
  const allResults: EntitySearchResult[] = [
    ...(studentsQuery.data || []),
    ...(staffQuery.data || []),
    ...(parentsQuery.data || []),
    ...(classesQuery.data || []),
    ...(subjectsQuery.data || []),
    ...(topicsQuery.data || []),
    ...(filesQuery.data || []),
    ...(sessionsQuery.data || []),
  ];

  const isLoading =
    studentsQuery.isLoading ||
    staffQuery.isLoading ||
    parentsQuery.isLoading ||
    classesQuery.isLoading ||
    subjectsQuery.isLoading ||
    topicsQuery.isLoading ||
    filesQuery.isLoading ||
    sessionsQuery.isLoading;

  const hasError =
    studentsQuery.isError ||
    staffQuery.isError ||
    parentsQuery.isError ||
    classesQuery.isError ||
    subjectsQuery.isError ||
    topicsQuery.isError ||
    filesQuery.isError ||
    sessionsQuery.isError;

  return {
    results: allResults,
    isLoading,
    hasError,
    queries: {
      students: studentsQuery,
      staff: staffQuery,
      parents: parentsQuery,
      classes: classesQuery,
      subjects: subjectsQuery,
      topics: topicsQuery,
      files: filesQuery,
      sessions: sessionsQuery,
    },
  };
}
