import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Note, NoteInsert, NoteUpdate } from '../types';

/**
 * Notes API client for working with note documents
 */
export const notesApi = {
  /**
   * Get all notes with optional filters
   */
  list: async (filters?: { folderId?: string | null; projectId?: string | null; search?: string }): Promise<Note[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { folderId, projectId, search } = filters || {};

    let query = supabase.from('notes_documents').select('*');

    // Folder filter
    if (folderId !== undefined && folderId !== null) {
      query = query.eq('folder_id', folderId);
    } else if (folderId === null) {
      // Explicitly filter for notes without a folder
      query = query.is('folder_id', null);
    }

    if (projectId !== undefined && projectId !== null) {
      query = query.eq('project_id', projectId);
    } else if (projectId === null) {
      query = query.is('project_id', null);
    }

    // Search filter (full-text search)
    if (search && search.trim().length > 0) {
      query = query.textSearch('search_vector', search.trim(), {
        type: 'websearch',
        config: 'english',
      });
    }

    // Order by updated_at DESC
    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []) as Note[];
  },

  /**
   * Get notes by folder ID
   */
  listByFolder: async (folderId: string): Promise<Note[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes_documents')
      .select('*')
      .eq('folder_id', folderId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Note[];
  },

  /**
   * Get a single note by ID
   */
  get: async (noteId: string): Promise<Note | null> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes_documents')
      .select('*')
      .eq('id', noteId)
      .single();

    if (error) throw error;
    return data as Note | null;
  },

  /**
   * Create a new note
   */
  create: async (note: NoteInsert): Promise<Note> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes_documents')
      .insert(note)
      .select()
      .single();

    if (error) throw error;
    return data as Note;
  },

  /**
   * Update a note
   */
  update: async (noteId: string, updates: NoteUpdate): Promise<Note> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes_documents')
      .update(updates)
      .eq('id', noteId)
      .select()
      .single();

    if (error) throw error;
    return data as Note;
  },

  /**
   * Delete a note
   */
  delete: async (noteId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { error } = await supabase.from('notes_documents').delete().eq('id', noteId);

    if (error) throw error;
  },
};
