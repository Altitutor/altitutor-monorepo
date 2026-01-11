import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type {
  UninvoicedSession,
  OrphanedInvoiceItem,
  StudentWithoutClasses,
  UnloggedSession,
  UnassignedClass,
  UnreadMessage,
  UnpaidInvoice,
} from '../types';

/**
 * Reconciliation API client for querying reconciliation views
 */
export const reconciliationApi = {
  /**
   * Get uninvoiced sessions
   */
  getUninvoicedSessions: async (): Promise<UninvoicedSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as any)
      .from('vadmin_reconciliation_uninvoiced_sessions')
      .select('*')
      .order('session_start_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as UninvoicedSession[];
  },

  /**
   * Get orphaned invoice items
   */
  getOrphanedInvoiceItems: async (): Promise<OrphanedInvoiceItem[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as any)
      .from('vadmin_reconciliation_orphaned_invoice_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as OrphanedInvoiceItem[];
  },

  /**
   * Get unpaid invoices
   */
  getUnpaidInvoices: async (): Promise<UnpaidInvoice[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id,
        student_id,
        invoice_date,
        due_date,
        status,
        amount_due_cents,
        currency,
        stripe_invoice_id,
        student:students!invoices_student_id_fkey (
          first_name,
          last_name,
          email
        )
      `)
      .neq('status', 'paid')
      .gt('amount_due_cents', 0)
      .order('due_date', { ascending: true, nullsFirst: false });
    
    if (error) throw error;
    
    // Transform the data to match UnpaidInvoice type
    return (data ?? []).map((invoice: any) => {
      const student = invoice.student;
      const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
      const daysOverdue = dueDate && dueDate < new Date()
        ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        id: invoice.id,
        student_id: invoice.student_id,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        status: invoice.status,
        amount_due_cents: invoice.amount_due_cents,
        currency: invoice.currency,
        stripe_invoice_id: invoice.stripe_invoice_id,
        student_first_name: student?.first_name || null,
        student_last_name: student?.last_name || null,
        student_email: student?.email || null,
        days_overdue: daysOverdue,
      } as UnpaidInvoice;
    });
  },

  /**
   * Get students without classes
   */
  getStudentsWithoutClasses: async (): Promise<StudentWithoutClasses[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as any)
      .from('vadmin_reconciliation_students_without_classes')
      .select('*')
      .order('last_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as StudentWithoutClasses[];
  },

  /**
   * Get unlogged sessions
   */
  getUnloggedSessions: async (): Promise<UnloggedSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as any)
      .from('vadmin_reconciliation_unlogged_sessions')
      .select('*')
      .order('start_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as UnloggedSession[];
  },

  /**
   * Get unassigned classes
   */
  getUnassignedClasses: async (): Promise<UnassignedClass[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as any)
      .from('vadmin_reconciliation_unassigned_classes')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) throw error;
    return (data ?? []) as UnassignedClass[];
  },

  /**
   * Get unread messages
   */
  getUnreadMessages: async (): Promise<UnreadMessage[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as any)
      .from('vadmin_reconciliation_unread_messages')
      .select('*')
      .order('last_message_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as UnreadMessage[];
  },
};
