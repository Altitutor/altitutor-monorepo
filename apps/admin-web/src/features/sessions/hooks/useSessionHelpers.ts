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
  canReschedule: boolean;
  subject: Tables<'subjects'> | null;
  getFirstStudentIdForReschedule: () => string | null;
  getFirstStaffForLogging: () => string | undefined;
}

/**
 * Hook for computed values and helper functions related to sessions
 */
export function useSessionHelpers({
  session,
  sessionsStudents,
  sessionsStaff,
  tutorLog,
  firstClassStaffId,
}: UseSessionHelpersProps): UseSessionHelpersReturn {
  const hasTutorLog = useMemo(() => !!tutorLog, [tutorLog]);

  const isSessionInPast = useMemo(() => {
    return session?.start_at ? new Date(session.start_at) < new Date() : false;
  }, [session?.start_at]);

  const canReschedule = useMemo((): boolean => {
    // Cannot reschedule if session is already logged
    if (hasTutorLog) {
      return false;
    }
    
    // Cannot reschedule if any student has a paid invoice
    const hasPaidInvoice = Boolean(sessionsStudents?.some(
      (ss: SessionsStudentWithInvoice) => ss.invoice_status === 'paid' || ss.invoice_status === 'paid_refunded'
    ));
    
    if (hasPaidInvoice) {
      return false;
    }
    
    return !!(session?.type && ['DRAFTING', 'TRIAL_SESSION', 'SUBSIDY_INTERVIEW'].includes(session.type));
  }, [session?.type, hasTutorLog, sessionsStudents]);

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

  const getFirstStudentIdForReschedule = useMemo(() => {
    return () => {
      if (sessionsStudents && sessionsStudents.length > 0) {
        const firstStudent = sessionsStudents.find((ss) => ss.student_id && !ss.planned_absence);
        return firstStudent?.student_id || null;
      }
      return null;
    };
  }, [sessionsStudents]);

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
    canReschedule,
    subject,
    getFirstStudentIdForReschedule,
    getFirstStaffForLogging,
  };
}
