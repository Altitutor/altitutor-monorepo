import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';

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
    const response = await fetch('/api/bookings/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to create reservation');
    return await response.json() as ReservationRow;
  },

  async deleteReservation(id: string): Promise<void> {
    const response = await fetch(`/api/bookings/reservations?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete reservation');
  },

  async getMyReservations(): Promise<ReservationRow[]> {
    const supabase = getSupabaseClient();
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

