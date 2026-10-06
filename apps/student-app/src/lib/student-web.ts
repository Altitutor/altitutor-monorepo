import { resolveServerUrl } from '@/lib/development-server-url';

export const authConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.EXPO_PUBLIC_STUDENT_WEB_URL,
);

export function studentWebUrl(path: string): string {
  const origin = process.env.EXPO_PUBLIC_STUDENT_WEB_URL;
  if (!origin) throw new Error('The student portal is not configured.');
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid student portal path.');
  return new URL(path, resolveServerUrl(origin)).toString();
}
