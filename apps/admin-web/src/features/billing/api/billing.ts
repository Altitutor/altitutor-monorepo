import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export type InvoiceRow = Tables<'invoices'>;
export type InvoiceItemRow = Tables<'invoice_items'>;

// View types for reconciliation (may need updates later)
export type MissingPaymentObligation = any; // Views aren't in generated types yet
export type FailedPaymentAttempt = any;
export type StuckPaymentAttempt = any;

export const billingApi = {
  // Get all invoices for a student
  async getInvoicesByStudent(studentId: string): Promise<InvoiceRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('invoices')
      .select('*')
      .eq('student_id', studentId)
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
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as InvoiceItemRow[];
  },

  // Get invoices by session (through invoice_items)
  async getInvoicesBySession(sessionId: string): Promise<InvoiceRow[]> {
    const { data: items, error: itemsError } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('invoice_items')
      .select('invoice_id')
      .eq('session_id', sessionId);
    
    if (itemsError) throw itemsError;
    
    const invoiceIds = Array.from(new Set((items || []).map((item: any) => item.invoice_id)));
    if (invoiceIds.length === 0) return [];
    
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('invoices')
      .select('*')
      .in('id', invoiceIds)
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
  }): Promise<(InvoiceRow & { student?: { id: string; first_name: string; last_name: string } | null })[]> {
    const { statuses = [], studentIds = [], from, to, limit = 200 } = params || {};
    let query = (getSupabaseClient() as SupabaseClient<Database>)
      .from('invoices')
      .select(`
        *,
        student:students!invoices_student_id_fkey(id, first_name, last_name)
      `)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Status filter (multiple selection with AND - all selected statuses)
    if (statuses && statuses.length > 0) {
      query = query.in('status', statuses);
    }
    
    // Student filter (multiple selection with AND - all selected students)
    if (studentIds && studentIds.length > 0) {
      query = query.in('student_id', studentIds);
    }
    
    // Date filters
    if (from) query = query.gte('invoice_date', from);
    if (to) query = query.lte('invoice_date', to);
    
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as (InvoiceRow & { student?: { id: string; first_name: string; last_name: string } | null })[];
  },

  // Backward compatibility - returns invoices instead of payment attempts
  async getPaymentAttemptsByStudent(studentId: string): Promise<any[]> {
    return this.getInvoicesByStudent(studentId);
  },

  async getLatestPaymentAttemptsByStudent(studentId: string): Promise<any[]> {
    return this.getInvoicesByStudent(studentId);
  },

  async getPaymentAttemptsBySession(sessionId: string): Promise<any[]> {
    return this.getInvoicesBySession(sessionId);
  },

  async listPaymentAttempts(params: { 
    statuses?: InvoiceRow['status'][];
    studentIds?: string[];
    from?: string; 
    to?: string; 
    limit?: number; 
  }): Promise<any[]> {
    return this.listInvoices(params);
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

  // Manual reconciliation trigger (deprecated - Stripe handles reconciliation automatically)
  // Kept for backward compatibility but will return empty result
  async triggerReconciliation(): Promise<{ reconciled: number; stillStuck: number; total: number }> {
    // Stripe handles reconciliation automatically for invoices
    // This function is kept for backward compatibility but does nothing
    return { reconciled: 0, stillStuck: 0, total: 0 };
  },
};
