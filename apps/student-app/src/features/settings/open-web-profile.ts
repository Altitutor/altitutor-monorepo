import { openBrowserAsync } from 'expo-web-browser';
import { Alert } from 'react-native';

import { studentWebUrl } from '@/lib/student-web';
import { supabase } from '@/lib/supabase';

const allowedPaths = new Set(['/settings/profile', '/settings/flashcards']);

async function freshAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session) throw new Error('Please sign in to continue.');
  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs - Date.now() > 60_000) return session.access_token;
  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session) throw new Error('Please sign in to continue.');
  return refreshed.data.session.access_token;
}

export async function openStudentWebPage(path: '/settings/profile' | '/settings/flashcards') {
  try {
    if (!allowedPaths.has(path)) throw new Error('This page cannot be opened from the app.');
    const accessToken = await freshAccessToken();
    const response = await fetch(studentWebUrl('/api/auth/browser/ticket'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ path }),
      credentials: 'omit',
      signal: AbortSignal.timeout(30000),
    });
    const body: unknown = await response.json();
    if (
      !response.ok ||
      !body ||
      typeof body !== 'object' ||
      !('ticket' in body) ||
      typeof body.ticket !== 'string'
    ) {
      throw new Error('Unable to open your account. Please try again.');
    }
    await openBrowserAsync(`${studentWebUrl('/mobile-browser')}#ticket=${encodeURIComponent(body.ticket)}`);
    return true;
  } catch (error) {
    Alert.alert('Unable to open page', error instanceof Error ? error.message : 'Please try again.');
    return false;
  }
}

export function openWebProfile() {
  return openStudentWebPage('/settings/profile');
}
