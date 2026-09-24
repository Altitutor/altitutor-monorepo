import { useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
import {
  CHECK_IN_HOST,
  CHECK_IN_RECEIVER,
} from '@altitutor/shared/pay-tiers';
import { useSessionWithDetails } from '@/features/sessions/hooks/useSessionsQuery';

type StaffMember = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  type?: string | null;
};

function isValidStaffType(
  type: string | null | undefined
): type is
  | 'MAIN_TUTOR'
  | 'SECONDARY_TUTOR'
  | 'TRIAL_TUTOR'
  | 'CHECK_IN_HOST'
  | 'CHECK_IN_RECEIVER' {
  return (
    type === 'MAIN_TUTOR' ||
    type === 'SECONDARY_TUTOR' ||
    type === 'TRIAL_TUTOR' ||
    type === CHECK_IN_HOST ||
    type === CHECK_IN_RECEIVER
  );
}

export type SessionStaffRow = Tables<'sessions_staff'> & { staff: Tables<'staff'> };

export type TutorLogStep2Data = {
  sessionStaff: SessionStaffRow[];
  sessionType: string | null;
  hasStudentsOrParents: boolean;
  isLoading: boolean;
};

export function useTutorLogStep2Data(sessionId: string): TutorLogStep2Data {
  const { data, isLoading } = useSessionWithDetails(sessionId);

  const sessionType =
    data && typeof data === 'object' && 'session_type' in data
      ? ((data as { session_type?: string | null }).session_type ?? null)
      : null;

  const hasStudentsOrParents = useMemo(() => {
    if (!data) return false;
    const students = Array.isArray(data.students) ? data.students : [];
    const parents =
      'parents' in data && Array.isArray((data as { parents?: unknown }).parents)
        ? ((data as { parents: unknown[] }).parents ?? [])
        : [];
    return students.length > 0 || parents.length > 0;
  }, [data]);

  const sessionStaff = useMemo(() => {
    if (!data?.staff || !Array.isArray(data.staff)) return [];

    const staffArray = data.staff as StaffMember[];
    return staffArray.map((staffMember) => ({
      id: '',
      session_id: sessionId,
      staff_id: staffMember.id,
      created_at: new Date().toISOString(),
      created_by: null,
      is_swapped: false,
      planned_absence: false,
      planned_absence_logged_at: null,
      planned_absence_logged_by: null,
      swapped_at: null,
      swapped_sessions_staff_id: null,
      type: isValidStaffType(staffMember.type)
        ? staffMember.type
        : sessionType === 'CHECK_IN'
          ? CHECK_IN_HOST
          : ('SECONDARY_TUTOR' as const),
      updated_at: new Date().toISOString(),
      staff: {
        id: staffMember.id,
        first_name: staffMember.first_name || '',
        last_name: staffMember.last_name || '',
        role: staffMember.role || '',
        status: 'ACTIVE',
        availability_monday: null,
        availability_tuesday: null,
        availability_wednesday: null,
        availability_thursday: null,
        availability_friday: null,
        availability_saturday_am: null,
        availability_saturday_pm: null,
        availability_sunday_am: null,
        availability_sunday_pm: null,
        drafting_availability: null,
        trial_session_availability: null,
        subsidy_interview_availability: null,
        created_at: null,
        updated_at: null,
        email: null,
        phone_number: null,
        notes: null,
        office_key_number: null,
        has_parking_remote: null,
        invite_token: null,
        user_id: null,
      },
    })) as SessionStaffRow[];
  }, [data?.staff, sessionId, sessionType]);

  return { sessionStaff, sessionType, hasStudentsOrParents, isLoading };
}
