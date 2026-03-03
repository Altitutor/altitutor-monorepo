import type { Database, QuickFilter, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export const quickFiltersApi = {
  /**
   * Get quick filters for a specific entity
   */
  list: async (targetEntity: string): Promise<QuickFilter[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('quick_filters')
      .select('*')
      .eq('target_entity', targetEntity)
      .order('name');

    if (error) throw error;
    return (data ?? []) as QuickFilter[];
  },

  /**
   * Get all quick filters (for settings page)
   */
  listAll: async (): Promise<QuickFilter[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('quick_filters')
      .select('*')
      .order('target_entity')
      .order('name');

    if (error) throw error;
    return (data ?? []) as QuickFilter[];
  },

  /**
   * Create a new quick filter
   */
  create: async (filter: Omit<QuickFilter, 'id' | 'created_at' | 'updated_at'>): Promise<QuickFilter> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('quick_filters')
      .insert(filter as TablesInsert<'quick_filters'>)
      .select()
      .single();

    if (error) throw error;
    return data as QuickFilter;
  },

  /**
   * Update a quick filter
   */
  update: async (id: string, updates: Partial<QuickFilter>): Promise<QuickFilter> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('quick_filters')
      .update(updates as TablesUpdate<'quick_filters'>)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as QuickFilter;
  },

  /**
   * Delete a quick filter
   */
  delete: async (id: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { error } = await supabase
      .from('quick_filters')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
