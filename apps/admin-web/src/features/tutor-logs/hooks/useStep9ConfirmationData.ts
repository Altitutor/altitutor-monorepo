import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { TutorLogFormData } from '../types';

export type TopicFileWithFile = Tables<'topics_files'> & {
  file: Tables<'files'>;
};

export interface Step9ConfirmationData {
  session: {
    id: string;
    start_at: string;
    end_at: string;
    type: string;
    class?: {
      id: string;
      subject?: Tables<'subjects'>;
    } | null;
    subject?: Tables<'subjects'>;
    subject_id?: string | null;
  } | null;
  studentsMap: Map<string, Tables<'students'>>;
  staffMap: Map<string, Tables<'staff'>>;
  topicsMap: Map<string, Tables<'topics'> & { subjects?: Tables<'subjects'> }>;
  allTopics: Tables<'topics'>[];
  topicFilesMap: Map<string, TopicFileWithFile>;
  subjectsMap: Map<string, Tables<'subjects'>>;
  /** sessions_students.planned_absence keyed by student_id */
  studentPlannedMap: Map<string, boolean>;
  /** sessions_staff.planned_absence keyed by staff_id */
  staffPlannedMap: Map<string, boolean>;
  parentsMap: Map<string, Tables<'parents'>>;
}

async function fetchStep9ConfirmationData(
  sessionId: string,
  formData: Partial<TutorLogFormData>
): Promise<Step9ConfirmationData> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const studentsMap = new Map<string, Tables<'students'>>();
  const staffMap = new Map<string, Tables<'staff'>>();
  const topicsMap = new Map<string, Tables<'topics'> & { subjects?: Tables<'subjects'> }>();
  const topicFilesMap = new Map<string, TopicFileWithFile>();
  const subjectsMap = new Map<string, Tables<'subjects'>>();
  const studentPlannedMap = new Map<string, boolean>();
  const staffPlannedMap = new Map<string, boolean>();
  const parentsMap = new Map<string, Tables<'parents'>>();

  const { data: sessionData } = await supabase
    .from('sessions')
    .select('*, class:classes(*, subject:subjects(*)), subject:subjects(*)')
    .eq('id', sessionId)
    .single();

  let allTopics: Tables<'topics'>[] = [];

  const { data: ssPlanned } = await supabase
    .from('sessions_students')
    .select('student_id, planned_absence')
    .eq('session_id', sessionId);
  (ssPlanned || []).forEach((row) => {
    studentPlannedMap.set(row.student_id, !!row.planned_absence);
  });

  const { data: sfPlanned } = await supabase
    .from('sessions_staff')
    .select('staff_id, planned_absence')
    .eq('session_id', sessionId);
  (sfPlanned || []).forEach((row) => {
    staffPlannedMap.set(row.staff_id, !!row.planned_absence);
  });

  const parentIds = [...new Set((formData.parentAttendance || []).map((p) => p.parentId))];
  if (parentIds.length > 0) {
    const { data: parents } = await supabase.from('parents').select('*').in('id', parentIds);
    (parents || []).forEach((p) => parentsMap.set(p.id, p as Tables<'parents'>));
  }

  const studentIdsList = (formData.studentAttendance || []).map((sa) => sa.studentId);
  if (studentIdsList.length > 0) {
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .in('id', studentIdsList);
    (students || []).forEach((s) => studentsMap.set(s.id, s as Tables<'students'>));
  }

  const staffIds = (formData.staffAttendance || []).map((sa) => sa.staffId);
  if (staffIds.length > 0) {
    const { data: staff } = await supabase
      .from('staff')
      .select('*')
      .in('id', staffIds);
    (staff || []).forEach((s) => staffMap.set(s.id, s as Tables<'staff'>));
  }

  const topicIds = (formData.topics || []).map((t) => t.topicId);
  if (topicIds.length > 0) {
    const { data: topicsWithSubjects } = await supabase
      .from('topics')
      .select('*, subjects:subjects(*)')
      .in('id', topicIds);

    if (topicsWithSubjects) {
      topicsWithSubjects.forEach((t) => {
        topicsMap.set(t.id, t as Tables<'topics'> & { subjects?: Tables<'subjects'> });
        if (t.subjects && t.subject_id) {
          subjectsMap.set(t.subject_id, t.subjects as Tables<'subjects'>);
        }
      });

      const subjectId =
        sessionData?.class?.subject?.id ||
        sessionData?.subject?.id ||
        (sessionData as { subject_id?: string })?.subject_id;
      if (subjectId) {
        const { data: allTopicsData } = await supabase
          .from('topics')
          .select('*')
          .eq('subject_id', subjectId)
          .order('index', { ascending: true });
        allTopics = allTopicsData || [];
      }
    }
  }

  const topicFileIds = (formData.topicFiles || []).map((tf) => tf.topicsFilesId);
  if (topicFileIds.length > 0) {
    const { data: files } = await supabase
      .from('topics_files')
      .select('*, file:files(*)')
      .in('id', topicFileIds);
    (files || []).forEach((f) =>
      topicFilesMap.set(f.id, f as TopicFileWithFile)
    );
  }

  return {
    session: sessionData as Step9ConfirmationData['session'],
    studentsMap,
    staffMap,
    topicsMap,
    allTopics,
    topicFilesMap,
    subjectsMap,
    studentPlannedMap,
    staffPlannedMap,
    parentsMap,
  };
}

export const step9ConfirmationDataKeys = {
  all: ['step9-confirmation-data'] as const,
  detail: (
    sessionId: string,
    studentIds: string,
    staffIds: string,
    topicIds: string,
    topicFileIds: string,
    parentIds: string
  ) =>
    [
      ...step9ConfirmationDataKeys.all,
      sessionId,
      studentIds,
      staffIds,
      topicIds,
      topicFileIds,
      parentIds,
    ] as const,
};

/**
 * React Query hook for Step9Confirmation data (session, students, staff, topics, files).
 * Replaces useEffect-based fetching in Step9Confirmation.
 */
export function useStep9ConfirmationData(
  sessionId: string | undefined,
  formData: Partial<TutorLogFormData>,
  enabled: boolean
) {
  const studentIds = (formData.studentAttendance || [])
    .map((sa) => sa.studentId)
    .sort()
    .join(',');
  const staffIds = (formData.staffAttendance || [])
    .map((sa) => sa.staffId)
    .sort()
    .join(',');
  const topicIds = (formData.topics || []).map((t) => t.topicId).sort().join(',');
  const topicFileIds = (formData.topicFiles || [])
    .map((tf) => tf.topicsFilesId)
    .sort()
    .join(',');
  const parentIdsKey = (formData.parentAttendance || [])
    .map((p) => p.parentId)
    .sort()
    .join(',');

  return useQuery({
    queryKey: step9ConfirmationDataKeys.detail(
      sessionId ?? '',
      studentIds,
      staffIds,
      topicIds,
      topicFileIds,
      parentIdsKey
    ),
    queryFn: () => fetchStep9ConfirmationData(sessionId!, formData),
    enabled: enabled && !!sessionId,
    staleTime: 1000 * 60,
  });
}
