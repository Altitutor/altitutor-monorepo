import type { ResourceSubject } from './types';

const DEFAULT_UCAT_WEB_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3004'
    : 'https://ucat.altitutor.com';

export function isUcatSubject(
  subject: Pick<ResourceSubject, 'name' | 'short_name' | 'long_name'>
): boolean {
  return [subject.short_name, subject.name, subject.long_name].some(
    (value) => value?.trim().toLowerCase() === 'ucat'
  );
}

export function getUcatSessionsUrl(
  ucatWebUrl = process.env.NEXT_PUBLIC_UCAT_URL || DEFAULT_UCAT_WEB_URL
): string {
  const url = new URL('/login', ucatWebUrl);
  url.searchParams.set('redirect', '/sessions');
  return url.toString();
}
