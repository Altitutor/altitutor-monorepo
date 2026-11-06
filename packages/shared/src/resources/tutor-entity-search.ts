import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/generated';
import {
  buildCodeAndFilenameOrFilter,
  buildCodeAndNameOrFilter,
  buildCodeContainsPattern,
  buildSubjectNameOrFilter,
  escapeIlikePattern,
  parseSubjectQualifiedSearch,
  quotePostgrestFilterValue,
} from '../utils/ilike';

type TutorSubjectRow = Database['public']['Views']['vtutor_subjects']['Row'] & { id: string };
type TutorTopicRow = Database['public']['Views']['vtutor_topics']['Row'] & { id: string };
type TutorTopicFileRow = Database['public']['Views']['vtutor_topics_files']['Row'];
type TutorClassRow = Database['public']['Views']['vtutor_classes']['Row'] & { id: string };

export const TUTOR_ENTITY_SEARCH_TYPES = ['subjects', 'topics', 'files', 'flashcards', 'classes'] as const;
const SEARCH_LIMIT = 8;

export type TutorSubjectSummary = Pick<
  TutorSubjectRow,
  'id' | 'short_name' | 'long_name' | 'name' | 'color' | 'curriculum'
>;

export type TutorSearchEntity =
  | { type: 'subject'; id: string; data: TutorSubjectRow }
  | {
      type: 'topic';
      id: string;
      data: TutorTopicRow & { subject: TutorSubjectSummary };
    }
  | {
      type: 'file';
      id: string;
      data: {
        id: string;
        topic_id: string;
        code: string;
        type: string;
        filename: string | null;
        topic: { id: string; code: string | null; name: string | null };
        subject: TutorSubjectSummary;
      };
    }
  | {
      type: 'flashcards';
      id: string;
      data: {
        topic: { id: string; code: string | null; name: string | null };
        subject: TutorSubjectSummary;
      };
    }
  | { type: 'class'; id: string; data: TutorClassRow };

function toSubjectSummary(subject: TutorSubjectRow): TutorSubjectSummary {
  return {
    id: subject.id,
    short_name: subject.short_name,
    long_name: subject.long_name,
    name: subject.name,
    color: subject.color,
    curriculum: subject.curriculum,
  };
}

async function fetchSubjectsByIds(supabase: SupabaseClient<Database>, ids: string[]): Promise<Map<string, TutorSubjectRow>> {
  if (!ids.length) return new Map();

  const { data, error } = await supabase.from('vtutor_subjects').select('*').in('id', ids);
  if (error) throw error;

  const map = new Map<string, TutorSubjectRow>();
  for (const row of data ?? []) {
    if (row.id) map.set(row.id, row as TutorSubjectRow);
  }
  return map;
}

async function searchSubjects(supabase: SupabaseClient<Database>, search: string): Promise<TutorSearchEntity[]> {
  const { data, error } = await supabase
    .from('vtutor_subjects')
    .select('*')
    .or(buildSubjectNameOrFilter(search))
    .limit(SEARCH_LIMIT);

  if (error) throw error;

  const results: TutorSearchEntity[] = [];
  for (const row of data ?? []) {
    if (!row.id) continue;
    const subject = row as TutorSubjectRow;
    results.push({
      type: 'subject',
      id: subject.id,
      data: subject,
    });
  }
  return results;
}

async function searchTopics(supabase: SupabaseClient<Database>, search: string): Promise<TutorTopicRow[]> {
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
      .limit(SEARCH_LIMIT);

    if (error) throw error;
    return (data ?? []).filter((row): row is TutorTopicRow => Boolean(row.id));
  }

  const orFilter = buildCodeAndNameOrFilter('code', 'name', search);
  const { data, error } = await supabase
    .from('vtutor_topics')
    .select('*')
    .or(orFilter)
    .limit(SEARCH_LIMIT);

  if (error) throw error;
  return (data ?? []).filter((row): row is TutorTopicRow => Boolean(row.id));
}

async function mapTopicsToResults(
  supabase: SupabaseClient<Database>,
  topicRows: TutorTopicRow[],
): Promise<TutorSearchEntity[]> {
  const subjectMap = await fetchSubjectsByIds(
    supabase,
    [...new Set(topicRows.map((topic) => topic.subject_id).filter((id): id is string => Boolean(id)))],
  );

  const results: TutorSearchEntity[] = [];
  for (const topic of topicRows) {
    const subjectId = topic.subject_id;
    if (!subjectId) continue;
    const subject = subjectMap.get(subjectId);
    if (!subject || !topic.code) continue;

    results.push({
      type: 'topic',
      id: topic.id,
      data: { ...topic, subject: toSubjectSummary(subject) },
    });
  }
  return results;
}

