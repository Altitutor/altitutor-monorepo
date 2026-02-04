import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database, Tables } from '@altitutor/shared';
import type {
  UninvoicedSession,
  UnloggedSession,
  UnassignedClass,
  UnrepliedMessage,
  FailedDeliveryMessage,
  UnpaidInvoice,
  StudentWithoutClasses,
  StudentWithoutPaymentMethod,
  TrialStudentNotSignedUp,
} from '../types';

// Helper type for querying views
type ViewQueryResult<T> = {
  data: T[] | null;
  error: Error | null;
};

type ViewQueryBuilder = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => Promise<ViewQueryResult<unknown>>;
  };
};

type SupabaseWithViews = SupabaseClient<Database> & {
  from: (table: string) => ViewQueryBuilder;
};

/**
 * Reconciliation API client for querying reconciliation views
 */
export const reconciliationApi = {
  /**
   * Get uninvoiced sessions
   */
  getUninvoicedSessions: async (): Promise<UninvoicedSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_uninvoiced_sessions')
      .select('*')
      .order('session_start_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as UninvoicedSession[];
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
        status,
        amount_due_cents,
        currency,
        stripe_invoice_id,
        collection_method,
        metadata,
        student:students!invoices_student_id_fkey (
          first_name,
          last_name,
          email
        )
      `)
      .neq('status', 'paid')
      .neq('status', 'void')
      .gt('amount_due_cents', 0)
      .order('invoice_date', { ascending: true });
    
    if (error) throw error;
    
    // Transform the data to match UnpaidInvoice type
    type InvoiceQueryResult = {
      id: string;
      student_id: string;
      invoice_date: string;
      status: string;
      amount_due_cents: number;
      currency: string;
      stripe_invoice_id: string | null;
      collection_method: string | null;
      metadata: unknown;
      student: {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
    };
    
    return (data ?? []).map((invoice: InvoiceQueryResult) => {
      const student = invoice.student;
      type InvoiceMetadata = {
        last_payment_error?: {
          code: string;
          message: string;
          type: string;
        } | null;
      };
      const metadata = (invoice.metadata as InvoiceMetadata | null) ?? null;
      const lastPaymentError = metadata?.last_payment_error || null;
      
      return {
        id: invoice.id,
        student_id: invoice.student_id,
        invoice_date: invoice.invoice_date,
        due_date: null, // invoices table doesn't have due_date column
        status: invoice.status,
        amount_due_cents: invoice.amount_due_cents,
        currency: invoice.currency,
        stripe_invoice_id: invoice.stripe_invoice_id,
        collection_method: invoice.collection_method,
        last_payment_error: lastPaymentError,
        student_first_name: student?.first_name || null,
        student_last_name: student?.last_name || null,
        student_email: student?.email || null,
        days_overdue: null, // Cannot calculate without due_date
      } as UnpaidInvoice;
    });
  },

  /**
   * Get unlogged sessions
   */
  getUnloggedSessions: async (): Promise<UnloggedSession[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
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
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_unassigned_classes')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) throw error;
    return (data ?? []) as UnassignedClass[];
  },

  /**
   * Get unreplied messages
   */
  getUnrepliedMessages: async (): Promise<UnrepliedMessage[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_unreplied_messages')
      .select('*')
      .order('last_message_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as UnrepliedMessage[];
  },

  /**
   * Get failed delivery messages
   */
  getFailedDeliveryMessages: async (): Promise<FailedDeliveryMessage[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_failed_delivery_messages')
      .select('*')
      .order('status_updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as FailedDeliveryMessage[];
  },

  /**
   * Get students without classes
   */
  getStudentsWithoutClasses: async (): Promise<StudentWithoutClasses[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_students_without_classes')
      .select('*')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as StudentWithoutClasses[];
  },

  /**
   * Get students without payment method
   */
  getStudentsWithoutPaymentMethod: async (): Promise<StudentWithoutPaymentMethod[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_students_without_payment_method')
      .select('*')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as StudentWithoutPaymentMethod[];
  },

  /**
   * Get trial students who haven't signed up
   */
  getTrialStudentsNotSignedUp: async (): Promise<TrialStudentNotSignedUp[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await (supabase as unknown as SupabaseWithViews)
      .from('vadmin_reconciliation_trial_students_not_signed_up')
      .select('*')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as TrialStudentNotSignedUp[];
  },
};
