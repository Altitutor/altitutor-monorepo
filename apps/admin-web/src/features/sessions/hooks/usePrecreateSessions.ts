import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { sessionsKeys } from './useSessionsQuery';

type PrecreateArgs = {
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  created_by?: string; // staff.id (optional; server can infer)
  class_id?: string | null;
};

export function usePrecreateSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ start_date, end_date, created_by, class_id }: PrecreateArgs) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('precreate_sessions', {
        start_date,
        end_date,
        p_created_by: created_by || undefined, // Pass undefined if not provided
        p_class_id: class_id || undefined, // Pass undefined if not provided
      });
      if (error) throw error;
      return data as number | null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionsKeys.all });
    },
  });
}


