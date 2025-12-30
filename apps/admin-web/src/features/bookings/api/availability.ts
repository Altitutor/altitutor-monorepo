import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AvailableSlot {
  start_at: string;
  end_at: string;
  available_staff_ids: string[];
  is_available: boolean;
}

export interface GetAvailableSlotsParams {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  session_type: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  subject_id?: string;
  duration_minutes?: number;
}

export const availabilityApi = {
  async getAvailableSlots(params: GetAvailableSlotsParams): Promise<AvailableSlot[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .rpc('get_available_slots', {
        p_start_date: params.start_date,
        p_end_date: params.end_date,
        p_session_type: params.session_type,
        p_subject_id: params.subject_id ?? null,
        p_duration_minutes: params.duration_minutes ?? null,
      });
    
    if (error) throw error;
    return (data ?? []) as AvailableSlot[];
  },
};

