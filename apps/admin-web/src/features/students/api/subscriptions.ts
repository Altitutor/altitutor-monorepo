import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export const studentSubscriptionsKeys = {
  all: ['student-subscriptions'] as const,
  student: (studentId: string) => [...studentSubscriptionsKeys.all, studentId] as const,
};

export type StudentSubscriptionWithSubject = Tables<'student_subscriptions'> & {
  subject: Pick<Tables<'subjects'>, 'id' | 'name' | 'short_name' | 'long_name'> | null;
};

export async function fetchStudentSubscriptions(
  studentId: string
): Promise<StudentSubscriptionWithSubject[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('student_subscriptions')
    .select(
      `
      *,
      subject:subjects(id, name, short_name, long_name)
    `
    )
    .eq('student_id', studentId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []) as unknown as StudentSubscriptionWithSubject[];
}
