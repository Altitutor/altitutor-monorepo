import { resolveServerUrl } from '@/lib/development-server-url';
import { supabase } from '@/lib/supabase';

export function tutorWebUrl(path: string) {
  const configuredOrigin = process.env.EXPO_PUBLIC_TUTOR_WEB_URL;
  if (!configuredOrigin) throw new Error('The tutor portal is not configured.');
  const origin = new URL(resolveServerUrl(configuredOrigin));
  const url = new URL(path, origin);
  if (!path.startsWith('/') || url.origin !== origin.origin) {
    throw new Error('Invalid tutor portal path.');
  }
  return url.toString();
}

export async function tutorWebFetch(path: string, options: RequestInit = {}, userId?: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session || (userId && userId !== data.session.user.id)) {
    throw new Error('Sign in to continue.');
  }
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${data.session.access_token}`);
  const controller = new AbortController();
  const timeout = options.signal ? undefined : setTimeout(() => controller.abort(), 30_000);
  try {
    return await fetch(tutorWebUrl(path), {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
      redirect: 'error',
    });
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export async function tutorWebJson<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown, userId?: string): Promise<T> {
  const response = await tutorWebFetch(path, {
    method,
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  }, userId);
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof result?.error === 'string' ? result.error : 'The tutor portal could not complete the request.');
  }
  return result as T;
}
