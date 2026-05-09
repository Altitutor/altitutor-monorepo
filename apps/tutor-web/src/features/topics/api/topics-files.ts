import type { Database } from '@altitutor/shared';
import type { Enums, Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Topic file row as returned from vtutor_topics_files (flat file columns). */
export type TutorTopicFileWithFileFields = Pick<
  Tables<'topics_files'>,
  | 'id'
  | 'topic_id'
  | 'type'
  | 'index'
  | 'code'
  | 'file_id'
  | 'is_solutions'
  | 'is_solutions_of_id'
  | 'created_at'
  | 'updated_at'
  | 'created_by'
> & {
  filename: string | null;
  mimetype: string | null;
  storage_path: string | null;
  external_url: string | null;
};

/**
 * Topics Files API for tutor-web
 *
 * IMPORTANT: Tutor-web can only READ through views (vtutor_topics_files)
 * All writes (create/update topic files) must go through API routes:
 * - POST /api/topics-files
 * - PATCH /api/topics-files/[id]
 */
export const topicsFilesApi = {
  /**
   * Get topic files for a topic from vtutor_topics_files view.
   */
  getTopicFilesByTopic: async (topicId: string): Promise<TutorTopicFileWithFileFields[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('vtutor_topics_files')
      .select('*')
      .eq('topic_id', topicId)
      .order('type')
      .order('index');
    if (error) {
      console.error('Error fetching topic files:', error);
      throw error;
    }
    const rows = data ?? [];
    return rows
      .filter(
        (f): f is typeof f & { id: string; file_id: string; topic_id: string; index: number; code: string } =>
          f.id != null &&
          f.file_id != null &&
          f.topic_id != null &&
          f.index != null &&
          f.code != null
      )
      .map((f) => ({
        id: f.id,
        topic_id: f.topic_id,
        type: f.type as Enums<'resource_type'>,
        index: f.index,
        code: f.code,
        file_id: f.file_id,
        is_solutions: f.is_solutions ?? false,
        is_solutions_of_id: f.is_solutions_of_id,
        created_at: f.created_at,
        updated_at: f.updated_at,
        created_by: f.created_by,
        filename: f.filename ?? null,
        mimetype: f.mimetype ?? null,
        storage_path: f.storage_path ?? null,
        external_url: f.external_url ?? null,
      }));
  },

  /**
   * Get topic files by IDs from vtutor_topics_files view.
   */
  getTopicFilesByIds: async (ids: string[]): Promise<TutorTopicFileWithFileFields[]> => {
    if (ids.length === 0) return [];
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('vtutor_topics_files')
      .select('*')
      .in('id', ids);
    if (error) {
      console.error('Error fetching topic files by ids:', error);
      throw error;
    }
    const rows = data ?? [];
    return rows
      .filter(
        (f): f is typeof f & { id: string; file_id: string; topic_id: string; index: number; code: string } =>
          f.id != null &&
          f.file_id != null &&
          f.topic_id != null &&
          f.index != null &&
          f.code != null &&
          typeof f.type === 'string'
      )
      .map((f) => ({
        id: f.id,
        topic_id: f.topic_id,
        type: f.type as Enums<'resource_type'>,
        index: f.index,
        code: f.code,
        file_id: f.file_id,
        is_solutions: f.is_solutions ?? false,
        is_solutions_of_id: f.is_solutions_of_id,
        created_at: f.created_at,
        updated_at: f.updated_at,
        created_by: f.created_by,
        filename: f.filename ?? null,
        mimetype: f.mimetype ?? null,
        storage_path: f.storage_path ?? null,
        external_url: f.external_url ?? null,
      }));
  },
};
