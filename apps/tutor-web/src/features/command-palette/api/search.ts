import {
  getResourceSubjectHref,
  normalizeSlug,
  buildCodeAndFilenameOrFilter,
  buildCodeAndNameOrFilter,
  buildCodeContainsPattern,
  buildSubjectNameOrFilter,
  parseSubjectQualifiedSearch,
} from '@altitutor/shared';
import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { entityTypes } from '../config/commandPalette.config';
import type { TutorCommandPaletteEntityResult, TutorSubjectSummary } from '../types';

type TutorSubjectRow = Database['public']['Views']['vtutor_subjects']['Row'];
type TutorTopicRow = Database['public']['Views']['vtutor_topics']['Row'];
type TutorTopicFileRow = Database['public']['Views']['vtutor_topics_files']['Row'];
type TutorClassRow = Database['public']['Views']['vtutor_classes']['Row'];

function toSubjectSummary(subject: TutorSubjectRow & { id: string }): TutorSubjectSummary {
  return {
    id: subject.id,
    short_name: subject.short_name,
    long_name: subject.long_name,
    name: subject.name,
    color: subject.color,
    curriculum: subject.curriculum,
  };
}

function buildTopicHref(subject: TutorSubjectSummary, topicCode: string): string {
  const slug = normalizeSlug(subject.short_name || subject.name || '');
  return `/resources/${encodeURIComponent(slug)}/${encodeURIComponent(topicCode)}`;
}

function buildFileHref(subject: TutorSubjectSummary, topicCode: string, fileCode: string): string {
  return `${buildTopicHref(subject, topicCode)}/${encodeURIComponent(fileCode.toLowerCase())}`;
}

function buildFlashcardsHref(subject: TutorSubjectSummary, topicCode: string): string {
  return `${buildTopicHref(subject, topicCode)}/flashcards`;
}

async function fetchSubjectsByIds(ids: string[]): Promise<Map<string, TutorSubjectRow & { id: string }>> {
  if (!ids.length) return new Map();

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('vtutor_subjects').select('*').in('id', ids);
  if (error) throw error;

  const map = new Map<string, TutorSubjectRow & { id: string }>();
  for (const row of data ?? []) {
    if (row.id) map.set(row.id, row as TutorSubjectRow & { id: string });
  }
  return map;
}

async function searchSubjects(search: string): Promise<TutorCommandPaletteEntityResult[]> {
  const supabase = getSupabaseClient();
  const pattern = `%${search}%`;
  const { data, error } = await supabase
    .from('vtutor_subjects')
    .select('*')
    .or(`short_name.ilike.${pattern},long_name.ilike.${pattern},name.ilike.${pattern}`)
    .limit(entityTypes.subjects.limit);

  if (error) throw error;

  const results: TutorCommandPaletteEntityResult[] = [];
  for (const row of data ?? []) {
    if (!row.id) continue;
    const subject = row as TutorSubjectRow & { id: string };
    results.push({
      type: 'subject',
      id: subject.id,
      href: getResourceSubjectHref(subject),
      data: subject,
    });
  }
  return results;
}

async function searchTopics(search: string): Promise<Array<TutorTopicRow & { id: string }>> {
  const supabase = getSupabaseClient();
  const parsed = parseSubjectQualifiedSearch(search);

  if (parsed.mode === 'qualified') {
    const { data: subjects, error: subjectError } = await supabase
      .from('vtutor_subjects')
      .select('id')
      .or(buildSubjectNameOrFilter(parsed.subjectQuery));

    if (subjectError) throw subjectError;

    const subjectIds = (subjects ?? [])
      .map((subject) => subject.id)
      .filter((id): id is string => Boolean(id));
    if (subjectIds.length === 0) return [];

    const { data, error } = await supabase
      .from('vtutor_topics')
      .select('*')
      .in('subject_id', subjectIds)
      .ilike('code', buildCodeContainsPattern(parsed.codeQuery))
      .limit(entityTypes.topics.limit);

    if (error) throw error;
    return (data ?? []).filter((row): row is TutorTopicRow & { id: string } => Boolean(row.id));
  }

  const orFilter = buildCodeAndNameOrFilter('code', 'name', search);
  const { data, error } = await supabase
    .from('vtutor_topics')
    .select('*')
    .or(orFilter)
    .limit(entityTypes.topics.limit);

  if (error) throw error;
  return (data ?? []).filter((row): row is TutorTopicRow & { id: string } => Boolean(row.id));
}

