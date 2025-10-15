import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

// Import all the query keys and APIs
import { studentsKeys } from '@/features/students/hooks/useStudentsQuery';
import { classesKeys } from '@/features/classes/hooks/useClassesQuery';
import { staffKeys } from '@/features/staff/hooks/useStaffQuery';
import { subjectsKeys } from '@/features/subjects/hooks/useSubjectsQuery';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';
import { topicsKeys } from '@/features/topics/hooks/useTopicsQuery';

import { studentsApi } from '@/features/students/api/students';
import { classesApi } from '@/features/classes/api/classes';
import { staffApi } from '@/features/staff/api/staff';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { topicsApi } from '@/features/topics/api/topics';

/**
 * Hook for prefetching data to improve perceived performance
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  // Prefetch all main lists - useful for dashboard or navigation
  const prefetchAllLists = useCallback(async () => {
    const prefetchPromises = [
      queryClient.prefetchQuery({
        queryKey: studentsKeys.withDetails(),
        queryFn: studentsApi.getAllStudentsWithDetails,
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: classesKeys.withDetails(),
        queryFn: classesApi.getAllClassesWithDetails,
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: staffKeys.withSubjects(),
        queryFn: staffApi.getAllStaffWithSubjects,
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: subjectsKeys.lists(),
        queryFn: subjectsApi.getAllSubjects,
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: sessionsKeys.withDetails(),
        queryFn: sessionsApi.getAllSessionsWithDetails,
        staleTime: 1000 * 60 * 1,
      }),
      queryClient.prefetchQuery({
        queryKey: topicsKeys.withSubjects(),
        queryFn: topicsApi.getTopicsWithSubjects,
        staleTime: 1000 * 60 * 5,
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  }, [queryClient]);

  // Prefetch student-related data
  const prefetchStudentData = useCallback(async (studentId: string) => {
    const prefetchPromises = [
      queryClient.prefetchQuery({
        queryKey: studentsKeys.detail(studentId),
        queryFn: () => studentsApi.getStudentWithSubjects(studentId),
        staleTime: 1000 * 60 * 2,
      }),
      queryClient.prefetchQuery({
        queryKey: sessionsKeys.forStudent(studentId),
        queryFn: () => sessionsApi.getSessionsForStudent(studentId),
        staleTime: 1000 * 60 * 2,
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  }, [queryClient]);

  // Prefetch class-related data
  const prefetchClassData = useCallback(async (classId: string) => {
    const prefetchPromises = [
      queryClient.prefetchQuery({
        queryKey: classesKeys.detail(classId),
        queryFn: () => classesApi.getClassWithDetails(classId),
        staleTime: 1000 * 60 * 2,
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  }, [queryClient]);

  // Prefetch staff-related data
  const prefetchStaffData = useCallback(async (staffId: string) => {
    const prefetchPromises = [
      queryClient.prefetchQuery({
        queryKey: staffKeys.detail(staffId),
        queryFn: () => staffApi.getStaffWithSubjects(staffId),
        staleTime: 1000 * 60 * 2,
      }),
      queryClient.prefetchQuery({
        queryKey: sessionsKeys.forStaff(staffId),
        queryFn: () => sessionsApi.getSessionsForStaff(staffId),
        staleTime: 1000 * 60 * 2,
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  }, [queryClient]);

  // Prefetch subject-related data
  const prefetchSubjectData = useCallback(async (subjectId: string) => {
    const prefetchPromises = [
      queryClient.prefetchQuery({
        queryKey: subjectsKeys.detail(subjectId),
        queryFn: () => subjectsApi.getSubject(subjectId),
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: subjectsKeys.staff(subjectId),
        queryFn: () => subjectsApi.getSubjectStaff(subjectId),
        staleTime: 1000 * 60 * 2,
      }),
      queryClient.prefetchQuery({
        queryKey: subjectsKeys.students(subjectId),
        queryFn: () => subjectsApi.getSubjectStudents(subjectId),
        staleTime: 1000 * 60 * 2,
      }),
      queryClient.prefetchQuery({
        queryKey: subjectsKeys.classes(subjectId),
        queryFn: () => subjectsApi.getSubjectClasses(subjectId),
        staleTime: 1000 * 60 * 2,
      }),
      queryClient.prefetchQuery({
        queryKey: topicsKeys.bySubject(subjectId),
        queryFn: () => topicsApi.getTopicsBySubject(subjectId),
        staleTime: 1000 * 60 * 3,
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  }, [queryClient]);

  // Prefetch session-related data
  const prefetchSessionData = useCallback(async (sessionId: string) => {
    const prefetchPromises = [
      queryClient.prefetchQuery({
        queryKey: sessionsKeys.detail(sessionId),
        queryFn: () => sessionsApi.getSessionWithDetails(sessionId),
        staleTime: 1000 * 60 * 1,
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  }, [queryClient]);

  // Prefetch topic-related data
  const prefetchTopicData = useCallback(async (topicId: string) => {
    const prefetchPromises = [
      queryClient.prefetchQuery({
        queryKey: topicsKeys.detail(topicId),
        queryFn: () => topicsApi.getTopic(topicId),
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: topicsKeys.subtopics.byTopic(topicId),
        queryFn: () => topicsApi.getSubtopicsByTopic(topicId),
        staleTime: 1000 * 60 * 3,
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  }, [queryClient]);

  // Prefetch dashboard data - the most commonly accessed data
  const prefetchDashboardData = useCallback(async () => {
    const prefetchPromises = [
      // Core lists with details for dashboard overview
      queryClient.prefetchQuery({
        queryKey: studentsKeys.withDetails(),
        queryFn: studentsApi.getAllStudentsWithDetails,
        staleTime: 1000 * 60 * 3,
      }),
      queryClient.prefetchQuery({
        queryKey: classesKeys.withDetails(),
        queryFn: classesApi.getAllClassesWithDetails,
        staleTime: 1000 * 60 * 3,
      }),
      queryClient.prefetchQuery({
        queryKey: sessionsKeys.withDetails(),
        queryFn: sessionsApi.getAllSessionsWithDetails,
        staleTime: 1000 * 60 * 1,
      }),
      // Basic lists for quick access
      queryClient.prefetchQuery({
        queryKey: staffKeys.lists(),
        queryFn: staffApi.getAllStaff,
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: subjectsKeys.lists(),
        queryFn: subjectsApi.getAllSubjects,
        staleTime: 1000 * 60 * 5,
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  }, [queryClient]);

  // Prefetch on hover - useful for table rows or navigation items
  const prefetchOnHover = useCallback((type: 'student' | 'class' | 'staff' | 'subject' | 'session' | 'topic', id: string) => {
    switch (type) {
      case 'student':
        prefetchStudentData(id);
        break;
      case 'class':
        prefetchClassData(id);
        break;
      case 'staff':
        prefetchStaffData(id);
        break;
      case 'subject':
        prefetchSubjectData(id);
        break;
      case 'session':
        prefetchSessionData(id);
        break;
      case 'topic':
        prefetchTopicData(id);
        break;
    }
  }, [prefetchStudentData, prefetchClassData, prefetchStaffData, prefetchSubjectData, prefetchSessionData, prefetchTopicData]);

  return {
    prefetchAllLists,
    prefetchDashboardData,
    prefetchStudentData,
    prefetchClassData,
    prefetchStaffData,
    prefetchSubjectData,
    prefetchSessionData,
    prefetchTopicData,
    prefetchOnHover,
  };
} 