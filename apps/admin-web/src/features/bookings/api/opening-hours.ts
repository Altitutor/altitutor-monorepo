import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type OpeningHoursRow = Tables<'opening_hours'>;

export const openingHoursApi = {
  async getOpeningHours(): Promise<OpeningHoursRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('opening_hours')
      .select('*')
      .order('day_of_week', { ascending: true });
    if (error) throw error;
    return (data ?? []) as OpeningHoursRow[];
  },

  async createOpeningHours(
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    isActive: boolean = true
  ): Promise<OpeningHoursRow> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('opening_hours')
      .insert({
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        is_active: isActive,
      })
      .select()
      .single();
    if (error) throw error;
    return data as OpeningHoursRow;
  },

  async updateOpeningHours(
    id: string,
    updates: {
      start_time?: string;
      end_time?: string;
      is_active?: boolean;
    }
  ): Promise<OpeningHoursRow> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('opening_hours')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as OpeningHoursRow;
  },

  async deleteOpeningHours(id: string): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('opening_hours')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};


