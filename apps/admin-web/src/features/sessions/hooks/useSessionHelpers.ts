import { useMemo } from 'react';
import type { Tables } from '@altitutor/shared';

type SessionWithSubject = Tables<'sessions'> & { subject?: Tables<'subjects'> | null; class?: { subject?: Tables<'subjects'> | null } | null };
/** Minimal shape for session student - supports both full rows and UnplannedStudent */
type SessionsStudentWithInvoice = { student_id?: string; planned_absence?: boolean; invoice_status?: string | null };
type SessionsStaffRow = Tables<'sessions_staff'>;

interface UseSessionHelpersProps {
  session: SessionWithSubject | null | undefined;
  sessionsStudents: SessionsStudentWithInvoice[];
  sessionsStaff: SessionsStaffRow[];
  tutorLog: Tables<'tutor_logs'> | null | undefined;
  firstClassStaffId: string | null | undefined;
}

interface UseSessionHelpersReturn {
  hasTutorLog: boolean;
  isSessionInPast: boolean;
  subject: Tables<'subjects'> | null;
  getFirstStaffForLogging: () => string | undefined;
}

/**
 * Hook for computed values and helper functions related to sessions
 */
export function useSessionHelpers({
  session,
  sessionsStudents: _sessionsStudents,
  sessionsStaff,
  tutorLog,
  firstClassStaffId,
}: UseSessionHelpersProps): UseSessionHelpersReturn {
  const hasTutorLog = useMemo(() => !!tutorLog, [tutorLog]);

  const isSessionInPast = useMemo(() => {
    return session?.start_at ? new Date(session.start_at) < new Date() : false;
  }, [session?.start_at]);

  const subject = useMemo(() => {
    // Check nested subject object first (if session data includes it)
    if (session?.subject) return session.subject;
    // Check class.subject
    if (session?.class?.subject) {
      return session.class.subject;
    }
    // If we only have subject_id, we can't return the full subject object here
    // The caller should handle subject_id separately if needed
    return null;
  }, [session]);

  const getFirstStaffForLogging = useMemo(() => {
    return () => {
      // If session has staff assigned, use the first one
      if (sessionsStaff && sessionsStaff.length > 0 && sessionsStaff[0].staff_id) {
        return sessionsStaff[0].staff_id;
      }
      // Otherwise use the first class staff member (if fetched)
      return firstClassStaffId || undefined;
    };
  }, [sessionsStaff, firstClassStaffId]);

  return {
    hasTutorLog,
    isSessionInPast,
    subject,
    getFirstStaffForLogging,
  };
}
