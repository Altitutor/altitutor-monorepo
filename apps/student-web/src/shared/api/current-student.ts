import { getSupabaseClient } from '@/shared/lib/supabase/client';

export const currentStudentApi = {
  getId: async (): Promise<string | null> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('current_student_id');
    if (error) throw error;
    return data ?? null;
  },
};
