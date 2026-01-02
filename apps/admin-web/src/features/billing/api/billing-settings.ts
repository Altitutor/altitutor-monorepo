import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type BillingSettingsRow = Tables<'billing_settings'>;

export const billingSettingsApi = {
  async getBillingSettings(): Promise<BillingSettingsRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('billing_settings')
      .select('*')
      .order('setting_key', { ascending: true });
    if (error) throw error;
    return (data ?? []) as BillingSettingsRow[];
  },

  async updateBillingSetting(
    settingKey: string,
    settingValue: string
  ): Promise<BillingSettingsRow> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('billing_settings')
      .update({ setting_value: settingValue })
      .eq('setting_key', settingKey)
      .select()
      .single();
    if (error) throw error;
    return data as BillingSettingsRow;
  },

  async getSettingValue(settingKey: string): Promise<string | null> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('billing_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data?.setting_value ?? null;
  },
};
