import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export type TutorDocumentationDocument = Pick<
  Tables<'notes_documents'>,
  'id' | 'title' | 'content' | 'folder_id' | 'updated_at'
>;

export type TutorDocumentationFolder = Pick<
  Tables<'notes_folders'>,
  'id' | 'name' | 'parent_id'
>;

export const documentationApi = {
  async listFolders(): Promise<TutorDocumentationFolder[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vtutor_documentation_folders')
      .select('id, name, parent_id')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as TutorDocumentationFolder[];
  },

  async listDocuments(): Promise<TutorDocumentationDocument[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vtutor_documentation_documents')
      .select('id, title, content, folder_id, updated_at')
      .eq('is_tutor_documentation', true)
      .order('title', { ascending: true });

    if (error) throw error;
    return (data ?? []) as TutorDocumentationDocument[];
  },

  async getDocument(documentId: string): Promise<TutorDocumentationDocument | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vtutor_documentation_documents')
      .select('id, title, content, folder_id, updated_at')
      .eq('id', documentId)
      .eq('is_tutor_documentation', true)
      .maybeSingle();

    if (error) throw error;
    return (data as TutorDocumentationDocument | null) ?? null;
  },
};
