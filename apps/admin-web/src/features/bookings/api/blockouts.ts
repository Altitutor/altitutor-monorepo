import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type BlockoutRow = Tables<'booking_staff_unavailability'>;

export interface CreateBlockoutInput {
  staff_id: string;
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp
  reason?: string;
}

export interface UpdateBlockoutInput {
  start_at?: string;
  end_at?: string;
  reason?: string;
}

export const blockoutsApi = {
  async getBlockouts(staffId?: string): Promise<BlockoutRow[]> {
    let query = (getSupabaseClient() as SupabaseClient<Database>)
      .from('booking_staff_unavailability')
      .select('*, staff:staff_id(id, first_name, last_name)')
      .order('start_at', { ascending: true });

    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as BlockoutRow[];
  },

  async createBlockout(input: CreateBlockoutInput): Promise<BlockoutRow> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('booking_staff_unavailability')
      .insert({
        staff_id: input.staff_id,
        start_at: input.start_at,
        end_at: input.end_at,
        reason: input.reason,
      })
      .select()
      .single();
    if (error) throw error;
    return data as BlockoutRow;
  },

  async updateBlockout(
    id: string,
    updates: UpdateBlockoutInput
  ): Promise<BlockoutRow> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('booking_staff_unavailability')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as BlockoutRow;
  },

  async deleteBlockout(id: string): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('booking_staff_unavailability')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};