async function mapTopicsToResults(
  topicRows: Array<TutorTopicRow & { id: string }>,
): Promise<TutorCommandPaletteEntityResult[]> {
  const subjectMap = await fetchSubjectsByIds(
    [...new Set(topicRows.map((topic) => topic.subject_id).filter((id): id is string => Boolean(id)))],
  );

  const results: TutorCommandPaletteEntityResult[] = [];
  for (const topic of topicRows) {
    const subjectId = topic.subject_id;
    if (!subjectId) continue;
    const subject = subjectMap.get(subjectId);
    if (!subject || !topic.code) continue;

    results.push({
      type: 'topic',
      id: topic.id,
      href: buildTopicHref(toSubjectSummary(subject), topic.code),
      data: { ...topic, subject: toSubjectSummary(subject) },
    });
  }
  return results;
}

async function mapTopicsToFlashcardResults(
  topicRows: Array<TutorTopicRow & { id: string }>,
): Promise<TutorCommandPaletteEntityResult[]> {
  const subjectMap = await fetchSubjectsByIds(
    [...new Set(topicRows.map((topic) => topic.subject_id).filter((id): id is string => Boolean(id)))],
  );

  const results: TutorCommandPaletteEntityResult[] = [];
  for (const topic of topicRows.slice(0, entityTypes.flashcards.limit)) {
    const subjectId = topic.subject_id;
    if (!subjectId || !topic.code) continue;
    const subject = subjectMap.get(subjectId);
    if (!subject) continue;

    results.push({
      type: 'flashcards',
      id: `flashcards-${topic.id}`,
      href: buildFlashcardsHref(toSubjectSummary(subject), topic.code),
      data: {
        topic: { id: topic.id, code: topic.code, name: topic.name },
        subject: toSubjectSummary(subject),
      },
    });
  }
  return results;
}

