import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

const supabase = createClientComponentClient<Database>();

type PaymentAttempt = Database['public']['Views']['vstudent_payment_attempts']['Row'];

export const billingApi = {
  /**
   * Get billing info from vstudent_billing view
   */
  getBilling: async () => {
    const { data, error } = await supabase
      .from('vstudent_billing')
      .select('*')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Get payment attempts history (replaces getPayments)
   * Uses vstudent_payment_attempts view which follows the vstudent_* pattern
   */
  getPaymentAttempts: async (): Promise<PaymentAttempt[]> => {
    const { data, error } = await supabase
      .from('vstudent_payment_attempts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Get payments (alias for getPaymentAttempts for backward compatibility)
   * Transforms payment attempts to match expected payment structure
   */
  getPayments: async (): Promise<PaymentAttempt[]> => {
    return billingApi.getPaymentAttempts();
  }
};
