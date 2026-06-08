import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type UcatPracticeDayDiscountConfigRow =
  Tables<'ucat_practice_day_discount_config'>;

export type UcatPracticeDayDiscountConfigUpdate = Pick<
  UcatPracticeDayDiscountConfigRow,
  'discount_per_day_cents' | 'max_discounts_per_period'
>;

export const ucatPracticeDayDiscountConfigApi = {
  async list(): Promise<UcatPracticeDayDiscountConfigRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('ucat_practice_day_discount_config')
      .select('*')
      .order('billing_interval');
    if (error) throw error;
    return data ?? [];
  },

  async update(
    id: string,
    updates: UcatPracticeDayDiscountConfigUpdate,
  ): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('ucat_practice_day_discount_config')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },
};
