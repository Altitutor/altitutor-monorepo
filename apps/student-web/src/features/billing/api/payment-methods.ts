import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

const supabase = createClientComponentClient<Database>();

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

export interface BillingData {
  student_id: string;
  stripe_customer_id: string;
  created_at: string;
  updated_at: string;
  payment_methods: PaymentMethodData[] | null;
  default_payment_method: PaymentMethodData | null;
}

export const paymentMethodsApi = {
  /**
   * Get all payment methods for current student from vstudent_billing view
   */
  getPaymentMethods: async (): Promise<BillingData | null> => {
    const { data, error } = await supabase
      .from('vstudent_billing')
      .select('*')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Create a SetupIntent for adding a new payment method
   */
  createSetupIntent: async (studentId: string): Promise<{ client_secret: string; setup_intent_id: string }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.functions.invoke('card-setup', {
      body: { studentId }
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
  setDefaultPaymentMethod: async (paymentMethodId: string): Promise<void> => {
    const { data, error } = await supabase.functions.invoke('payment-method-manage', {
      body: {
        action: 'set_default',
        paymentMethodId
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
  deletePaymentMethod: async (paymentMethodId: string): Promise<void> => {
    const { data, error } = await supabase.functions.invoke('payment-method-manage', {
      body: {
        action: 'delete',
        paymentMethodId
      }
    });
    
    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to delete payment method');
    }
  },

  /**
   * Get payment method details from Stripe
   */
  getPaymentMethodDetails: async (paymentMethodId: string): Promise<{
    card_brand: string;
    card_last4: string;
    card_exp_month: number;
    card_exp_year: number;
    card_country: string | null;
  }> => {
    const { data, error } = await supabase.functions.invoke('get-payment-method', {
      body: { paymentMethodId }
    });
    
    if (error) throw error;
    if (!data) {
      throw new Error('Failed to get payment method details');
    }
    
    return data;
  }
};








