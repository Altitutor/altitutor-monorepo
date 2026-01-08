import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
  metadata: Record<string, string>;
  payment_methods: StripePaymentMethod[];
}

export interface StripePaymentMethod {
  id: string;
  type: string;
  is_default: boolean;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    country: string | null;
  } | null;
}

export interface StudentWithStripe {
  student_id: string;
  student_name: string;
  student_email: string | null;
  stripe_customer_id: string | null;
  db_payment_methods: Array<{
    id: string;
    stripe_payment_method_id: string;
    card_last4: string;
    card_brand: string;
    is_default: boolean;
  }>;
}

export const stripeSyncApi = {
  /**
   * Fetch a single Stripe customer by ID with their payment methods
   */
  getStripeCustomer: async (customerId: string): Promise<StripeCustomer> => {
    const response = await fetch(`/api/stripe/customers/${customerId}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch Stripe customer');
    }
    const data = await response.json();
    return data.customer;
  },

  /**
   * Search Stripe customers by email, name, or customer ID
   */
  searchStripeCustomers: async (query: string): Promise<StripeCustomer[]> => {
    const response = await fetch(`/api/stripe/customers/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to search Stripe customers');
    }
    const data = await response.json();
    return data.customers;
  },

  /**
   * Fetch all students with their Stripe billing info
   */
  getStudentsWithStripe: async (): Promise<StudentWithStripe[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        email,
        students_billing (
          stripe_customer_id
        ),
        student_payment_methods (
          id,
          stripe_payment_method_id,
          card_last4,
          card_brand,
          is_default
        )
      `)
      .order('first_name')
      .order('last_name');

    if (error) throw error;

    return (data || []).map((student) => {
      const billing = Array.isArray(student.students_billing) 
        ? student.students_billing[0] 
        : student.students_billing;
      
      const paymentMethods = Array.isArray(student.student_payment_methods)
        ? student.student_payment_methods
        : [];

      return {
        student_id: student.id,
        student_name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown',
        student_email: student.email,
        stripe_customer_id: billing?.stripe_customer_id || null,
        db_payment_methods: paymentMethods.map((pm: any) => ({
          id: pm.id,
          stripe_payment_method_id: pm.stripe_payment_method_id,
          card_last4: pm.card_last4,
          card_brand: pm.card_brand,
          is_default: pm.is_default,
        })),
      };
    });
  },

  /**
   * Sync a student to a Stripe customer
   */
  syncStudentToStripe: async (studentId: string, stripeCustomerId: string): Promise<{
    success: boolean;
    syncedPaymentMethods: string[];
    errors?: string[];
  }> => {
    const response = await fetch('/api/stripe/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, stripeCustomerId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync student to Stripe');
    }

    return response.json();
  },

  /**
   * Unlink a student from their Stripe customer
   */
  unlinkStudent: async (studentId: string): Promise<void> => {
    const response = await fetch('/api/stripe/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unlink student');
    }
  },

  /**
   * Sync student data from DB to Stripe (name, email, default payment method)
   */
  syncToStripe: async (studentId: string): Promise<{
    success: boolean;
    updates: string[];
    message: string;
  }> => {
    const response = await fetch('/api/stripe/sync-to-stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync to Stripe');
    }

    return response.json();
  },
};

