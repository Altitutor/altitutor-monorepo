import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type UcatQuotaPeriod = 'day' | 'week' | 'month';

/** Extends generated row until db:types includes freemium columns */
export type UcatFreeQuotaFields = {
  free_practice_limit: number;
  free_practice_period: UcatQuotaPeriod;
  free_sets_limit: number;
  free_sets_period: UcatQuotaPeriod;
  free_mocks_limit: number;
  free_mocks_period: UcatQuotaPeriod;
  free_learn_limit: number;
  free_learn_period: UcatQuotaPeriod;
  free_skill_trainer_limit: number;
  free_skill_trainer_period: UcatQuotaPeriod;
};

export type UcatSubscriptionConfigRow = Tables<'ucat_subscription_config'> & UcatFreeQuotaFields;

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
  | keyof UcatFreeQuotaFields
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
    return data as UcatSubscriptionConfigRow | null;
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
