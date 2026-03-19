import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type UcatSubscriptionConfigRow = Tables<'ucat_subscription_config'>;

export type UcatSubscriptionConfigUpdate = Pick<
  UcatSubscriptionConfigRow,
  | 'min_questions_per_day'
  | 'discount_per_day_cents'
  | 'billing_interval'
  | 'trial_days'
  | 'base_price_cents'
  | 'currency'
  | 'stripe_price_id'
  | 'stripe_product_id'
>;

export const ucatSubscriptionConfigApi = {
  async getSingleton(): Promise<UcatSubscriptionConfigRow | null> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('ucat_subscription_config')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: UcatSubscriptionConfigUpdate): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('ucat_subscription_config')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },
};
