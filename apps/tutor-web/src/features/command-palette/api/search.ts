import { normalizeSlug, searchTutorEntities, type TutorSearchEntity } from '@altitutor/shared';
import { getTutorResourceSubjectHref } from '@/features/resources/lib/helpers';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { TutorCommandPaletteEntityResult } from '../types';

function entityHref(entity: TutorSearchEntity): string {
  if (entity.type === 'subject') return getTutorResourceSubjectHref(entity.data);
  if (entity.type === 'class') return '/classes';

  const { subject } = entity.data;
  const slug = normalizeSlug(subject.short_name || subject.name || '');
  const topicCode = entity.type === 'topic' ? entity.data.code : entity.data.topic.code;
  const topicHref = `/resources/${encodeURIComponent(slug)}/${encodeURIComponent(topicCode ?? '')}`;

  if (entity.type === 'file') return `${topicHref}/${encodeURIComponent(entity.data.code.toLowerCase())}`;
  if (entity.type === 'flashcards') return `${topicHref}/flashcards`;
  return topicHref;
}

export async function searchCommandPaletteEntities(
  search: string,
  types?: readonly string[],
): Promise<TutorCommandPaletteEntityResult[]> {
  const entities = await searchTutorEntities(getSupabaseClient(), search, types);
  return entities.map((entity) => ({ ...entity, href: entityHref(entity) }));
}
