import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PaymentAttemptRow = Tables<'payment_attempts'>;

// View types for reconciliation
export type MissingPaymentObligation = any; // Views aren't in generated types yet
export type FailedPaymentAttempt = any;
export type StuckPaymentAttempt = any;

export const billingApi = {
  // Get all attempts for a student (including retries)
  async getPaymentAttemptsByStudent(studentId: string): Promise<PaymentAttemptRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('payment_attempts')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PaymentAttemptRow[];
  },

  // Get latest attempt per session for a student (for session history display)
  async getLatestPaymentAttemptsByStudent(studentId: string): Promise<PaymentAttemptRow[]> {
    // This query gets distinct on sessions_students_id ordered by attempt_number DESC
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .rpc('get_latest_payment_attempts_by_student', { p_student_id: studentId });
    if (error) throw error;
    return (data ?? []) as PaymentAttemptRow[];
  },

  async getPaymentAttemptsBySession(sessionId: string): Promise<PaymentAttemptRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('payment_attempts')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PaymentAttemptRow[];
  },

  async listPaymentAttempts(params: { 
    status?: PaymentAttemptRow['status'] | 'ALL'; 
    from?: string; 
    to?: string; 
    q?: string; 
    limit?: number; 
  }): Promise<PaymentAttemptRow[]> {
    const { status = 'ALL', from, to, q, limit = 200 } = params || {};
    let query = (getSupabaseClient() as SupabaseClient<Database>)
      .from('payment_attempts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status && status !== 'ALL') query = query.eq('status', status as PaymentAttemptRow['status']);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (q) {
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).filter((p: any) => (
        p.session_id?.includes(q) || 
        p.id?.includes(q) ||
        p.stripe_payment_intent_id?.includes(q)
      ));
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PaymentAttemptRow[];
  },

  // Reconciliation views
  async getMissingPaymentObligations(): Promise<MissingPaymentObligation[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('vadmin_missing_payment_obligations' as any)
      .select('*')
      .order('session_start_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as MissingPaymentObligation[];
  },

  async getFailedPaymentAttempts(): Promise<FailedPaymentAttempt[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('vadmin_failed_payment_attempts' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as FailedPaymentAttempt[];
  },

  async getStuckPaymentAttempts(): Promise<StuckPaymentAttempt[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('vadmin_stuck_payment_attempts' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as StuckPaymentAttempt[];
  },

  // Manual reconciliation trigger
  async triggerReconciliation(): Promise<{ reconciled: number; stillStuck: number; total: number }> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase.functions.invoke('billing-reconcile', {
      method: 'POST',
    });
    if (error) throw error;
    return data;
  },
};
