import { useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
import type { TutorLogFormData } from '../types';
import { useSessionWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { useTopics } from '@/features/topics/hooks/useTopicsQuery';
import { useTopicFilesByIds } from '@/features/topics/hooks/useTopicsFilesQuery';
import { useTutorLogStudents } from './useTutorLogStudents';

export type SessionDisplay = {
  id: string;
  start_at: string | null;
  end_at: string | null;
  class: {
    subject: {
      name: string | null;
    };
  };
};

export type TutorLogStep9Data = {
  session: SessionDisplay | null;
  studentsMap: Map<string, Tables<'students'>>;
  staffMap: Map<string, Tables<'staff'>>;
  topicsMap: Map<string, Tables<'topics'>>;
  topicFilesMap: Map<string, Tables<'topics_files'>>;
  isLoading: boolean;
};

type StaffRecord = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
};

export function useTutorLogStep9Data(
  formData: Partial<TutorLogFormData>
): TutorLogStep9Data {
  const sessionId = formData.sessionId ?? '';
  const studentIds = (formData.studentAttendance || []).map((sa) => sa.studentId);
  const topicIds = (formData.topics || []).map((t) => t.topicId);
  const topicFileIds = (formData.topicFiles || []).map((tf) => tf.topicsFilesId);

  const { data: sessionDetail, isLoading: isLoadingSession } =
    useSessionWithDetails(sessionId);
  const { data: studentsRaw = [], isLoading: isLoadingStudents } =
    useTutorLogStudents(studentIds);
  const { data: topicsRaw = [], isLoading: isLoadingTopics } = useTopics();
  const { data: topicFilesRaw = [], isLoading: isLoadingFiles } =
    useTopicFilesByIds(topicFileIds);

  return useMemo(() => {
    const isLoading =
      (!!sessionId && isLoadingSession) ||
      (studentIds.length > 0 && isLoadingStudents) ||
      isLoadingTopics ||
      (topicFileIds.length > 0 && isLoadingFiles);

    const session: SessionDisplay | null =
      sessionDetail?.session_id
        ? {
            id: sessionDetail.session_id,
            start_at: sessionDetail.start_at ?? null,
            end_at: sessionDetail.end_at ?? null,
            class: {
              subject: {
                name: sessionDetail.subject_name ?? null,
              },
            },
          }
        : null;

    const studentsMap = new Map<string, Tables<'students'>>();
    (studentsRaw || [])
      .filter((s): s is Tables<'students'> & { id: string } => s?.id != null)
      .forEach((s) => studentsMap.set(s.id, s));

    const staffMap = new Map<string, Tables<'staff'>>();
    const staffArray = Array.isArray(sessionDetail?.staff)
      ? (sessionDetail!.staff as StaffRecord[])
      : [];
    staffArray
      .filter((s): s is StaffRecord & { id: string } => s?.id != null)
      .forEach((s) => staffMap.set(s.id, s as unknown as Tables<'staff'>));

    const validTopics = (topicsRaw || []).filter(
      (t): t is Tables<'topics'> =>
        t?.id != null && t?.name != null && t?.subject_id != null && t?.index != null
    );
    const topicsMap = new Map(
      validTopics.filter((t) => topicIds.includes(t.id)).map((t) => [t.id, t])
    );

    const validFiles = (topicFilesRaw || []).filter(
      (f): f is Tables<'topics_files'> =>
        f?.id != null && f?.code != null
    );
    const topicFilesMap = new Map(validFiles.map((f) => [f.id, f]));

    return {
      session,
      studentsMap,
      staffMap,
      topicsMap,
      topicFilesMap,
      isLoading,
    };
  }, [
    sessionDetail,
    studentsRaw,
    topicsRaw,
    topicFilesRaw,
    sessionId,
    topicIds,
    isLoadingSession,
    isLoadingStudents,
    isLoadingTopics,
    isLoadingFiles,
    studentIds.length,
    topicFileIds.length,
  ]);
}
