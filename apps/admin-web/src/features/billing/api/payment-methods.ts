import { getSupabaseClient } from '@/shared/lib/supabase/client';

export interface PaymentMethodData {
  id: string;
  stripe_payment_method_id: string;
  is_default: boolean;
  card_brand: string;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
  card_country: string | null;
  created_at: string;
}

export const paymentMethodsApi = {
  /**
   * Create a SetupIntent for adding a new payment method for a student
   * Admin can add payment methods on behalf of students
   */
  createSetupIntent: async (studentId: string, email?: string, name?: string): Promise<{ client_secret: string; setup_intent_id: string }> => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.functions.invoke('payment-methods', {
      body: {
        action: 'create_setup_intent',
        studentId,
        email,
        name
      }
    });
    
    if (error) throw error;
    if (!data || !data.client_secret) {
      throw new Error('Failed to create setup intent');
    }
    
    return data;
  },
  
  /**
   * Set a payment method as default
   */
  setDefaultPaymentMethod: async (paymentMethodId: string, studentId: string): Promise<void> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('payment-methods', {
      body: {
        action: 'set_default',
        paymentMethodId,
        studentId
      }
    });
    
    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to set default payment method');
    }
  },
  
  /**
   * Delete a payment method
   */
  deletePaymentMethod: async (paymentMethodId: string, studentId: string): Promise<void> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('payment-methods', {
      body: {
        action: 'delete',
        paymentMethodId,
        studentId
      }
    });
    
    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to delete payment method');
    }
  },
};

