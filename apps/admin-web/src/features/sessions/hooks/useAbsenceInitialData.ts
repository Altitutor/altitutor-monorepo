import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { staffApi } from '@/features/staff/api/staff';
import type { StudentSession } from '../types/absence';
import type { StaffSession } from '../types/staff-absence';

/**
 * Query keys for absence initial data
 */
export const absenceInitialDataKeys = {
  missingStudentSession: (
    studentId: string,
    sessionId: string,
    futureSessionIds: string
  ) =>
    ['absence', 'missing-student-session', studentId, sessionId, futureSessionIds] as const,
  missingStaffSession: (
    staffId: string,
    sessionId: string,
    futureSessionIds: string
  ) =>
    ['absence', 'missing-staff-session', staffId, sessionId, futureSessionIds] as const,
  initialStudent: (studentId: string) =>
    ['absence', 'initial-student', studentId] as const,
  initialStaff: (staffId: string) =>
    ['absence', 'initial-staff', staffId] as const,
};

async function fetchMissingStudentSession(
  studentId: string,
  sessionId: string
): Promise<StudentSession | null> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('sessions_students')
    .select(
      `
      id,
      session_id,
      planned_absence,
      session:sessions!inner(
        *,
        class:classes(
          *,
          subject:subjects(*)
        )
      )
    `
    )
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error || !data?.session) return null;

  const session: StudentSession = {
    ...data.session,
    class: data.session.class || null,
    subject: data.session.class?.subject || null,
    sessionsStudentsId: data.id,
  };
  return session;
}

async function fetchMissingStaffSession(
  staffId: string,
  sessionId: string
): Promise<StaffSession | null> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('sessions_staff')
    .select(
      `
      id,
      session_id,
      planned_absence,
      session:sessions!inner(
        *,
        class:classes(
          *,
          subject:subjects(*)
        )
      )
    `
    )
    .eq('staff_id', staffId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error || !data?.session) return null;

  const session: StaffSession = {
    ...data.session,
    class: data.session.class || null,
    subject: data.session.class?.subject || null,
    sessionsStaffId: data.id,
  };
  return session;
}

/**
 * Fetches a student session when it's not in the futureSessions list.
 * Used when opening LogAbsenceDialog with initialSessionId that may be outside
 * the default date range.
 */
export function useMissingStudentSession(
  initialStudentId: string | undefined,
  initialSessionId: string | undefined,
  futureSessions: { id: string }[] | undefined,
  enabled: boolean
) {
  const futureIds = futureSessions?.map((s) => s.id).join(',') ?? '';
  const needsFetch =
    !!initialStudentId &&
    !!initialSessionId &&
    futureSessions !== undefined &&
    !futureSessions.some((s) => s.id === initialSessionId);

  return useQuery({
    queryKey: absenceInitialDataKeys.missingStudentSession(
      initialStudentId ?? '',
      initialSessionId ?? '',
      futureIds
    ),
    queryFn: () =>
      fetchMissingStudentSession(initialStudentId!, initialSessionId!),
    enabled: enabled && needsFetch,
    staleTime: 1000 * 60,
  });
}

/**
 * Fetches a staff session when it's not in the futureSessions list.
 * Used when opening LogStaffAbsenceDialog with initialSessionId that may be outside
 * the default date range.
 */
export function useMissingStaffSession(
  initialStaffId: string | undefined,
  initialSessionId: string | undefined,
  futureSessions: { id: string }[] | undefined,
  enabled: boolean
) {
  const futureIds = futureSessions?.map((s) => s.id).join(',') ?? '';
  const needsFetch =
    !!initialStaffId &&
    !!initialSessionId &&
    futureSessions !== undefined &&
    !futureSessions.some((s) => s.id === initialSessionId);

  return useQuery({
    queryKey: absenceInitialDataKeys.missingStaffSession(
      initialStaffId ?? '',
      initialSessionId ?? '',
      futureIds
    ),
    queryFn: () =>
      fetchMissingStaffSession(initialStaffId!, initialSessionId!),
    enabled: enabled && needsFetch,
    staleTime: 1000 * 60,
  });
}

/**
 * Fetches a student by ID for pre-filling LogAbsenceDialog.
 */
export function useInitialStudentForAbsence(
  initialStudentId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: absenceInitialDataKeys.initialStudent(initialStudentId ?? ''),
    queryFn: async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', initialStudentId!)
        .single();
      if (error || !data) return null;
      return data as Tables<'students'>;
    },
    enabled: enabled && !!initialStudentId,
    staleTime: 1000 * 60,
  });
}

/**
 * Fetches a staff member by ID for pre-filling LogStaffAbsenceDialog.
 */
export function useInitialStaffForAbsence(
  initialStaffId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: absenceInitialDataKeys.initialStaff(initialStaffId ?? ''),
    queryFn: () => staffApi.getById(initialStaffId!),
    enabled: enabled && !!initialStaffId,
    staleTime: 1000 * 60,
  });
}
