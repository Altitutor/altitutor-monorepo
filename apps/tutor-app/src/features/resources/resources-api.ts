import { getResourceSubjectSlug, mapTutorTopicFile, type Database, type TutorResourceFile } from '@altitutor/shared';

import { supabase } from '@/lib/supabase';

export type ResourceSubject = Database['public']['Views']['vtutor_subjects']['Row'] & { id: string };

export async function getResourceSubjects(): Promise<ResourceSubject[]> {
  const { data, error } = await supabase
    .from('vtutor_subjects')
    .select('*')
    .order('curriculum')
    .order('year_level')
    .order('name');
  if (error) throw new Error(error.message);

  return data.filter((row): row is ResourceSubject => Boolean(row.id) && getResourceSubjectSlug(row) !== 'ucat');
}

export async function getResourceSubjectCovers(subjectIds: string[]) {
  const images = await supabase
    .from('vtutor_subject_images')
    .select('subject_id, storage_path, bucket')
    .in('subject_id', subjectIds);
  const signed = await Promise.all((images.data ?? []).map(async (image) => {
    if (!image.subject_id || !image.bucket || !image.storage_path) return null;
    const { data: signedImage } = await supabase.storage.from(image.bucket).createSignedUrl(image.storage_path, 3_600);
    return signedImage ? [image.subject_id, signedImage.signedUrl] as const : null;
  }));
  return new Map(signed.filter((image) => image !== null));
}

export async function getResourceSubject(subjectId: string) {
  const { data, error } = await supabase
    .from('vtutor_subjects')
    .select('id, name, long_name, short_name')
    .eq('id', subjectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getResourceTopics(subjectId: string) {
  const { data, error } = await supabase
    .from('vtutor_topics')
    .select('id, code, name, parent_id, index')
    .eq('subject_id', subjectId);
  if (error) throw new Error(error.message);
  return data;
}

export async function getResourceTopic(topicId: string) {
  const { data, error } = await supabase
    .from('vtutor_topics')
    .select('id, code, name, subject_id')
    .eq('id', topicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getTopicFiles(topicId: string): Promise<TutorResourceFile[]> {
  const { data, error } = await supabase
    .from('vtutor_topics_files')
    .select('*')
    .eq('topic_id', topicId)
    .order('type')
    .order('index');
  if (error) throw new Error(error.message);
  return data.map(mapTutorTopicFile).filter((file) => file !== null);
}

export async function getResourceFile(associationId: string) {
  const { data, error } = await supabase
    .from('vtutor_topics_files')
    .select('*')
    .eq('id', associationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTutorTopicFile(data) : null;
}

export async function getResourceFileUrl(file: TutorResourceFile) {
  if (file.externalUrl || !file.bucket || !file.storagePath) return null;
  const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.storagePath, 3_600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
