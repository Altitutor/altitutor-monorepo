import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvoiceRow, InvoiceItemRow, CreditNoteRow, MissingPaymentObligation, FailedPaymentAttempt, StuckPaymentAttempt } from '../types';

// Re-export types for backward compatibility
export type { InvoiceRow, InvoiceItemRow, CreditNoteRow, MissingPaymentObligation, FailedPaymentAttempt, StuckPaymentAttempt } from '../types';

export const billingApi = {
  // Get all invoices for a student
  async getInvoicesByStudent(studentId: string): Promise<InvoiceRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('invoices')
      .select('*')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as InvoiceRow[];
  },

  // Get invoice items for a student
  async getInvoiceItemsByStudent(studentId: string): Promise<InvoiceItemRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('invoice_items')
      .select('*')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as InvoiceItemRow[];
  },

  // Get invoice items for an invoice
  async getInvoiceItemsByInvoice(invoiceId: string): Promise<InvoiceItemRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as InvoiceItemRow[];
  },

  // Get invoices by session (through invoice_items)
  async getInvoicesBySession(sessionId: string): Promise<InvoiceRow[]> {
    const { data: items, error: itemsError } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('invoice_items')
      .select('invoice_id')
      .eq('session_id', sessionId)
      .is('deleted_at', null);
    
    if (itemsError) throw itemsError;
    
    const invoiceIds = Array.from(new Set((items || []).map((item: { invoice_id: string }) => item.invoice_id)));
    if (invoiceIds.length === 0) return [];
    
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('invoices')
      .select('*')
      .in('id', invoiceIds)
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false });
    
    if (error) throw error;
    return (data ?? []) as InvoiceRow[];
  },

  async getInvoiceById(invoiceId: string): Promise<(InvoiceRow & { student?: { id: string; first_name: string; last_name: string } | null }) | null> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('invoices')
      .select(`
        *,
        student:students!invoices_student_id_fkey(id, first_name, last_name)
      `)
      .eq('id', invoiceId)
      .maybeSingle();
    
    if (error) throw error;
    return (data ?? null) as (InvoiceRow & { student?: { id: string; first_name: string; last_name: string } | null }) | null;
  },

  async listInvoices(params: { 
    statuses?: InvoiceRow['status'][]; 
    studentIds?: string[];
    from?: string; 
    to?: string; 
    limit?: number;
    offset?: number;
    orderBy?: 'invoice_date' | 'created_at' | 'status' | 'amount_due_cents';
    ascending?: boolean;
    invoiceNumberSearch?: string;
  }): Promise<{ invoices: (InvoiceRow & { student?: { id: string; first_name: string; last_name: string } | null })[]; total: number }> {
    const { 
      statuses = [], 
      studentIds = [], 
      from, 
      to, 
      limit = 50,
      offset = 0,
      orderBy = 'invoice_date',
      ascending = false,
      invoiceNumberSearch,
    } = params || {};
    
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Call RPC function
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_invoices_admin', {
      p_date_from: from || undefined,
      p_date_to: to || undefined,
      p_student_ids: studentIds.length > 0 ? studentIds : undefined,
      p_statuses: statuses.length > 0 ? statuses : undefined,
      p_limit: limit,
      p_offset: offset,
      p_order_by: orderBy,
      p_ascending: ascending,
      p_invoice_number_search: invoiceNumberSearch || undefined,
    });
    
    if (rpcError) throw rpcError;
    if (!rpcResult) {
      return { invoices: [], total: 0 };
    }
    
    // Type the RPC result
    const result = rpcResult as {
      invoices?: (InvoiceRow & { student?: { id: string; first_name: string; last_name: string } | null })[];
      total?: number;
    };
    
    const invoices = (result.invoices ?? []) as (InvoiceRow & { student?: { id: string; first_name: string; last_name: string } | null })[];
    const total = result.total ?? 0;
    
    return { invoices, total };
  },

  // Get credit notes for an invoice
  async getCreditNotesByInvoice(invoiceId: string): Promise<CreditNoteRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('credit_notes')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as CreditNoteRow[];
  },

  // Backward compatibility - returns invoices instead of payment attempts
  async getPaymentAttemptsByStudent(studentId: string): Promise<InvoiceRow[]> {
    return this.getInvoicesByStudent(studentId);
  },

  async getLatestPaymentAttemptsByStudent(studentId: string): Promise<InvoiceRow[]> {
    return this.getInvoicesByStudent(studentId);
  },

  async getPaymentAttemptsBySession(sessionId: string): Promise<InvoiceRow[]> {
    return this.getInvoicesBySession(sessionId);
  },

  async listPaymentAttempts(params: { 
    statuses?: InvoiceRow['status'][];
    studentIds?: string[];
    from?: string; 
    to?: string; 
    limit?: number;
    offset?: number;
    orderBy?: 'invoice_date' | 'created_at' | 'status' | 'amount_due_cents';
    ascending?: boolean;
    invoiceNumberSearch?: string;
  }): Promise<(InvoiceRow & { student?: { id: string; first_name: string; last_name: string } | null })[]> {
    const result = await this.listInvoices(params);
    // Backward compatibility: return just the invoices array
    return result.invoices;
  },

  // Reconciliation views
  async getMissingPaymentObligations(): Promise<MissingPaymentObligation[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('vadmin_missing_payment_obligations' as 'vadmin_reconciliation_uninvoiced_sessions')
      .select('*')
      .order('session_start_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as MissingPaymentObligation[];
  },

  async getFailedPaymentAttempts(): Promise<FailedPaymentAttempt[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('vadmin_failed_payment_attempts' as 'vadmin_reconciliation_uninvoiced_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as FailedPaymentAttempt[];
  },

  async getStuckPaymentAttempts(): Promise<StuckPaymentAttempt[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('vadmin_stuck_payment_attempts' as 'vadmin_reconciliation_uninvoiced_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as StuckPaymentAttempt[];
  },

  // Manual reconciliation trigger (deprecated - Stripe handles reconciliation automatically)
  // Kept for backward compatibility but will return empty result
  async triggerReconciliation(): Promise<{ reconciled: number; stillStuck: number; total: number }> {
    // Stripe handles reconciliation automatically for invoices
    // This function is kept for backward compatibility but does nothing
    return { reconciled: 0, stillStuck: 0, total: 0 };
  },
};
