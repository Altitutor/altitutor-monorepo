import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { z } from 'zod';
import { readSessionLessonPlan } from '@/features/sessions/server/lesson-plans';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { TeachingError } from './auth';
import { teachingResources } from './queries';
import { requireUUID } from './validation';

type Client = SupabaseClient<Database>;
const id = z.string().guid().transform(value => value.toLowerCase());
const document = z.object({
  id, code: z.string().max(200).nullish(), title: z.string().min(1).max(250),
  mimeType: z.string().max(150), externalURL: z.string().max(2048).nullish(),
}).strict();
const cachedPDF = z.object({ id, source: document.refine(source =>
  !source.externalURL && (source.mimeType === 'application/pdf' || source.title.toLowerCase().endsWith('.pdf'))
) }).strict();
const resource = z.object({
  id, topicID: id, topicName: z.string().max(250), subjectID: id, subjectName: z.string().max(250),
  resourceType: z.string().max(100).nullish(), resourceIndex: z.number().int().nullish(),
  worksheet: document, solutions: document.nullish(),
}).strict();
const registration = z.object({
  sessionID: id, worksheetArtifactID: id, solutionsArtifactID: id.optional(),
  item: z.object({
    id, workspaceID: id.optional(), resource: resource.optional(), worksheet: cachedPDF, solutions: cachedPDF.optional(),
  }).strict(),
}).strict().refine(input => Boolean(input.solutionsArtifactID) === Boolean(input.item.solutions));

function check(error: { code?: string; message: string } | null) {
  if (error) throw new TeachingError(503, 'Lesson documents are temporarily unavailable.', error);
}

async function scopedSession(client: Client, sessionID: string) {
  const result = await client.from('vtutor_operational_session_detail').select('session_id')
    .eq('session_id', requireUUID(sessionID)).maybeSingle();
  check(result.error);
  if (!result.data) throw new TeachingError(404, 'This teaching session is unavailable.');
  return result.data;
}

async function workspaceResources(client: Client, sessionID: string) {
  const resources = [];
  for (let offset = 0; ; offset += 100) {
    const result = await client.from('vtutor_teaching_workspace_resources')
      .select('item,worksheet_artifact_id,solutions_artifact_id')
      .eq('session_id', sessionID).order('created_at').order('item_id').range(offset, offset + 99);
    check(result.error);
    const rows = result.data ?? [];
    resources.push(...rows.map(row => ({
      item: row.item, worksheetArtifactID: row.worksheet_artifact_id, solutionsArtifactID: row.solutions_artifact_id,
    })));
    if (rows.length < 100) return resources;
  }
}

export async function readTeachingWorkspace(client: Client, sessionID: string) {
  await scopedSession(client, sessionID);
  return workspaceResources(client, sessionID);
}

export async function registerTeachingWorkspace(client: Client, staffID: string, body: unknown) {
  const parsed = registration.safeParse(body);
  if (!parsed.success) throw new TeachingError(400, 'Choose a valid lesson document.');
  const { item, sessionID, worksheetArtifactID, solutionsArtifactID } = parsed.data;
  await scopedSession(client, sessionID);
  const result = await getServiceRoleClient().rpc('register_teaching_workspace_resource', {
    p_owner_staff_id: staffID, p_session_id: sessionID, p_item_id: item.workspaceID ?? item.resource?.id ?? item.id,
    p_item: item, p_worksheet: worksheetArtifactID, ...(solutionsArtifactID ? { p_solutions: solutionsArtifactID } : {}),
  });
  if (result.error?.code === '42501') throw new TeachingError(403, 'This original PDF is not available to sync.');
  check(result.error);
  return { success: true };
}

export async function teachingWorkspaceDownload(client: Client, staffID: string, artifactID: string) {
  const id = requireUUID(artifactID);
  const visible = await client.from('vtutor_teaching_workspace_resources').select('item_id')
    .or(`worksheet_artifact_id.eq.${id},solutions_artifact_id.eq.${id}`).limit(1).maybeSingle();
  check(visible.error);
  if (!visible.data) throw new TeachingError(404, 'This original PDF is unavailable.');
  const service = getServiceRoleClient();
  const stored = await service.from('teaching_documents').select('bucket,storage_path')
    .eq('id', id).eq('owner_staff_id', staffID).eq('purpose', 'workspace').eq('state', 'published')
    .is('deleted_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  check(stored.error);
  if (!stored.data) throw new TeachingError(404, 'This original PDF is unavailable.');
  const signed = await service.storage.from(stored.data.bucket).createSignedUrl(stored.data.storage_path, 300);
  check(signed.error);
  if (!signed.data) throw new TeachingError(503, 'Could not prepare the original PDF.');
  return { url: signed.data.signedUrl, external: false };
}

export async function previousTeachingLesson(client: Client, sessionID: string) {
  await scopedSession(client, sessionID);
  const previous = await client.from('vtutor_teaching_previous_lessons')
    .select('previous_session_id,catalog_resource_ids').eq('session_id', sessionID).maybeSingle();
  check(previous.error);
  const previousID = previous.data?.previous_session_id;
  if (!previousID) return null;
  const [workspace, priorPlan] = await Promise.all([
    workspaceResources(client, previousID),
    client.from('vtutor_session_lesson_plans').select('session_id').eq('session_id', previousID).maybeSingle(),
  ]);
  check(priorPlan.error);
  const planned = priorPlan.data ? (await readSessionLessonPlan(client, previousID)).resources : [];
  const plannedIDs = new Set(planned.map(item => item.id));
  const catalogIDs = (previous.data?.catalog_resource_ids ?? []).filter(id => !plannedIDs.has(id));
  const catalog = [];
  for (let offset = 0; offset < catalogIDs.length; offset += 50) {
    const page = await teachingResources(client, new URLSearchParams({ resourceIDs: catalogIDs.slice(offset, offset + 50).join(',') }));
    catalog.push(...page.resources);
  }
  return { sessionID: previousID, workspace, planned, catalog };
}
