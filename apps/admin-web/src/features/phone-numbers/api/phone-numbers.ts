import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type OwnedNumber = Tables<'owned_numbers'>;

export const phoneNumbersApi = {
  /**
   * Get all owned numbers
   */
  async getOwnedNumbers(): Promise<OwnedNumber[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('owned_numbers')
      .select('*')
      .order('is_default', { ascending: false })
      .order('label')
      .order('phone_e164');
    if (error) throw error;
    return (data ?? []) as OwnedNumber[];
  },

  /**
   * Set a number as the default
   * This will unset all other numbers as default
   */
  async setDefaultNumber(numberId: string): Promise<void> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // First, unset all defaults
    const { error: unsetError } = await supabase
      .from('owned_numbers')
      .update({ is_default: false })
      .neq('id', numberId);
    
    if (unsetError) throw unsetError;
    
    // Then set the selected number as default
    const { error: setError } = await supabase
      .from('owned_numbers')
      .update({ is_default: true })
      .eq('id', numberId);
    
    if (setError) throw setError;
  },
};
