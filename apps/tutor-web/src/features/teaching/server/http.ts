import * as Sentry from '@sentry/nextjs';
import { authenticateTeaching, teachingClient, TeachingError } from './auth';
import { authSchema, readTeachingBody, teachingLogSchema, teachingStudentSchema } from './validation';
import { teachingStudents, addTeachingStudent } from './students';
import { teachingDocumentURL, teachingLog, teachingResources, teachingSessions } from './queries';

export function teachingJSON(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function exchangeCredentials(request: Request) {
  const parsed = authSchema.safeParse(await readTeachingBody(request));
  if (!parsed.success) throw new TeachingError(400, 'Enter valid sign-in details.');
  const input = parsed.data;
  const client = teachingClient();
  const result = input.action === 'signIn'
    ? await client.auth.signInWithPassword({ email: input.email, password: input.password })
    : await client.auth.refreshSession({ refresh_token: input.refreshToken });
  if (result.error || !result.data.session) {
    const unavailable = (result.error?.status ?? 0) >= 500 || result.error?.name === 'AuthRetryableFetchError';
    throw new TeachingError(unavailable ? 503 : result.error?.status === 429 ? 429 : 401, unavailable
      ? 'Sign-in services are temporarily unavailable.'
      : input.action === 'signIn' ? 'Could not sign in. Check your email and password.' : 'Please sign in again.', unavailable ? result.error : undefined);
  }
  const session = result.data.session;
  const { profile } = await authenticateTeaching(new Request(request.url, { headers: { Authorization: `Bearer ${session.access_token}` } }));
  return teachingJSON({ profile, credentials: {
    accessToken: session.access_token, refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
  } });
}

export async function handleTeachingRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname.slice('/api/teaching'.length).replace(/\/$/, '');
    if (request.method === 'POST' && path === '/auth') return await exchangeCredentials(request);
    const { profile, client } = await authenticateTeaching(request);
    if (request.method === 'GET') {
      if (path === '/students') {
        if (!profile.canSubmitLogs) throw new TeachingError(403, 'Only active staff may manage attendance.');
        return teachingJSON(await teachingStudents(client, url.searchParams));
      }
      if (path === '/profile') return teachingJSON(profile);
      if (path === '/sessions') return teachingJSON(await teachingSessions(client, url.searchParams.get('day') ?? ''));
      if (path === '/resources') return teachingJSON(await teachingResources(client, url.searchParams));
      if (/^\/documents\/[^/]+$/.test(path)) return teachingJSON(await teachingDocumentURL(client, path.split('/')[2]));
      if (/^\/logs\/[^/]+$/.test(path)) return teachingJSON(await teachingLog(client, path.split('/')[2]));
    }
    if (request.method === 'POST' && path === '/students') {
      if (!profile.canSubmitLogs) throw new TeachingError(403, 'Only active staff may manage attendance.');
      const parsed = teachingStudentSchema.safeParse(await readTeachingBody(request));
      if (!parsed.success) throw new TeachingError(400, 'Choose a student and lesson.');
      await addTeachingStudent(client, parsed.data);
      return teachingJSON({ success: true });
    }
    if (request.method === 'POST' && path === '/logs') {
      if (!profile.canSubmitLogs) throw new TeachingError(403, 'Only active staff may submit tutor logs.');
      const parsed = teachingLogSchema.safeParse(await readTeachingBody(request));
      if (!parsed.success) throw new TeachingError(400, 'Confirm attendance and review the lesson draft.');
      const { submitTeachingLog } = await import('./logs');
      return await submitTeachingLog(request, client, parsed.data);
    }
    return teachingJSON({ error: 'Unknown teaching endpoint.' }, 404);
  } catch (error) {
    if (!(error instanceof TeachingError) || error.status >= 500) {
      const cause = error instanceof TeachingError ? error.dependency : error;
      const fields = cause && typeof cause === 'object' ? cause as Record<string, unknown> : {};
      const code = typeof fields.code === 'string' ? fields.code : typeof fields.name === 'string' ? fields.name : 'unknown';
      Sentry.captureMessage('Teaching service dependency unavailable', {
        level: 'error', fingerprint: ['teaching-service-unavailable', /^[\w-]{1,64}$/.test(code) ? code : 'unknown'],
        tags: { app: 'tutor-web', 'api.route': '/api/teaching', supabase_error_code: /^[\w-]{1,64}$/.test(code) ? code : 'unknown' },
        extra: { dependency_status: typeof fields.status === 'number' ? fields.status : undefined },
      });
    }
    return teachingJSON({ error: error instanceof TeachingError ? error.message : 'Teaching services are temporarily unavailable.' },
      error instanceof TeachingError ? error.status : 503);
  }
}
