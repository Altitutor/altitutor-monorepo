import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { z } from 'zod';
import { TeachingError } from '@/features/teaching/server/auth';
import { requireUUID } from '@/features/teaching/server/validation';
import type {
  PlannedDocument,
  PlannedResource,
  SessionLessonPlan,
} from '../types/lesson-plan';

type Client = SupabaseClient<Database>;
type DocumentRow =
  Database['public']['Views']['vtutor_session_lesson_plan_documents']['Row'];
const id = z
  .string()
  .guid()
  .transform((value) => value.toLowerCase());
export const lessonPlanInput = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    topicIds: z.array(id).max(100),
    fileIds: z.array(id).max(50),
  })
  .strict();

function dependency(error: { message: string } | null) {
  if (error)
    throw new TeachingError(
      503,
      'Lesson planning is temporarily unavailable.',
      error,
    );
}
function document(row: DocumentRow): PlannedDocument {
  if (!row.id)
    throw new TeachingError(503, 'A planned document is unavailable.');
  return {
    id: row.id,
    code: row.code,
    title: row.filename || row.code || 'Resource',
    mimeType: row.mimetype || 'application/octet-stream',
    externalURL:
      row.external_url && /^https?:\/\//i.test(row.external_url)
        ? row.external_url
        : null,
  };
}

export async function readSessionLessonPlan(
  client: Client,
  sessionID: string,
): Promise<SessionLessonPlan> {
  requireUUID(sessionID);
  const header = () =>
    client
      .from('vtutor_session_lesson_plans')
      .select('session_id,revision,updated_at')
      .eq('session_id', sessionID)
      .maybeSingle();
  for (let attempt = 0; attempt < 3; attempt++) {
    // Bound the independent facade reads with a monotonic revision check.
    // A mixed snapshot must never carry a newer revision into a later save.
    const plan = await header();
    dependency(plan.error);
    if (!plan.data)
      throw new TeachingError(404, 'This teaching session is unavailable.');
    const [topics, documents] = await Promise.all([
      client
        .from('vtutor_session_lesson_plan_topics')
        .select('id,name,code')
        .eq('session_id', sessionID)
        .order('id'),
      client
        .from('vtutor_session_lesson_plan_documents')
        .select('*')
        .eq('session_id', sessionID)
        .order('id'),
    ]);
    dependency(topics.error);
    dependency(documents.error);
    const after = await header();
    dependency(after.error);
    if (!after.data)
      throw new TeachingError(404, 'This teaching session is unavailable.');
    if (after.data.revision !== plan.data.revision) continue;
    const rows = documents.data ?? [];
    const resources: PlannedResource[] = rows.flatMap((row) => {
      if (row.id !== row.resource_id) return [];
      if (!row.id || !row.topic_id || !row.subject_id)
        throw new TeachingError(503, 'A planned resource is unavailable.');
      const answer = rows.find(
        (candidate) =>
          candidate.resource_id === row.id &&
          candidate.is_solutions_of_id === row.id,
      );
      return [
        {
          id: row.id,
          topicID: row.topic_id,
          topicName: row.topic_name ?? 'Topic',
          subjectID: row.subject_id,
          subjectName: row.subject_name ?? 'Subject',
          worksheet: document(row),
          solutions: answer ? document(answer) : null,
        },
      ];
    });
    return {
      sessionID,
      revision: plan.data.revision ?? 0,
      updatedAt: plan.data.updated_at,
      topics: (topics.data ?? []).flatMap((topic) =>
        topic.id
          ? [{ id: topic.id, name: topic.name ?? 'Topic', code: topic.code }]
          : [],
      ),
      resources,
    };
  }
  throw new TeachingError(
    409,
    'The plan is changing. Please reload and try again.',
  );
}

export async function saveSessionLessonPlan(
  client: Client,
  service: Client,
  actorID: string,
  sessionID: string,
  body: unknown,
) {
  const parsed = lessonPlanInput.safeParse(body);
  if (!parsed.success)
    throw new TeachingError(400, 'Choose valid topics and catalog files.');
  const current = await readSessionLessonPlan(client, sessionID);
  const topicIDs = [...new Set(parsed.data.topicIds)],
    fileIDs = [...new Set(parsed.data.fileIds)];
  const [topics, files] = await Promise.all([
    topicIDs.length
      ? client.from('vtutor_topics').select('id').in('id', topicIDs)
      : { data: [], error: null },
    fileIDs.length
      ? client
          .from('vtutor_topics_files')
          .select('id')
          .in('id', fileIDs)
          .is('deleted_at', null)
          .is('is_solutions_of_id', null)
          .eq('is_solutions', false)
      : { data: [], error: null },
  ]);
  dependency(topics.error);
  dependency(files.error);
  const allowedTopics = new Set([
    ...current.topics.map((topic) => topic.id),
    ...(topics.data ?? []).flatMap((topic) => (topic.id ? [topic.id] : [])),
  ]);
  const allowedFiles = new Set([
    ...current.resources.map((resource) => resource.id),
    ...(files.data ?? []).flatMap((file) => (file.id ? [file.id] : [])),
  ]);
  if (
    topicIDs.some((value) => !allowedTopics.has(value)) ||
    fileIDs.some((value) => !allowedFiles.has(value))
  ) {
    throw new TeachingError(
      403,
      'A selected topic or resource is not accessible.',
    );
  }
  const result = await service.rpc('save_session_lesson_plan', {
    p_session_id: sessionID,
    p_actor_id: actorID,
    p_expected_revision: parsed.data.expectedRevision,
    p_topic_ids: topicIDs,
    p_file_ids: fileIDs,
  });
  if (result.error?.code === 'PT409')
    throw new TeachingError(409, result.error.message);
  if (result.error?.code === '42501')
    throw new TeachingError(403, 'Assigned active tutor access is required.');
  if (result.error?.code === 'PT400')
    throw new TeachingError(400, result.error.message);
  dependency(result.error);
  return readSessionLessonPlan(client, sessionID);
}