async function searchFiles(search: string): Promise<TutorCommandPaletteEntityResult[]> {
  const supabase = getSupabaseClient();
  const parsed = parseSubjectQualifiedSearch(search);

  let fileRows: Array<TutorTopicFileRow & { id: string; topic_id: string }>;

  if (parsed.mode === 'qualified') {
    const { data: subjects, error: subjectError } = await supabase
      .from('vtutor_subjects')
      .select('id')
      .or(buildSubjectNameOrFilter(parsed.subjectQuery));

    if (subjectError) throw subjectError;

    const subjectIds = (subjects ?? [])
      .map((subject) => subject.id)
      .filter((id): id is string => Boolean(id));
    if (subjectIds.length === 0) return [];

    const { data: topics, error: topicsError } = await supabase
      .from('vtutor_topics')
      .select('id')
      .in('subject_id', subjectIds);

    if (topicsError) throw topicsError;

    const topicIds = (topics ?? [])
      .map((topic) => topic.id)
      .filter((id): id is string => Boolean(id));
    if (topicIds.length === 0) return [];

    const { data, error } = await supabase
      .from('vtutor_topics_files')
      .select('*')
      .in('topic_id', topicIds)
      .ilike('code', buildCodeContainsPattern(parsed.codeQuery))
      .limit(entityTypes.files.limit);

    if (error) throw error;

    fileRows = (data ?? []).filter(
      (row): row is TutorTopicFileRow & { id: string; topic_id: string } =>
        Boolean(row.id && row.topic_id),
    );
  } else {
    const orFilter = buildCodeAndFilenameOrFilter('code', 'filename', search);
    const { data, error } = await supabase
      .from('vtutor_topics_files')
      .select('*')
      .or(orFilter)
      .limit(entityTypes.files.limit);

    if (error) throw error;

    fileRows = (data ?? []).filter(
      (row): row is TutorTopicFileRow & { id: string; topic_id: string } =>
        Boolean(row.id && row.topic_id),
    );
  }

  const topicIds = [...new Set(fileRows.map((file) => file.topic_id))];
  const { data: topicData, error: topicError } = await supabase
    .from('vtutor_topics')
    .select('*')
    .in('id', topicIds);
  if (topicError) throw topicError;

  const topicMap = new Map<string, TutorTopicRow & { id: string }>();
  for (const row of topicData ?? []) {
    if (row.id) topicMap.set(row.id, row as TutorTopicRow & { id: string });
  }

  const subjectMap = await fetchSubjectsByIds(
    [...new Set([...topicMap.values()].map((topic) => topic.subject_id).filter((id): id is string => Boolean(id)))],
  );

  const results: TutorCommandPaletteEntityResult[] = [];
  for (const file of fileRows) {
    const topic = topicMap.get(file.topic_id);
    if (!topic?.code || !topic.subject_id) continue;
    const subject = subjectMap.get(topic.subject_id);
    if (!subject || !file.code) continue;

    const subjectSummary = toSubjectSummary(subject);
    results.push({
      type: 'file',
      id: file.id,
      href: buildFileHref(subjectSummary, topic.code, file.code),
      data: {
        id: file.id,
        topic_id: file.topic_id,
        code: file.code,
        type: file.type ?? 'other',
        filename: file.filename,
        topic: { id: topic.id, code: topic.code, name: topic.name },
        subject: subjectSummary,
      },
    });
  }
  return results;
}

async function searchClasses(search: string): Promise<TutorCommandPaletteEntityResult[]> {
  const supabase = getSupabaseClient();
  const pattern = `%${search}%`;
  const { data, error } = await supabase
    .from('vtutor_classes')
    .select('*')
    .or(`short_name.ilike.${pattern},long_name.ilike.${pattern},subject_name.ilike.${pattern}`)
    .limit(entityTypes.classes.limit);

  if (error) throw error;

  const results: TutorCommandPaletteEntityResult[] = [];
  for (const row of data ?? []) {
    if (!row.id) continue;
    const classRow = row as TutorClassRow & { id: string };
    results.push({
      type: 'class',
      id: classRow.id,
      href: '/classes',
      data: classRow,
    });
  }
  return results;
}

export async function searchCommandPaletteEntities(
  search: string,
  types: (keyof typeof entityTypes)[] = Object.keys(entityTypes) as (keyof typeof entityTypes)[],
): Promise<TutorCommandPaletteEntityResult[]> {
  const trimmed = search.trim();
  if (trimmed.length < 2) return [];

  const needsTopics = types.includes('topics') || types.includes('flashcards');
  const searchJobs: Promise<TutorCommandPaletteEntityResult[]>[] = [];

  if (types.includes('subjects')) {
    searchJobs.push(searchSubjects(trimmed));
  }

  if (types.includes('files')) {
    searchJobs.push(searchFiles(trimmed));
  }

  if (types.includes('classes')) {
    searchJobs.push(searchClasses(trimmed));
  }

  let topicRowsPromise: Promise<Array<TutorTopicRow & { id: string }>> | null = null;
  if (needsTopics) {
    topicRowsPromise = searchTopics(trimmed);
  }

  const [parallelResults, topicRows] = await Promise.all([
    Promise.all(searchJobs),
    topicRowsPromise,
  ]);

  const results = parallelResults.flat();

  if (topicRows) {
    if (types.includes('topics')) {
      results.push(...(await mapTopicsToResults(topicRows)));
    }
    if (types.includes('flashcards')) {
      results.push(...(await mapTopicsToFlashcardResults(topicRows)));
    }
  }

  return results;
}
