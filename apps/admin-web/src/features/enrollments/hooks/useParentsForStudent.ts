import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export interface ParentWithPhone {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
}

type ParentStudentRow = {
  parent_id: string;
  parents: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
};

async function fetchParentsForStudent(
  studentId: string
): Promise<ParentWithPhone[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('parents_students')
    .select('parent_id, parents(id, first_name, last_name, phone)')
    .eq('student_id', studentId);

  if (error) return [];

  const typed = (data ?? []) as ParentStudentRow[];
  return typed
    .map((ps) => ps.parents)
    .filter((p): p is NonNullable<typeof p> => p !== null && p.phone !== null)
    .map((p) => ({
      id: p.id,
      first_name: p.first_name ?? '',
      last_name: p.last_name ?? '',
      phone: p.phone,
    }));
}

export const parentsForStudentKeys = {
  all: ['parents-for-student'] as const,
  detail: (studentId: string) =>
    [...parentsForStudentKeys.all, studentId] as const,
};

/**
 * React Query hook for parents of a student (with phone for messaging).
 * Replaces useEffect-based fetching in enrollment step message screens.
 */
export function useParentsForStudent(studentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: parentsForStudentKeys.detail(studentId ?? ''),
    queryFn: () => fetchParentsForStudent(studentId!),
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60,
  });
}
