import {
  getResourceSubjectHref,
  getResourceSubjectSlug,
  isResourceSubjectNavActive,
  type ResourceSubjectNavInput,
} from '@altitutor/shared';

export * from '@altitutor/shared';

export function isUcatResourceSubject(
  subject: Pick<ResourceSubjectNavInput, 'short_name' | 'name'>,
): boolean {
  return getResourceSubjectSlug(subject) === 'ucat';
}

/** UCAT content lives under /ucat, not /resources/ucat. */
export function getTutorResourceSubjectHref(
  subject: Pick<ResourceSubjectNavInput, 'short_name' | 'name'>,
): string {
  if (isUcatResourceSubject(subject)) return '/ucat';
  return getResourceSubjectHref(subject);
}

export function isTutorResourceSubjectNavActive(
  pathname: string,
  subject: Pick<ResourceSubjectNavInput, 'short_name' | 'name'>,
): boolean {
  if (isUcatResourceSubject(subject)) {
    return pathname === '/ucat' || pathname.startsWith('/ucat/');
  }
  return isResourceSubjectNavActive(pathname, getResourceSubjectHref(subject));
}
