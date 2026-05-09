import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';

export type Invoice = Database['public']['Views']['vstudent_invoices']['Row'];
export type InvoiceItem = Database['public']['Views']['vstudent_invoice_items']['Row'];
export interface StudentSubscription {
  created_at: string;
  current_period_end: string | null;
  current_period_start: string | null;
  id: string;
  status: string;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  stripe_subscription_id: string;
  student_id: string;
  subject_id: string;
  updated_at: string;
}
export interface InvoiceItemWithSession extends InvoiceItem {
  session?: {
    long_name: string | null;
  } | null;
}

export interface StudentSubscriptionWithSubject extends StudentSubscription {
  subject?: {
    name: string;
    short_name: string | null;
    long_name: string | null;
  } | null;
}

export interface InvoiceWithItems extends Invoice {
  items?: InvoiceItemWithSession[];
}

export const billingApi = {
  /**
   * Get billing info from vstudent_billing view
   */
  getBilling: async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vstudent_billing')
      .select('*')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Get invoices history
   * Uses vstudent_invoices view which follows the vstudent_* pattern
   * Supports optional date range filtering
   */
  getInvoices: async (params?: { from?: string; to?: string }): Promise<Invoice[]> => {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('vstudent_invoices')
      .select('*');
    
    // Apply date range filters if provided
    if (params?.from) {
      query = query.gte('invoice_date', params.from);
    }
    if (params?.to) {
      query = query.lte('invoice_date', params.to);
    }
    
    const { data, error } = await query
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Get invoice items for a specific invoice
   */
  getInvoiceItems: async (invoiceId: string): Promise<InvoiceItemWithSession[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vstudent_invoice_items')
      .select('*, session:sessions(long_name)')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data ?? []) as InvoiceItemWithSession[];
  },

  /**
   * Get invoices with their items
   * Supports optional date range filtering
   */
  getInvoicesWithItems: async (params?: { from?: string; to?: string }): Promise<InvoiceWithItems[]> => {
    const invoices = await billingApi.getInvoices(params);
    const invoicesWithItems = await Promise.all(
      invoices
        .filter((invoice) => invoice.id != null) // Filter out invoices without IDs
        .map(async (invoice) => {
          const items = await billingApi.getInvoiceItems(invoice.id!);
          return { ...invoice, items };
        })
    );
    return invoicesWithItems;
  },

  getStudentSubscriptions: async (): Promise<StudentSubscriptionWithSubject[]> => {
    const supabase = getSupabaseClient();
    const subscriptionsClient = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          order: (
            column: string,
            options: { ascending: boolean }
          ) => Promise<{ data: StudentSubscription[] | null; error: Error | null }>;
        };
      };
    };

    const { data: subscriptions, error } = await subscriptionsClient
      .from('vstudent_subscriptions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const subjectIds = Array.from(
      new Set((subscriptions ?? []).map((subscription) => subscription.subject_id).filter(Boolean))
    );

    let subjectsById = new Map<string, { name: string; short_name: string | null; long_name: string | null }>();
    if (subjectIds.length) {
      const { data: subjects, error: subjectsError } = await supabase
        .from('vstudent_subjects')
        .select('id, name, short_name, long_name')
        .in('id', subjectIds);

      if (subjectsError) throw subjectsError;

      subjectsById = new Map(
        (subjects ?? [])
          .filter(
            (subject): subject is { id: string; name: string | null; short_name: string | null; long_name: string | null } =>
              !!subject.id
          )
          .map((subject) => [
            subject.id,
            {
              name: subject.name ?? '',
              short_name: subject.short_name,
              long_name: subject.long_name,
            },
          ])
      );
    }

    return (subscriptions ?? []).map((subscription) => ({
      ...subscription,
      subject: subjectsById.get(subscription.subject_id) ?? null,
    })) as StudentSubscriptionWithSubject[];
  },

  /**
   * Get payments (backward compatibility - returns invoices)
   * Transforms invoices to match expected payment structure for components that haven't been updated yet
   */
  getPayments: async (): Promise<Invoice[]> => {
    return billingApi.getInvoices();
  }
};
