import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Folder, FolderInsert, FolderUpdate, FolderTreeItem } from '../types';
import { notesApi } from './notes';

/**
 * Folders API client for working with note folders
 */
export const foldersApi = {
  /**
   * Get all folders
   */
  list: async (): Promise<Folder[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes_folders')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Folder[];
  },

  /**
   * Get root folders (folders with no parent)
   */
  listRoot: async (): Promise<Folder[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes_folders')
      .select('*')
      .is('parent_id', null)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Folder[];
  },

  /**
   * Get folders by parent ID
   */
  listByParent: async (parentId: string): Promise<Folder[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes_folders')
      .select('*')
      .eq('parent_id', parentId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Folder[];
  },

  /**
   * Get a single folder by ID
   */
  get: async (folderId: string): Promise<Folder | null> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes_folders')
      .select('*')
      .eq('id', folderId)
      .single();

    if (error) throw error;
    return data as Folder | null;
  },

  /**
   * Create a new folder
   */
  create: async (folder: FolderInsert): Promise<Folder> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes_folders')
      .insert(folder)
      .select()
      .single();

    if (error) throw error;
    return data as Folder;
  },

  /**
   * Update a folder
   */
  update: async (folderId: string, updates: FolderUpdate): Promise<Folder> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('notes_folders')
      .update(updates)
      .eq('id', folderId)
      .select()
      .single();

    if (error) throw error;
    return data as Folder;
  },

  /**
   * Delete a folder
   */
  delete: async (folderId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { error } = await supabase.from('notes_folders').delete().eq('id', folderId);

    if (error) throw error;
  },

  /**
   * Get folder tree with notes (recursive structure)
   */
  getTree: async (): Promise<FolderTreeItem[]> => {
    // Fetch all folders
    const allFolders = await foldersApi.list();

    // Fetch all notes
    const allNotes = await notesApi.list();

    // Build tree structure
    const buildTree = (parentId: string | null): FolderTreeItem[] => {
      const children = allFolders.filter((f) => f.parent_id === parentId);
      return children.map((folder) => ({
        ...folder,
        notes: allNotes.filter((n) => n.folder_id === folder.id),
        children: buildTree(folder.id),
      }));
    };

    return buildTree(null);
  },
};
