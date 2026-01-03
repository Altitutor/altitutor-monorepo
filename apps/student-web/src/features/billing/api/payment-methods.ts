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

export interface BillingData {
  student_id: string | null;
  stripe_customer_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  payment_methods: PaymentMethodData[] | null;
  default_payment_method: PaymentMethodData | null;
}

export const paymentMethodsApi = {
  /**
   * Get all payment methods for current student from vstudent_billing view
   */
  getPaymentMethods: async (): Promise<BillingData | null> => {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('vstudent_billing')
      .select('*')
      .maybeSingle();
    
    if (error) throw error;
    
    if (!data) return null;
    
    // Transform payment_methods from Json to PaymentMethodData[] if needed
    let paymentMethods: PaymentMethodData[] | null = null;
    if (data.payment_methods) {
      if (Array.isArray(data.payment_methods)) {
        paymentMethods = data.payment_methods as unknown as PaymentMethodData[];
      } else if (typeof data.payment_methods === 'string') {
        try {
          paymentMethods = JSON.parse(data.payment_methods) as PaymentMethodData[];
        } catch {
          paymentMethods = null;
        }
      }
    }
    
    // Transform default_payment_method from Json to PaymentMethodData if needed
    let defaultPaymentMethod: PaymentMethodData | null = null;
    if (data.default_payment_method) {
      if (typeof data.default_payment_method === 'object' && !Array.isArray(data.default_payment_method)) {
        defaultPaymentMethod = data.default_payment_method as unknown as PaymentMethodData;
      } else if (typeof data.default_payment_method === 'string') {
        try {
          defaultPaymentMethod = JSON.parse(data.default_payment_method) as PaymentMethodData;
        } catch {
          defaultPaymentMethod = null;
        }
      }
    }
    
    return {
      student_id: data.student_id,
      stripe_customer_id: data.stripe_customer_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
      payment_methods: paymentMethods,
      default_payment_method: defaultPaymentMethod,
    };
  },
  
  /**
   * Create a SetupIntent for adding a new payment method
   */
  createSetupIntent: async (studentId: string): Promise<{ client_secret: string; setup_intent_id: string }> => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.functions.invoke('payment-methods', {
      body: {
        action: 'create_setup_intent',
        studentId
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
  setDefaultPaymentMethod: async (paymentMethodId: string): Promise<void> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('payment-methods', {
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
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('payment-methods', {
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
    const supabase = getSupabaseClient();
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








