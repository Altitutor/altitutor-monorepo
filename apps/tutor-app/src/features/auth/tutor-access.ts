import type { Database } from '@altitutor/shared';

import { supabase } from '@/lib/supabase';

export type TutorProfile = Database['public']['Views']['vtutor_profile']['Row'];

export async function loadTutorProfile(userId: string, signal?: AbortSignal): Promise<TutorProfile | null> {
  const query = supabase.from('vtutor_profile').select('*').eq('user_id', userId);
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  if (error) throw error;

  return (data?.status === 'ACTIVE' || data?.status === 'TRIAL') &&
    (data.role === 'TUTOR' || data.role === 'ADMINSTAFF') ? data : null;
}
