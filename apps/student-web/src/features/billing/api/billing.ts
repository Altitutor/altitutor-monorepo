import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';

export type Invoice = Database['public']['Views']['vstudent_invoices']['Row'];
export type InvoiceItem = Database['public']['Views']['vstudent_invoice_items']['Row'];

export interface InvoiceWithItems extends Invoice {
  items?: InvoiceItem[];
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
  getInvoiceItems: async (invoiceId: string): Promise<InvoiceItem[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vstudent_invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
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

  /**
   * Get payments (backward compatibility - returns invoices)
   * Transforms invoices to match expected payment structure for components that haven't been updated yet
   */
  getPayments: async (): Promise<Invoice[]> => {
    return billingApi.getInvoices();
  }
};
