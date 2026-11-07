import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { z } from 'zod';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { TeachingError } from './auth';
import { requireUUID } from './validation';

const id = z.string().guid().transform(value => value.toLowerCase());
const uploadSchema = z.object({
  sessionID: id, documentID: id, purpose: z.enum(['print', 'lesson', 'workspace']),
  canonicalResourceID: id.optional(), filename: z.string().trim().min(1).max(180),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export async function stageTeachingUpload(client: SupabaseClient<Database>, ownerID: string, body: unknown) {
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) throw new TeachingError(400, 'Choose a PDF smaller than 50 MB.');
  const input = parsed.data;
  if (input.purpose === 'workspace' && input.canonicalResourceID) {
    throw new TeachingError(400, 'Choose an original lesson PDF.');
  }
  const session = await client.from('vtutor_operational_session_detail').select('session_id')
    .eq('session_id', input.sessionID).maybeSingle();
  if (session.error) throw new TeachingError(503, 'Could not verify lesson access.', session.error);
  if (!session.data) throw new TeachingError(403, 'You do not have access to this lesson.');
  if (input.canonicalResourceID) {
    const resource = await client.from('vtutor_topics_files').select('id,is_solutions,is_solutions_of_id')
      .eq('id', input.canonicalResourceID).is('deleted_at', null).maybeSingle();
    if (resource.error) throw new TeachingError(503, 'Could not verify the source worksheet.', resource.error);
    if (!resource.data || resource.data.is_solutions || resource.data.is_solutions_of_id) {
      throw new TeachingError(403, 'Choose an accessible worksheet. Solutions cannot be published.');
    }
  }
  const filename = input.filename.split(/[\\/]/).at(-1)?.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!filename || !filename.toLowerCase().endsWith('.pdf')) throw new TeachingError(400, 'Choose a PDF filename.');
  const service = getServiceRoleClient();
  const privacy = await service.rpc('teaching_private_storage_ready');
  if (privacy.error || !privacy.data) throw new TeachingError(503, 'Private lesson uploads are not configured yet.');
  const staged = await service.rpc('stage_teaching_document', { p_owner_staff_id: ownerID, p_input: { ...input, filename } });
  if (staged.error) throw new TeachingError(503, 'Could not prepare the private upload.', staged.error);
  const artifact = staged.data;
  if (['ready', 'published'].includes(artifact.state)) return { id: artifact.id, uploadURL: null };
  const signed = await service.storage.from(artifact.bucket).createSignedUploadUrl(artifact.storage_path, { upsert: false });
  if (signed.error) throw new TeachingError(503, 'Could not prepare the private upload.', signed.error);
  return { id: artifact.id, uploadURL: signed.data.signedUrl };
}

/** Storage paths come only from the owned row; a client never chooses a download URL. */
export async function completeTeachingUpload(client: SupabaseClient<Database>, artifactID: string) {
  const owned = await client.from('vtutor_teaching_uploads').select('*').eq('id', requireUUID(artifactID)).maybeSingle();
  if (owned.error) throw new TeachingError(503, 'Could not verify the private upload.', owned.error);
  const row = owned.data;
  if (!row?.id || !row.session_id || !row.expires_at || new Date(row.expires_at).getTime() <= Date.now() || !['staged', 'ready', 'published'].includes(row.state ?? '')) {
    throw new TeachingError(404, 'This private upload is not available.');
  }
  const session = await client.from('vtutor_operational_session_detail').select('session_id').eq('session_id', row.session_id).maybeSingle();
  if (session.error) throw new TeachingError(503, 'Could not verify lesson access.', session.error);
  if (!session.data) throw new TeachingError(403, 'You do not have access to this lesson.');
  if (row.state === 'ready' || row.state === 'published') return { id: row.id, state: row.state };
  const service = getServiceRoleClient();
  const artifact = await service.from('teaching_documents').select('bucket,storage_path').eq('id', row.id).single();
  if (artifact.error) throw new TeachingError(503, 'Could not read the private upload.', artifact.error);
  const download = await service.storage.from(artifact.data.bucket).download(artifact.data.storage_path);
  if (download.error) throw new TeachingError(409, 'Finish uploading the PDF before continuing.');
  const bytes = Buffer.from(await download.data.arrayBuffer());
  if (bytes.length !== row.size_bytes || bytes.length > 50 * 1024 * 1024 ||
      !bytes.subarray(0, 8).toString('ascii').startsWith('%PDF-') ||
      !bytes.subarray(Math.max(0, bytes.length - 1024)).toString('ascii').includes('%%EOF') ||
      createHash('sha256').update(bytes).digest('hex') !== row.sha256) {
    const rejected = await service.from('teaching_documents').update({ state: 'deleting' }).eq('id', row.id).eq('state', 'staged');
    if (rejected.error) throw new TeachingError(503, 'Could not reject the mismatched upload.', rejected.error);
    throw new TeachingError(400, 'The uploaded PDF did not match its preview. Select the document again.');
  }
  const verified = await service.from('teaching_documents').update({ state: 'ready', verified_at: new Date().toISOString() })
    .eq('id', row.id).eq('state', 'staged').is('cleanup_claimed_at', null).gt('expires_at', new Date().toISOString()).select('id,state').maybeSingle();
  if (verified.error) throw new TeachingError(503, 'Could not finish verifying the PDF.', verified.error);
  if (verified.data) return verified.data;
  // Another completion may have verified these same immutable bytes while we downloaded.
  const current = await client.from('vtutor_teaching_uploads').select('id,state,expires_at')
    .eq('id', row.id).in('state', ['ready', 'published']).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (current.error) throw new TeachingError(503, 'Could not confirm the private upload.', current.error);
  if (!current.data?.id || !current.data.state) throw new TeachingError(409, 'The private upload expired. Select the document again.');
  return { id: current.data.id, state: current.data.state };
}
