import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CreateBookingInput {
  session_type: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp
  subject_id?: string;
  staff_id?: string; // Optional: override auto-assignment
  reservation_id?: string; // Optional: convert reservation to session
  original_session_id?: string; // Optional: if provided, marks old session as absence (reschedule)
}

export const bookingsApi = {
  async createBooking(input: CreateBookingInput): Promise<string> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get current student ID
    const { data: studentId, error: studentIdError } = await supabase.rpc('current_student_id');
    if (studentIdError || !studentId) {
      throw new Error('Failed to get student ID');
    }

    // If original_session_id is provided, use reschedule RPC (for drafting sessions)
    if (input.original_session_id && input.session_type === 'DRAFTING') {
      // Type cast needed until database types are regenerated with the new RPC function
      const { data, error } = await supabase.rpc('reschedule_drafting_session' as any, {
        p_original_session_id: input.original_session_id,
        p_student_id: studentId,
        p_start_at: input.start_at,
        p_end_at: input.end_at,
        p_subject_id: input.subject_id || undefined,
        p_staff_id: input.staff_id || undefined,
        p_reservation_id: input.reservation_id || undefined,
        p_created_by: user.id,
      });
      
      if (error) throw error;
      if (!data) throw new Error('Failed to reschedule session: no session ID returned');
      return data as string; // Returns new session_id
    }

    // Otherwise, use regular booking RPC
    const { data, error } = await supabase.rpc('create_booking_session', {
      p_session_type: input.session_type,
      p_student_id: studentId,
      p_start_at: input.start_at,
      p_end_at: input.end_at,
      p_subject_id: input.subject_id || undefined,
      p_staff_id: input.staff_id || undefined,
      p_reservation_id: input.reservation_id || undefined,
      p_created_by: user.id,
    });
    
    if (error) throw error;
    return data as string; // Returns session_id
  },
};

