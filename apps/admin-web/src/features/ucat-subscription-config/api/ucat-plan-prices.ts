import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type UcatPlanPriceRow = Tables<'ucat_plan_prices'>;

export type UcatPlanPriceUpdate = Partial<
  Pick<UcatPlanPriceRow, 'base_price_cents' | 'stripe_price_id'>
>;

export const ucatPlanPricesApi = {
  async list(): Promise<UcatPlanPriceRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('ucat_plan_prices')
      .select('*')
      .order('plan_tier')
      .order('billing_interval');
    if (error) throw error;
    return data ?? [];
  },

  async update(id: string, updates: UcatPlanPriceUpdate): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('ucat_plan_prices')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async syncBasePriceFromStripe(id: string): Promise<{ base_price_cents: number }> {
    const response = await fetch(`/api/ucat-plan-prices/${id}/sync-from-stripe`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    const body = (await response.json()) as { base_price_cents?: number; error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? 'Failed to sync from Stripe');
    }
    if (typeof body.base_price_cents !== 'number') {
      throw new Error('Invalid response from sync');
    }
    return { base_price_cents: body.base_price_cents };
  },
};
