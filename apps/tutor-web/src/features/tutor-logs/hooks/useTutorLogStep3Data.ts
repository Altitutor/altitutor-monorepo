import { useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
import { useQuery } from '@tanstack/react-query';
import { tutorViewsApi } from '../api/tutor-views';

export const tutorLogStep3Keys = {
  sessionStudents: (sessionId: string) =>
    ['tutor-log-step3', 'session-students', sessionId] as const,
  allStudents: () => ['tutor-log-step3', 'all-students'] as const,
};

export type SessionStudentWithDetails = {
  student_id: string;
  planned_absence: boolean;
  student: Tables<'students'>;
};

export type TutorLogStep3Data = {
  sessionStudents: SessionStudentWithDetails[];
  allStudents: Tables<'students'>[];
  isLoading: boolean;
};

export function useTutorLogStep3Data(sessionId: string): TutorLogStep3Data {
  const { data: ssData = [], isLoading: isLoadingSs } = useQuery({
    queryKey: tutorLogStep3Keys.sessionStudents(sessionId),
    queryFn: () => tutorViewsApi.getSessionStudents(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  const { data: allStudentsRaw = [], isLoading: isLoadingAll } = useQuery({
    queryKey: tutorLogStep3Keys.allStudents(),
    queryFn: () => tutorViewsApi.getAllStudents(),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  const sessionStudents = useMemo(() => {
    const allStudents = allStudentsRaw as Tables<'students'>[];
    return ssData.map((ss) => {
      const student = allStudents.find((s) => s.id === ss.student_id);
      return {
        student_id: ss.student_id,
        planned_absence: ss.planned_absence,
        student:
          student ||
          ({
            id: ss.student_id,
            first_name: '',
            last_name: '',
            year_level: null,
          } as Tables<'students'>),
      };
    });
  }, [ssData, allStudentsRaw]);

  return {
    sessionStudents,
    allStudents: allStudentsRaw as Tables<'students'>[],
    isLoading: isLoadingSs || isLoadingAll,
  };
}
