import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type BookingSettingsRow = Tables<'booking_settings'>;

export const bookingSettingsApi = {
  async getBookingSettings(): Promise<BookingSettingsRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('booking_settings')
      .select('*')
      .order('setting_key', { ascending: true });
    if (error) throw error;
    return (data ?? []) as BookingSettingsRow[];
  },

  async updateBookingSetting(
    settingKey: string,
    settingValue: string
  ): Promise<BookingSettingsRow> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('booking_settings')
      .update({ setting_value: settingValue })
      .eq('setting_key', settingKey)
      .select()
      .single();
    if (error) throw error;
    return data as BookingSettingsRow;
  },

  async getSettingValue(settingKey: string): Promise<string | null> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('booking_settings')
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

