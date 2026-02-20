import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export interface BookingConfirmationParent {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

export interface BookingConfirmationSession {
  id: string;
  start_at: string | null;
  end_at: string | null;
}

export interface BookingConfirmationData {
  student: Tables<'students'> | null;
  parents: BookingConfirmationParent[];
  session: BookingConfirmationSession | null;
}

type ParentStudentRow = {
  parent_id: string;
  parents: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

async function fetchBookingConfirmationData(
  studentId: string,
  sessionId: string | undefined
): Promise<BookingConfirmationData> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;

  const [studentResult, parentsResult, sessionResult] = await Promise.all([
    supabase.from('students').select('*').eq('id', studentId).single(),
    supabase.from('parents_students').select('parent_id, parents(id, first_name, last_name, email, phone)').eq('student_id', studentId),
    sessionId
      ? supabase.from('sessions').select('id, start_at, end_at').eq('id', sessionId).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const { data: studentData, error: studentError } = studentResult;
  if (studentError || !studentData) {
    return { student: null, parents: [], session: null };
  }

  const parents: BookingConfirmationParent[] = [];
  const { data: parentsData, error: parentsError } = parentsResult;
  if (!parentsError && parentsData) {
    const typed = parentsData as ParentStudentRow[];
    typed.forEach((ps) => {
      if (ps.parents) {
        parents.push({
          id: ps.parents.id,
          first_name: ps.parents.first_name ?? '',
          last_name: ps.parents.last_name ?? '',
          email: ps.parents.email,
          phone: ps.parents.phone,
        });
      }
    });
  }

  const session: BookingConfirmationSession | null =
    sessionResult.data && !sessionResult.error
      ? {
          id: sessionResult.data.id,
          start_at: sessionResult.data.start_at,
          end_at: sessionResult.data.end_at,
        }
      : null;

  return { student: studentData as Tables<'students'>, parents, session };
}

export const bookingConfirmationDataKeys = {
  all: ['booking-confirmation-data'] as const,
  detail: (studentId: string, sessionId?: string) =>
    [...bookingConfirmationDataKeys.all, studentId, sessionId ?? ''] as const,
};

/**
 * React Query hook for booking confirmation dialog data (student, parents, session).
 * Replaces useEffect-based fetching in SendBookingConfirmationDialog.
 */
export function useBookingConfirmationData(
  studentId: string | undefined,
  sessionId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: bookingConfirmationDataKeys.detail(studentId ?? '', sessionId),
    queryFn: () => fetchBookingConfirmationData(studentId!, sessionId),
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60, // 1 minute
  });
}
