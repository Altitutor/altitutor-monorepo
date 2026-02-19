import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getInviteUrlForStudent } from '@/shared/utils/invites';

export interface StudentInviteParent {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

export interface StudentInviteData {
  token: string | null;
  inviteUrl: string | null;
  parents: StudentInviteParent[];
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

async function fetchStudentInviteData(
  studentId: string,
  linkType: 'invite' | 'registration'
): Promise<StudentInviteData> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const path = linkType === 'invite' ? 'invite' : 'register';

  const { data: studentData, error: studentError } = await supabase
    .from('students')
    .select('invite_token')
    .eq('id', studentId)
    .single();

  let token: string | null = null;
  let inviteUrl: string | null = null;

  if (!studentError && studentData?.invite_token) {
    token = studentData.invite_token;
    inviteUrl = getInviteUrlForStudent(token, path);
  }

  const { data: parentsData, error: parentsError } = await supabase
    .from('parents_students')
    .select('parent_id, parents(id, first_name, last_name, email, phone)')
    .eq('student_id', studentId);

  const parents: StudentInviteParent[] = [];
  if (!parentsError && parentsData) {
    const typed = parentsData as ParentStudentRow[];
    typed.forEach((ps) => {
      if (ps.parents) {
        parents.push({
          id: ps.parents.id,
          first_name: ps.parents.first_name || '',
          last_name: ps.parents.last_name || '',
          email: ps.parents.email,
          phone: ps.parents.phone,
        });
      }
    });
  }

  return { token, inviteUrl, parents };
}

export const studentInviteDataKeys = {
  all: ['student-invite-data'] as const,
  detail: (studentId: string, linkType: string) =>
    [...studentInviteDataKeys.all, studentId, linkType] as const,
};

/**
 * React Query hook for student invite data (token, inviteUrl, parents).
 * Replaces useEffect-based fetching in SendStudentInviteDialog.
 */
export function useStudentInviteData(
  studentId: string | undefined,
  linkType: 'invite' | 'registration',
  enabled: boolean
) {
  return useQuery({
    queryKey: studentInviteDataKeys.detail(studentId ?? '', linkType),
    queryFn: () => fetchStudentInviteData(studentId!, linkType),
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60, // 1 minute
  });
}
