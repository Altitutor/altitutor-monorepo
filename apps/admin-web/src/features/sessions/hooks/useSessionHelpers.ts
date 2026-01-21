import { useMemo } from 'react';
import type { Tables } from '@altitutor/shared';

interface UseSessionHelpersProps {
  session: any;
  sessionsStudents: any[];
  sessionsStaff: any[];
  tutorLog: any;
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

  const canReschedule = useMemo(() => {
    // Cannot reschedule if session is already logged
    if (hasTutorLog) {
      return false;
    }
    
    // Cannot reschedule if any student has a paid invoice
    const hasPaidInvoice = sessionsStudents?.some(
      (ss: any) => ss.invoice_status === 'paid'
    ) || false;
    
    if (hasPaidInvoice) {
      return false;
    }
    
    return session?.type && ['DRAFTING', 'TRIAL_SESSION', 'SUBSIDY_INTERVIEW'].includes(session.type);
  }, [session?.type, hasTutorLog, sessionsStudents]);

  const subject = useMemo(() => {
    // Check nested subject object first (if session data includes it)
    if ((session as any)?.subject) {
      return (session as any).subject;
    }
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
        const firstStudent = sessionsStudents.find((ss: any) => ss.student_id && !ss.planned_absence);
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
