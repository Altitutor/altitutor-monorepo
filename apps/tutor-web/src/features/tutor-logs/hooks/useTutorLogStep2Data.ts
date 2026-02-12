import { useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
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
): type is 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' {
  return (
    type === 'MAIN_TUTOR' ||
    type === 'SECONDARY_TUTOR' ||
    type === 'TRIAL_TUTOR'
  );
}

export type SessionStaffRow = Tables<'sessions_staff'> & { staff: Tables<'staff'> };

export type TutorLogStep2Data = {
  sessionStaff: SessionStaffRow[];
  isLoading: boolean;
};

export function useTutorLogStep2Data(sessionId: string): TutorLogStep2Data {
  const { data, isLoading } = useSessionWithDetails(sessionId);

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
  }, [data?.staff, sessionId]);

  return { sessionStaff, isLoading };
}
