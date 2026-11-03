import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../supabase/generated';
import type { SharedLessonDocument } from '../types';

type Client = SupabaseClient<Database>;
type Audience = 'tutor' | 'student';
export class LessonDocumentError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
function identifier(value: string | null): string {
  if (!value || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)) throw new LessonDocumentError(400, 'Choose a valid lesson or PDF.');
  return value.toLowerCase();
}
const view = (audience: Audience) => audience === 'tutor' ? 'vtutor_lesson_documents' : 'vstudent_lesson_documents';

export async function listLessonDocuments(client: Client, sessionID: string, audience: Audience): Promise<SharedLessonDocument[]> {
  const result = await client.from(view(audience)).select('*').eq('session_id', identifier(sessionID)).order('published_at').order('id').limit(100);
  if (result.error) throw new LessonDocumentError(503, 'Could not load the shared lesson PDFs.');
  return (result.data ?? []).flatMap(row => row.id && row.session_id && row.filename && row.published_at && row.expires_at ? [{
    id: row.id, sessionID: row.session_id, canonicalResourceID: row.canonical_topics_file_id,
    filename: row.filename, publishedAt: row.published_at, expiresAt: row.expires_at, available: row.available === true,
  }] : []);
}
export async function lessonDocumentURL(client: Client, service: Client, artifactID: string, audience: Audience) {
  const id = identifier(artifactID);
  const visible = await client.from(view(audience)).select('id,available').eq('id', id).maybeSingle();
  if (visible.error) throw new LessonDocumentError(503, 'Could not verify access to this lesson PDF.');
  if (!visible.data) throw new LessonDocumentError(404, 'This lesson PDF is not available.');
  if (!visible.data.available) throw new LessonDocumentError(410, 'This lesson PDF has expired.');
  const artifact = await service.from('teaching_documents').select('bucket,storage_path,expires_at')
    .eq('id', id).eq('purpose', 'lesson').eq('state', 'published').is('deleted_at', null).maybeSingle();
  if (artifact.error) throw new LessonDocumentError(503, 'Could not open this lesson PDF.');
  const lifetime = Math.min(60, Math.floor((new Date(artifact.data?.expires_at ?? 0).getTime() - Date.now()) / 1000));
  if (!artifact.data || lifetime < 1) throw new LessonDocumentError(410, 'This lesson PDF has expired.');
  const signed = await service.storage.from(artifact.data.bucket).createSignedUrl(artifact.data.storage_path, lifetime);
  if (signed.error) throw new LessonDocumentError(503, 'Could not open this lesson PDF.');
  return { url: signed.data.signedUrl };
}

/** Shared cookie/Bearer route adapter; Storage signing follows the caller-scoped view. */
export async function lessonDocumentsResponse(request: Request, client: Client, service: Client, audience: Audience) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    const user = await client.auth.getUser(token);
    if (user.error || !user.data.user) {
      const unavailable = (user.error?.status ?? 0) >= 500 || user.error?.name === 'AuthRetryableFetchError';
      throw new LessonDocumentError(unavailable ? 503 : 401, unavailable ? 'Sign-in verification is temporarily unavailable.' : 'Sign in to open lesson PDFs.');
    }
    const allowed = await client.rpc(audience === 'tutor' ? 'is_tutor' : 'is_student');
    if (allowed.error) throw new LessonDocumentError(503, 'Could not verify portal access.');
    if (!allowed.data) throw new LessonDocumentError(403, 'This account cannot open these lesson PDFs.');
    const url = new URL(request.url);
    const tail = url.pathname.slice('/api/lesson-documents'.length).replace(/\/$/, '');
    if (!tail) return Response.json(await listLessonDocuments(client, identifier(url.searchParams.get('sessionID')), audience), { headers });
    const match = /^\/([^/]+)(\/download)?$/.exec(tail);
    if (!match) throw new LessonDocumentError(404, 'This lesson PDF is not available.');
    const link = await lessonDocumentURL(client, service, match[1], audience);
    return match[2] ? new Response(null, { status: 303, headers: { ...headers, Location: link.url } }) : Response.json(link, { headers });
  } catch (error) {
    if (!(error instanceof LessonDocumentError)) throw error;
    return Response.json({ error: error.message }, { status: error.status, headers });
  }
}

/** Bounded, retryable blob cleanup; audit rows and pending print copies remain. */
export async function expireTeachingDocuments(client: SupabaseClient<Database>, options: {
  deadlineAt?: number; limit?: number; onFailure?: () => void;
} = {}): Promise<{ removed: number; failed: number }> {
  const deadline = options.deadlineAt ?? Date.now() + 45_000;
  if (Date.now() >= deadline) return { removed: 0, failed: 0 };
  const claimed = await client.rpc('claim_teaching_document_expiry', { p_limit: options.limit ?? 20 });
  if (claimed.error) throw claimed.error;
  let removed = 0, failed = 0;
  for (const artifact of claimed.data ?? []) {
    if (Date.now() >= deadline) break;
    try {
      const result = await client.storage.from(artifact.bucket).remove([artifact.storage_path]);
      if (result.error) throw result.error;
      const finished = await client.rpc('finish_teaching_document_expiry', { p_artifact_id: artifact.id });
      if (finished.error) throw finished.error;
      removed += 1;
    } catch {
      failed += 1;
      options.onFailure?.();
      const delay = Math.min(24 * 60 * 60_000, 5 * 60_000 * 2 ** Math.min(9, Math.max(0, artifact.cleanup_attempts - 1)));
      // Claim already persisted a retry before I/O; a failed backoff update still retries.
      await client.from('teaching_documents').update({ cleanup_next_attempt_at: new Date(Date.now() + delay).toISOString() })
        .eq('id', artifact.id).eq('state', 'deleting');
    }
  }
  return { removed, failed };
}

