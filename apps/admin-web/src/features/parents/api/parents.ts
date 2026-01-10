import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Parents API client for working with parent data
 */
export const parentsApi = {
  /**
   * Paginated, server-filtered parents list
   */
  list: async (params: {
    search?: string;
    limit?: number;
    offset?: number;
    orderBy?: keyof Tables<'parents'>;
    ascending?: boolean;
  }): Promise<{ parents: Array<Tables<'parents'> & { students?: Tables<'students'>[] }>; total: number }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const {
      search = '',
      limit = 50,
      offset = 0,
      orderBy = 'last_name',
      ascending = true,
    } = params || {};

    let query = supabase
      .from('parents')
      .select(
        `
          *,
          parents_students (
            students (*)
          )
        `,
        { count: 'exact' }
      );

    // Search across common fields
    const trimmed = search.trim();
    if (trimmed.length > 0) {
      const q = `%${trimmed}%`;
      query = query.or(
        `first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},phone.ilike.${q}`
      );
    }

    // Sorting
    query = query.order(orderBy as string, { ascending });

    // Pagination
    const from = offset;
    const to = Math.max(offset + limit - 1, offset);
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    // Transform the data to flatten students array
    const parents = (data ?? []).map((parent: any) => ({
      ...parent,
      students: (parent.parents_students || []).map((ps: any) => ps.students).filter(Boolean),
    }));

    return {
      parents: parents as Array<Tables<'parents'> & { students?: Tables<'students'>[] }>,
      total: count ?? 0,
    };
  },

  /**
   * Create a new parent
   */
  create: async (data: TablesInsert<'parents'>): Promise<Tables<'parents'>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data: created, error } = await supabase
      .from('parents')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return created as Tables<'parents'>;
  },

  /**
   * Get a single parent by ID
   */
  getById: async (id: string): Promise<Tables<'parents'> | null> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('parents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data as Tables<'parents'> | null;
  },

  /**
   * Update a parent
   */
  update: async (id: string, data: TablesUpdate<'parents'>): Promise<Tables<'parents'>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data: updated, error } = await supabase
      .from('parents')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return updated as Tables<'parents'>;
  },
};

