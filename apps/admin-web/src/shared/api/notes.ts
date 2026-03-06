import type { Tables, TablesInsert, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { JSONContent } from '@tiptap/core';

/**
 * Notes API client for working with notes data.
 * Note content is stored as TipTap/ProseMirror JSONB.
 */
export const notesApi = {
  /**
   * Create a new note
   */
  createNote: async (params: {
    targetType: string;
    targetId: string;
    note: JSONContent;
    staffId: string;
  }): Promise<Tables<'notes'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const noteInsert: TablesInsert<'notes'> = {
      target_type: params.targetType,
      target_id: params.targetId,
      note: params.note as TablesInsert<'notes'>['note'],
      created_by: params.staffId,
    };
    
    const { data, error } = await supabase
      .from('notes')
      .insert(noteInsert)
      .select()
      .single();
    
    if (error) throw error;
    return data as Tables<'notes'>;
  },

  /**
   * Get notes for a specific target
   */
  getNotes: async (params: {
    targetType: string;
    targetId: string;
  }): Promise<Tables<'notes'>[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('target_type', params.targetType)
      .eq('target_id', params.targetId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data ?? []) as Tables<'notes'>[];
  },

  /**
   * Get notes with staff details
   */
  getNotesWithStaff: async (params: {
    targetType: string;
    targetId: string;
  }): Promise<Array<Tables<'notes'> & { staff?: Tables<'staff'> | null }>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('notes')
      .select(`
        *,
        staff:created_by(*)
      `)
      .eq('target_type', params.targetType)
      .eq('target_id', params.targetId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data ?? []) as Array<Tables<'notes'> & { staff?: Tables<'staff'> | null }>;
  },

  /**
   * Update a note
   */
  updateNote: async (noteId: string, note: JSONContent): Promise<Tables<'notes'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes')
      .update({ note })
      .eq('id', noteId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Tables<'notes'>;
  },

  /**
   * Delete a note
   */
  deleteNote: async (noteId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);
    
    if (error) throw error;
  },
};

