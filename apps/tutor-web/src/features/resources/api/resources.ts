import { buildFileCountByTopic, mapTopicFile, normalizeSlug } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { ResourceFile, ResourceSubject, TutorTopicFileRow, TutorTopicRow, TutorSubjectRow } from '../lib/types';

export const resourcesApi = {
  async getMySubjects(): Promise<ResourceSubject[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vtutor_subjects')
      .select('*')
      .order('curriculum', { ascending: true })
      .order('year_level', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    const subjects = ((data ?? []) as TutorSubjectRow[]).filter((s): s is TutorSubjectRow & { id: string } =>
      Boolean(s.id),
    );

    let imageMap = new Map<string, ResourceSubject['image']>();
    if (subjects.length > 0) {
      const { data: imageRows, error: imageError } = await supabase
        .from('vtutor_subject_images')
        .select('subject_id, filename, storage_path, bucket, mimetype')
        .in(
          'subject_id',
          subjects.map((s) => s.id),
        );

      if (!imageError && imageRows) {
        imageMap = new Map(
          imageRows.map((row) => [
            row.subject_id as string,
            {
              filename: row.filename,
              storage_path: row.storage_path,
              bucket: row.bucket,
              mimetype: row.mimetype,
            },
          ]),
        );
      }
    }

    return subjects.map((subject) => ({ ...subject, image: imageMap.get(subject.id) ?? null }));
  },

  async getSubjectByShortName(subjectShortName: string): Promise<ResourceSubject | null> {
    const subjects = await resourcesApi.getMySubjects();
    const slug = normalizeSlug(subjectShortName);
    return (
      subjects.find((subject) => normalizeSlug(subject.short_name ?? '') === slug) ??
      subjects.find((subject) => normalizeSlug(subject.name ?? '') === slug) ??
      null
    );
  },

  async getTopicsBySubject(subjectId: string): Promise<TutorTopicRow[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vtutor_topics')
      .select('*')
      .eq('subject_id', subjectId)
      .order('parent_id', { ascending: true })
      .order('index', { ascending: true });

    if (error) throw error;
    return (data ?? []) as TutorTopicRow[];
  },

  async getTopicByCode(subjectId: string, topicCode: string): Promise<TutorTopicRow | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vtutor_topics')
      .select('*')
      .eq('subject_id', subjectId)
      .ilike('code', topicCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return (data as TutorTopicRow | null) ?? null;
  },

  async getFileCountsBySubject(subjectId: string): Promise<Map<string, number>> {
    const supabase = getSupabaseClient();
    const topics = await resourcesApi.getTopicsBySubject(subjectId);
    const topicIds = topics.map((t) => t.id).filter((id): id is string => Boolean(id));
    if (!topicIds.length) return new Map();

    const { data, error } = await supabase
      .from('vtutor_topics_files')
      .select('topic_id')
      .in('topic_id', topicIds);

    if (error) throw error;
    return buildFileCountByTopic((data ?? []) as Pick<TutorTopicFileRow, 'topic_id'>[]);
  },

  async getTopicFiles(topicId: string): Promise<ResourceFile[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vtutor_topics_files')
      .select('*')
      .eq('topic_id', topicId)
      .order('type', { ascending: true })
      .order('index', { ascending: true });

    if (error) throw error;
    return ((data ?? []) as TutorTopicFileRow[])
      .map(mapTopicFile)
      .filter((row): row is ResourceFile => row !== null);
  },

  async getTopicFileByCode(topicId: string, fileCode: string): Promise<ResourceFile | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vtutor_topics_files')
      .select('*')
      .eq('topic_id', topicId)
      .ilike('code', fileCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return mapTopicFile(data as TutorTopicFileRow);
  },

  async getSignedFileUrl(file: ResourceFile, expiresIn = 3600): Promise<string | null> {
    if (file.externalUrl) {
      return null;
    }
    if (!file.bucket || !file.storagePath) {
      return null;
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.storagePath, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },
};
