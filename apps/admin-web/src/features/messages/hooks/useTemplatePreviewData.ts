import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import { getStudentClasses } from '../api/bulk';
import { getSampleStudents } from '../utils/templateHelpers';
import { messagesKeys } from '../api/queryKeys';

export const templatePreviewKeys = {
  sampleStudents: () => ['template-preview', 'sample-students'] as const,
};

/**
 * React Query hook for sample students in template preview.
 * Replaces useEffect-based loading in CreateEditTemplateDialog.
 */
export function useSampleStudents(enabled: boolean) {
  return useQuery({
    queryKey: templatePreviewKeys.sampleStudents(),
    queryFn: getSampleStudents,
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * React Query hook for student classes in template preview.
 * Replaces useEffect-based loadStudentClasses in CreateEditTemplateDialog.
 */
export function useStudentClassesForTemplate(studentId: string | null) {
  return useQuery({
    queryKey: messagesKeys.studentClasses(studentId ?? ''),
    queryFn: () => getStudentClasses(studentId!),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
