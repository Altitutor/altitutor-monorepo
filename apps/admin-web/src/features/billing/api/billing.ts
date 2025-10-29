import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export type PaymentRow = Tables<'payments'>;

export const billingApi = {
  async getPaymentsByStudent(studentId: string): Promise<PaymentRow[]> {
    const { data, error } = await getSupabaseClient()
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PaymentRow[];
  },

  async getPaymentsBySession(sessionId: string): Promise<PaymentRow[]> {
    const { data, error } = await getSupabaseClient()
      .from('payments')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PaymentRow[];
  },

  async listPayments(params: { status?: PaymentRow['status'] | 'ALL'; from?: string; to?: string; q?: string; limit?: number; }): Promise<PaymentRow[]> {
    const { status = 'ALL', from, to, q, limit = 200 } = params || {};
    let query = getSupabaseClient()
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status && status !== 'ALL') query = query.eq('status', status as PaymentRow['status']);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (q) {
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).filter((p: any) => (p.session_id?.includes(q) || p.id?.includes(q)));
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PaymentRow[];
  },

  async retryPayment(paymentId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('payments')
      .update({ retry_count: 0, last_retry_at: null, status: 'failed' })
      .eq('id', paymentId);
    if (error) throw error;
  },

  async testChargeSession(sessionId: string, studentId: string): Promise<void> {
    // Call edge function to manually trigger charge for a session/student pair (testing only)
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/billing-test-charge`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({ sessionId, studentId }),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to trigger test charge: ${res.status} ${errorText}`);
    }
  },
};

