import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Parents API client for working with parent data
 */
export const parentsApi = {
  /**
   * Paginated, server-filtered parents list
   * Uses RPC function search_parents_admin for efficient server-side search
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

    const trimmed = search.trim();
    
    // Use RPC function for search
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_parents_admin', {
      p_search: trimmed.length > 0 ? trimmed : undefined,
      p_include_relationships: true,
      p_limit: limit,
      p_offset: offset,
      p_order_by: orderBy as string,
      p_ascending: ascending,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult) return { parents: [], total: 0 };

    type RpcStudentPreview = { id: string; first_name: string | null; last_name: string | null; status: string; curriculum: string | null; year_level: number | null; school: string | null };
    type RpcParentRow = {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      created_at: string | null;
      updated_at: string | null;
      students?: RpcStudentPreview[];
    };
    const rpcData = rpcResult as { parents: RpcParentRow[]; total: number };
    
    // Transform RPC response to match expected format
    const parents = (rpcData.parents || []).map((p: RpcParentRow) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email || null,
      phone: p.phone || null,
      user_id: null, // Not returned by RPC
      invite_token: null, // Not returned by RPC
      created_by: null, // Not returned by RPC
      created_at: p.created_at || null,
      updated_at: p.updated_at || null,
      students: (p.students || []).map((s: RpcStudentPreview) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status,
        curriculum: s.curriculum || null,
        year_level: s.year_level || null,
        school: s.school || null,
        email: null, // Not returned by RPC
        phone: null, // Not returned by RPC
        created_at: null, // Not returned by RPC
        updated_at: null, // Not returned by RPC
      })),
    })) as Array<Tables<'parents'> & { students?: Tables<'students'>[] }>;

    return {
      parents,
      total: rpcData.total || 0,
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

  /**
   * Delete a parent
   * Note: Removes parents_students links first. May fail if parent has other dependencies (e.g. contacts).
   */
  delete: async (id: string): Promise<void> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    // Remove parents_students links first (no cascade in schema typically)
    await supabase.from('parents_students').delete().eq('parent_id', id);
    const { error } = await supabase.from('parents').delete().eq('id', id);
    if (error) throw error;
  },
};