async function mapTopicsToFlashcardResults(
  supabase: SupabaseClient<Database>,
  topicRows: TutorTopicRow[],
): Promise<TutorSearchEntity[]> {
  const subjectMap = await fetchSubjectsByIds(
    supabase,
    [...new Set(topicRows.map((topic) => topic.subject_id).filter((id): id is string => Boolean(id)))],
  );

  const results: TutorSearchEntity[] = [];
  for (const topic of topicRows.slice(0, SEARCH_LIMIT)) {
    const subjectId = topic.subject_id;
    if (!subjectId || !topic.code) continue;
    const subject = subjectMap.get(subjectId);
    if (!subject) continue;

    results.push({
      type: 'flashcards',
      id: `flashcards-${topic.id}`,
      data: {
        topic: { id: topic.id, code: topic.code, name: topic.name },
        subject: toSubjectSummary(subject),
      },
    });
  }
  return results;
}

async function searchFiles(supabase: SupabaseClient<Database>, search: string): Promise<TutorSearchEntity[]> {
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
      .limit(SEARCH_LIMIT);

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
      .limit(SEARCH_LIMIT);

    if (error) throw error;

    fileRows = (data ?? []).filter(
      (row): row is TutorTopicFileRow & { id: string; topic_id: string } =>
        Boolean(row.id && row.topic_id),
    );
  }

  const topicIds = [...new Set(fileRows.map((file) => file.topic_id))];
  if (topicIds.length === 0) return [];

  const { data: topicData, error: topicError } = await supabase
    .from('vtutor_topics')
    .select('*')
    .in('id', topicIds);
  if (topicError) throw topicError;

  const topicMap = new Map<string, TutorTopicRow>();
  for (const row of topicData ?? []) {
    if (row.id) topicMap.set(row.id, row as TutorTopicRow);
  }

  const subjectMap = await fetchSubjectsByIds(
    supabase,
    [...new Set([...topicMap.values()].map((topic) => topic.subject_id).filter((id): id is string => Boolean(id)))],
  );

  const results: TutorSearchEntity[] = [];
  for (const file of fileRows) {
    const topic = topicMap.get(file.topic_id);
    if (!topic?.code || !topic.subject_id) continue;
    const subject = subjectMap.get(topic.subject_id);
    if (!subject || !file.code) continue;

    const subjectSummary = toSubjectSummary(subject);
    results.push({
      type: 'file',
      id: file.id,
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

async function searchClasses(supabase: SupabaseClient<Database>, search: string): Promise<TutorSearchEntity[]> {
  const pattern = quotePostgrestFilterValue(`%${escapeIlikePattern(search)}%`);
  const { data, error } = await supabase
    .from('vtutor_classes')
    .select('*')
    .or(`short_name.ilike.${pattern},long_name.ilike.${pattern},subject_name.ilike.${pattern}`)
    .limit(SEARCH_LIMIT);

  if (error) throw error;

  const results: TutorSearchEntity[] = [];
  for (const row of data ?? []) {
    if (!row.id) continue;
    const classRow = row as TutorClassRow;
    results.push({
      type: 'class',
      id: classRow.id,
      data: classRow,
    });
  }
  return results;
}

export async function searchTutorEntities(
  supabase: SupabaseClient<Database>,
  search: string,
  types: readonly string[] = TUTOR_ENTITY_SEARCH_TYPES,
): Promise<TutorSearchEntity[]> {
  const trimmed = search.trim();
  if (trimmed.length < 2) return [];

  const needsTopics = types.includes('topics') || types.includes('flashcards');
  const searchJobs: Promise<TutorSearchEntity[]>[] = [];

  if (types.includes('subjects')) {
    searchJobs.push(searchSubjects(supabase, trimmed));
  }

  if (types.includes('files')) {
    searchJobs.push(searchFiles(supabase, trimmed));
  }

  if (types.includes('classes')) {
    searchJobs.push(searchClasses(supabase, trimmed));
  }

  let topicRowsPromise: Promise<TutorTopicRow[]> | null = null;
  if (needsTopics) {
    topicRowsPromise = searchTopics(supabase, trimmed);
  }

  const [parallelResults, topicRows] = await Promise.all([
    Promise.all(searchJobs),
    topicRowsPromise,
  ]);

  const results = parallelResults.flat();

  if (topicRows) {
    if (types.includes('topics')) {
      results.push(...(await mapTopicsToResults(supabase, topicRows)));
    }
    if (types.includes('flashcards')) {
      results.push(...(await mapTopicsToFlashcardResults(supabase, topicRows)));
    }
  }

  return results;
}
