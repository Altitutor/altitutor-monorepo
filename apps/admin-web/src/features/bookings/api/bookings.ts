import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CreateBookingInput {
  session_type: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  student_id?: string; // Optional for trial sessions (will be created)
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp
  subject_id?: string;
  staff_id?: string; // Optional: override auto-assignment
  reservation_id?: string; // Optional: convert reservation to session
  original_session_id?: string; // Optional: if provided, updates existing session time (reschedule)
  // Trial session student/parent details (only used when creating new trial session)
  trial_student_data?: {
    student_first_name: string;
    student_last_name: string;
    student_phone: string;
    student_email?: string;
    curriculum?: string;
    year_level?: number;
    subject_ids?: string[];
  };
  trial_parent_data?: {
    skip_parent_details: boolean;
    parent_first_name?: string;
    parent_last_name?: string;
    parent_email?: string;
    parent_phone?: string;
  };
}

export const bookingsApi = {
  async createBooking(input: CreateBookingInput): Promise<string> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // If original_session_id is provided, use reschedule RPC
    if (input.original_session_id) {
      if (!input.student_id) {
        throw new Error('student_id is required for rescheduling');
      }
      const { data, error } = await supabase.rpc('reschedule_session', {
        p_original_session_id: input.original_session_id,
        p_student_id: input.student_id,
        p_session_type: input.session_type,
        p_start_at: input.start_at,
        p_end_at: input.end_at,
        p_subject_id: input.subject_id ?? undefined,
        p_staff_id: input.staff_id ?? undefined,
        p_reservation_id: input.reservation_id ?? undefined,
        p_created_by: user.id,
        p_bypass_date_restrictions: true, // Admin can reschedule past sessions
      });

      if (error) {
        const message = error.message ?? 'Failed to reschedule session';
        throw new Error(message);
      }
      if (!data) throw new Error('Failed to reschedule session: no session ID returned');
      return data as string; // Returns the original session_id (session is updated in place)
    }

    // For trial sessions with new student data, use create_admin_trial_booking
    if (input.session_type === 'TRIAL_SESSION' && input.trial_student_data && !input.student_id) {
      const { data, error } = await supabase.rpc('create_admin_trial_booking', {
        p_student_first_name: input.trial_student_data.student_first_name,
        p_student_last_name: input.trial_student_data.student_last_name,
        p_student_phone: input.trial_student_data.student_phone,
        p_start_at: input.start_at,
        p_end_at: input.end_at,
        p_created_by: user.id,
        p_student_email: input.trial_student_data.student_email ?? undefined,
        p_curriculum: input.trial_student_data.curriculum ?? undefined,
        p_year_level: input.trial_student_data.year_level ?? undefined,
        p_subject_ids: input.trial_student_data.subject_ids ?? undefined,
        p_skip_parent_details: input.trial_parent_data?.skip_parent_details ?? true,
        p_parent_first_name: input.trial_parent_data?.parent_first_name ?? undefined,
        p_parent_last_name: input.trial_parent_data?.parent_last_name ?? undefined,
        p_parent_email: input.trial_parent_data?.parent_email ?? undefined,
        p_parent_phone: input.trial_parent_data?.parent_phone ?? undefined,
        p_staff_id: input.staff_id ?? undefined,
      });
      
      if (error) throw error;
      if (!data) throw new Error('Failed to create trial booking: no data returned');
      
      // The function returns JSONB with session_id
      const result = data as { session_id: string };
      return result.session_id;
    }

    // Otherwise, use regular booking RPC (requires student_id)
    if (!input.student_id) {
      throw new Error('student_id is required for non-trial bookings');
    }
    
    const { data, error } = await supabase.rpc('create_booking_session', {
      p_session_type: input.session_type,
      p_student_id: input.student_id,
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

