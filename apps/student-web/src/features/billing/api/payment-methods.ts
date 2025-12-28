import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'payment-methods.ts:34',message:'getPaymentMethods called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const supabase = getSupabaseClient();
    
    // #region agent log
    const { data: { user: authUser } } = await supabase.auth.getUser();
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'payment-methods.ts:38',message:'Auth user check',data:{hasUser:!!authUser,userId:authUser?.id,email:authUser?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // #region agent log
    const { data: currentStudentIdResult, error: rpcError } = await supabase.rpc('current_student_id');
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'payment-methods.ts:42',message:'current_student_id RPC result',data:{hasError:!!rpcError,rpcError:rpcError?.message,studentId:currentStudentIdResult},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const { data, error } = await supabase
      .from('vstudent_billing')
      .select('*')
      .maybeSingle();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'payment-methods.ts:48',message:'View query result',data:{hasError:!!error,error:error?.message,errorCode:error?.code,hasData:!!data,dataKeys:data?Object.keys(data):null,paymentMethodsType:data?.payment_methods?typeof data.payment_methods:null,paymentMethodsValue:data?.payment_methods?JSON.stringify(data.payment_methods).substring(0,200):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A,B,C,E'})}).catch(()=>{});
    // #endregion
    
    if (error) throw error;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'payment-methods.ts:54',message:'Returning data',data:{isNull:data===null,studentId:data?.student_id,hasPaymentMethods:!!data?.payment_methods},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    return data;
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








