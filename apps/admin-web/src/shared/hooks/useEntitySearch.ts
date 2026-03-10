import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';
import { studentsApi } from '@/features/students/api/students';
import { staffApi } from '@/features/staff/api/staff';
import { parentsApi } from '@/features/parents/api/parents';
import { classesApi } from '@/features/classes/api/classes';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { topicsApi } from '@/features/topics/api/topics';
import { topicsFilesApi } from '@/features/topics/api/topics-files';
import { tasksApi } from '@/features/tasks/api/tasks';
import { issuesApi } from '@/features/issues/api/issues';
import { projectsApi } from '@/features/projects/api/projects';
import { notesApi } from '@/features/notes/api/notes';
import { entityTypes } from '@/features/command-palette/config/commandPalette.config';
import type { CommandPaletteEntityResult } from '@/features/command-palette/types';

export type EntitySearchResult = CommandPaletteEntityResult;

export interface UseEntitySearchOptions {
  search: string;
  enabled?: boolean;
  debounceMs?: number;
  types?: (keyof typeof entityTypes)[];
}

/**
 * Reusable hook for searching across multiple entities.
 * Can be used by Command Palette or Tiptap Mention extension.
 */
export function useEntitySearch({ 
  search, 
  enabled = true, 
  debounceMs = 250,
  types = ['students', 'staff', 'parents', 'classes', 'subjects', 'tasks', 'issues', 'projects', 'topics', 'files', 'notes']
}: UseEntitySearchOptions) {
  const debouncedSearch = useDebounce(search, debounceMs);
  const trimmedSearch = debouncedSearch.trim();
  const shouldSearch = enabled;

  const studentsQuery = useQuery({
    queryKey: ['entity-search-students', trimmedSearch],
    queryFn: async () => {
      const results = await studentsApi.searchStudents(trimmedSearch, ['ACTIVE', 'TRIAL'], true);
      return results.slice(0, entityTypes.students.limit).map((student) => ({
        type: 'student' as const,
        id: student.id,
        data: student,
      }));
    },
    enabled: shouldSearch && types.includes('students'),
    staleTime: 30000,
  });

  const staffQuery = useQuery({
    queryKey: ['entity-search-staff', trimmedSearch],
    queryFn: async () => {
      const result = await staffApi.listMinimal({
        search: trimmedSearch,
        statuses: ['ACTIVE', 'TRIAL'],
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
    enabled: shouldSearch && types.includes('staff'),
    staleTime: 30000,
  });

  const parentsQuery = useQuery({
    queryKey: ['entity-search-parents', trimmedSearch],
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
    enabled: shouldSearch && types.includes('parents'),
    staleTime: 30000,
  });

  const classesQuery = useQuery({
    queryKey: ['entity-search-classes', trimmedSearch],
    queryFn: async () => {
      const result = await classesApi.listMinimal({
        search: trimmedSearch,
        limit: entityTypes.classes.limit,
        offset: 0,
        excludeStudentSearch: true,
        excludeStaffSearch: true,
      });
      return result.classes.slice(0, entityTypes.classes.limit).map((cls) => ({
        type: 'class' as const,
        id: cls.id,
        data: cls,
      }));
    },
    enabled: shouldSearch && types.includes('classes'),
    staleTime: 30000,
  });

  const subjectsQuery = useQuery({
    queryKey: ['entity-search-subjects', trimmedSearch],
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
    enabled: shouldSearch && types.includes('subjects'),
    staleTime: 30000,
  });

  const topicsQuery = useQuery({
    queryKey: ['entity-search-topics', trimmedSearch],
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
    enabled: shouldSearch && types.includes('topics'),
    staleTime: 30000,
  });

  const tasksQuery = useQuery({
    queryKey: ['entity-search-tasks', trimmedSearch],
    queryFn: async () => {
      const result = await tasksApi.search(trimmedSearch, entityTypes.tasks.limit);
      return result.map((task) => ({
        type: 'task' as const,
        id: task.id,
        data: task,
      }));
    },
    enabled: shouldSearch && types.includes('tasks'),
    staleTime: 30000,
  });

  const issuesQuery = useQuery({
    queryKey: ['entity-search-issues', trimmedSearch],
    queryFn: async () => {
      const result = await issuesApi.search(trimmedSearch, entityTypes.issues.limit);
      return result.map((issue) => ({
        type: 'issue' as const,
        id: issue.id,
        data: issue,
      }));
    },
    enabled: shouldSearch && types.includes('issues'),
    staleTime: 30000,
  });

  const projectsQuery = useQuery({
    queryKey: ['entity-search-projects', trimmedSearch],
    queryFn: async () => {
      const result = await projectsApi.search(trimmedSearch, entityTypes.projects.limit);
      return result.map((project) => ({
        type: 'project' as const,
        id: project.id,
        data: project,
      }));
    },
    enabled: shouldSearch && types.includes('projects'),
    staleTime: 30000,
  });

  const notesQuery = useQuery({
    queryKey: ['entity-search-notes', trimmedSearch],
    queryFn: async () => {
      const result = await notesApi.list({
        search: trimmedSearch,
      });
      return result.slice(0, entityTypes.notes.limit).map((note) => ({
        type: 'note' as const,
        id: note.id,
        data: note,
      }));
    },
    enabled: shouldSearch && types.includes('notes'),
    staleTime: 30000,
  });

  const filesQuery = useQuery({
    queryKey: ['entity-search-files', trimmedSearch],
    queryFn: async () => {
      const result = await topicsFilesApi.searchFiles({
        search: trimmedSearch,
        limit: entityTypes.files.limit,
        offset: 0,
      });
      return result.files.slice(0, entityTypes.files.limit).map((file) => ({
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
    enabled: shouldSearch && types.includes('files'),
    staleTime: 30000,
  });

  const allResults: CommandPaletteEntityResult[] = [
    ...(studentsQuery.data || []),
    ...(staffQuery.data || []),
    ...(parentsQuery.data || []),
    ...(classesQuery.data || []),
    ...(subjectsQuery.data || []),
    ...(tasksQuery.data || []),
    ...(issuesQuery.data || []),
    ...(projectsQuery.data || []),
    ...(topicsQuery.data || []),
    ...(filesQuery.data || []),
    ...(notesQuery.data || []),
  ];

  const isLoading = 
    studentsQuery.isLoading ||
    staffQuery.isLoading ||
    parentsQuery.isLoading ||
    classesQuery.isLoading ||
    subjectsQuery.isLoading ||
    tasksQuery.isLoading ||
    issuesQuery.isLoading ||
    projectsQuery.isLoading ||
    topicsQuery.isLoading ||
    filesQuery.isLoading ||
    notesQuery.isLoading;

  const hasError = 
    studentsQuery.isError ||
    staffQuery.isError ||
    parentsQuery.isError ||
    classesQuery.isError ||
    subjectsQuery.isError ||
    tasksQuery.isError ||
    issuesQuery.isError ||
    projectsQuery.isError ||
    topicsQuery.isError ||
    filesQuery.isError ||
    notesQuery.isError;

  return {
    results: allResults,
    isLoading,
    hasError,
  };
}
