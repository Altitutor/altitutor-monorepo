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
    if (folderId !== undefined && folderId !== null && folderId !== '') {
      query = query.eq('folder_id', folderId);
    } else if (folderId === null) {
      // Explicitly filter for notes without a folder
      query = query.is('folder_id', null);
    }

    if (projectId !== undefined && projectId !== null && projectId !== '') {
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

    // Order by title alphabetically
    query = query.order('title', { ascending: true });

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
      .order('title', { ascending: true });

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
   * Resolve current titles for linked-note hydration (batch).
   */
  getTitlesForIds: async (noteIds: string[]): Promise<Record<string, string>> => {
    if (noteIds.length === 0) return {};
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('notes_documents')
      .select('id, title')
      .in('id', [...new Set(noteIds)]);

    if (error) throw error;
    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      map[row.id as string] = (row.title as string)?.trim() || 'Untitled';
    }
    return map;
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
