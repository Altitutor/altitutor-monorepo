import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getInviteUrlForStudent } from '@/shared/utils/invites';

export interface RegistrationInviteStudent {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  invite_token: string | null;
}

export interface RegistrationInviteParent {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

export interface RegistrationInviteData {
  student: RegistrationInviteStudent | null;
  parents: RegistrationInviteParent[];
  token: string | null;
  inviteUrl: string | null;
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

async function fetchRegistrationInviteData(
  studentId: string
): Promise<RegistrationInviteData> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;

  const { data: studentData, error: studentError } = await supabase
    .from('students')
    .select('id, first_name, last_name, email, phone, invite_token')
    .eq('id', studentId)
    .single();

  if (studentError || !studentData) {
    return {
      student: null,
      parents: [],
      token: null,
      inviteUrl: null,
    };
  }

  const student: RegistrationInviteStudent = {
    id: studentData.id,
    first_name: studentData.first_name ?? '',
    last_name: studentData.last_name ?? '',
    email: studentData.email,
    phone: studentData.phone,
    invite_token: studentData.invite_token,
  };

  let token: string | null = null;
  let inviteUrl: string | null = null;
  if (student.invite_token) {
    token = student.invite_token;
    inviteUrl = getInviteUrlForStudent(token, 'register');
  }

  const { data: parentsData, error: parentsError } = await supabase
    .from('parents_students')
    .select('parent_id, parents(id, first_name, last_name, email, phone)')
    .eq('student_id', studentId);

  const parents: RegistrationInviteParent[] = [];
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

  return { student, parents, token, inviteUrl };
}

export const registrationInviteDataKeys = {
  all: ['registration-invite-data'] as const,
  detail: (studentId: string) =>
    [...registrationInviteDataKeys.all, studentId] as const,
};

/**
 * React Query hook for registration invite dialog data (student, parents, token, inviteUrl).
 * Replaces useEffect-based fetching in SendRegistrationInviteDialog.
 */
export function useRegistrationInviteData(
  studentId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: registrationInviteDataKeys.detail(studentId ?? ''),
    queryFn: () => fetchRegistrationInviteData(studentId!),
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60, // 1 minute
  });
}
