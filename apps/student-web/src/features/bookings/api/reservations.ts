import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReservationRow {
  id: string;
  start_at: string;
  end_at: string;
  subject_id: string | null;
  staff_id: string | null;
  reserved_by: string;
  expires_at: string;
  created_at: string;
  session_type: Database['public']['Enums']['session_type'];
}

export interface CreateReservationInput {
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp
  session_type: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  subject_id?: string;
  staff_id?: string; // Optional: reserve specific staff
}

export const reservationsApi = {
  async createReservation(input: CreateReservationInput): Promise<ReservationRow> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('slot_reservations')
      .insert({
        start_at: input.start_at,
        end_at: input.end_at,
        session_type: input.session_type,
        subject_id: input.subject_id || null,
        staff_id: input.staff_id || null,
        reserved_by: user.id,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as ReservationRow;
  },

  async deleteReservation(id: string): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('slot_reservations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async getMyReservations(): Promise<ReservationRow[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const reservationsClient = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          order: (
            column: string,
            options: { ascending: boolean }
          ) => Promise<{ data: ReservationRow[] | null; error: Error | null }>;
        };
      };
    };

    const { data, error } = await reservationsClient
      .from('vstudent_slot_reservations')
      .select('*')
      .order('start_at', { ascending: true });
    
    if (error) throw error;
    // RLS ensures only own reservations are returned
    return (data ?? []) as ReservationRow[];
  },
};


