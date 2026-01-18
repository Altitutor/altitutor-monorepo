import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { studentsApi } from '@/features/students/api/students';
import { staffApi } from '@/features/staff/api/staff';
import { parentsApi } from '@/features/parents/api/parents';
import { classesApi } from '@/features/classes/api/classes';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { topicsApi } from '@/features/topics/api/topics';
import { entityTypes } from '../config/commandPalette.config';
import type { Tables } from '@altitutor/shared';

export type CommandPaletteEntityResult = 
  | { type: 'student'; id: string; data: Tables<'students'> }
  | { type: 'staff'; id: string; data: Pick<Tables<'staff'>, 'id' | 'first_name' | 'last_name' | 'role' | 'status' | 'email' | 'phone_number'> }
  | { type: 'parent'; id: string; data: Pick<Tables<'parents'>, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'> }
  | { type: 'class'; id: string; data: any } // ClassSummary from classes API
  | { type: 'subject'; id: string; data: Tables<'subjects'> }
  | { type: 'topic'; id: string; data: Tables<'topics'> & { subject: Tables<'subjects'> } };

export interface UseCommandPaletteSearchOptions {
  search: string;
  enabled?: boolean;
}

/**
 * Hook for searching all entity types in parallel
 * Uses individual RPC functions for better performance and caching
 */
export function useCommandPaletteSearch({ search, enabled = true }: UseCommandPaletteSearchOptions) {
  const debouncedSearch = useDebounce(search, 250);
  const trimmedSearch = debouncedSearch.trim();
  const shouldSearch = enabled && trimmedSearch.length >= 2;

  // Students search - includes both ACTIVE and TRIAL students
  // Exclude class search for command palette (name-only search)
  const studentsQuery = useQuery({
    queryKey: ['command-palette-students', trimmedSearch],
    queryFn: async () => {
      const results = await studentsApi.searchStudents(trimmedSearch, ['ACTIVE', 'TRIAL'], true);
      return results.slice(0, entityTypes.students.limit).map((student) => ({
        type: 'student' as const,
        id: student.id,
        data: student,
      }));
    },
    enabled: shouldSearch && entityTypes.students.enabled,
    staleTime: 30000,
  });

  // Staff search - exclude class search for command palette (name-only search)
  const staffQuery = useQuery({
    queryKey: ['command-palette-staff', trimmedSearch],
    queryFn: async () => {
      const result = await staffApi.listMinimal({
        search: trimmedSearch,
        statuses: ['ACTIVE'],
        limit: entityTypes.staff.limit,
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
    enabled: shouldSearch && entityTypes.staff.enabled,
    staleTime: 30000,
  });

  // Parents search
  const parentsQuery = useQuery({
    queryKey: ['command-palette-parents', trimmedSearch],
    queryFn: async () => {
      const result = await parentsApi.list({
        search: trimmedSearch,
        limit: entityTypes.parents.limit,
        offset: 0,
      });
      return result.parents.slice(0, entityTypes.parents.limit).map((parent) => ({
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
    enabled: shouldSearch && entityTypes.parents.enabled,
    staleTime: 30000,
  });

  // Classes search
  const classesQuery = useQuery({
    queryKey: ['command-palette-classes', trimmedSearch],
    queryFn: async () => {
      const result = await classesApi.listMinimal({
        search: trimmedSearch,
        limit: entityTypes.classes.limit,
        offset: 0,
      });
      return result.classes.slice(0, entityTypes.classes.limit).map((cls) => ({
        type: 'class' as const,
        id: cls.id,
        data: cls,
      }));
    },
    enabled: shouldSearch && entityTypes.classes.enabled,
    staleTime: 30000,
  });

  // Subjects search
  const subjectsQuery = useQuery({
    queryKey: ['command-palette-subjects', trimmedSearch],
    queryFn: async () => {
      const result = await subjectsApi.list({
        search: trimmedSearch,
        limit: entityTypes.subjects.limit,
        offset: 0,
      });
      return result.subjects.slice(0, entityTypes.subjects.limit).map((subject) => ({
        type: 'subject' as const,
        id: subject.id,
        data: subject,
      }));
    },
    enabled: shouldSearch && entityTypes.subjects.enabled,
    staleTime: 30000,
  });

  // Topics search
  const topicsQuery = useQuery({
    queryKey: ['command-palette-topics', trimmedSearch],
    queryFn: async () => {
      const result = await topicsApi.search({
        search: trimmedSearch,
        limit: entityTypes.topics.limit,
        offset: 0,
      });
      return result.topics.slice(0, entityTypes.topics.limit).map((topic) => ({
        type: 'topic' as const,
        id: topic.id,
        data: topic,
      }));
    },
    enabled: shouldSearch && entityTypes.topics.enabled,
    staleTime: 30000,
  });

  // Combine all results
  const allResults: CommandPaletteEntityResult[] = [
    ...(studentsQuery.data || []),
    ...(staffQuery.data || []),
    ...(parentsQuery.data || []),
    ...(classesQuery.data || []),
    ...(subjectsQuery.data || []),
    ...(topicsQuery.data || []),
  ];

  const isLoading = 
    studentsQuery.isLoading ||
    staffQuery.isLoading ||
    parentsQuery.isLoading ||
    classesQuery.isLoading ||
    subjectsQuery.isLoading ||
    topicsQuery.isLoading;

  const hasError = 
    studentsQuery.isError ||
    staffQuery.isError ||
    parentsQuery.isError ||
    classesQuery.isError ||
    subjectsQuery.isError ||
    topicsQuery.isError;

  return {
    results: allResults,
    isLoading,
    hasError,
    // Individual query states for debugging
    queries: {
      students: studentsQuery,
      staff: staffQuery,
      parents: parentsQuery,
      classes: classesQuery,
      subjects: subjectsQuery,
      topics: topicsQuery,
    },
  };
}
