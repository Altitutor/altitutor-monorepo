import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type BillingPricingRow = Tables<'billing_pricing'>;

export const pricingApi = {
  async getBillingPricing(): Promise<BillingPricingRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('billing_pricing')
      .select('*')
      .order('billing_type', { ascending: true });
    if (error) throw error;
    return (data ?? []) as BillingPricingRow[];
  },

  async updateBillingPricing(
    billingType: 'CLASS' | 'EXAM_COURSE' | 'DRAFTING',
    updates: { hourly_rate_cents?: number; currency?: string }
  ): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('billing_pricing')
      .update(updates)
      .eq('billing_type', billingType);
    if (error) throw error;
  },
};
