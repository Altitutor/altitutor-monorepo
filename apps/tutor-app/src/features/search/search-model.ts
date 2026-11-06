import {
  formatResourceTypeLabel,
  getResourceSubjectNavLabel,
  getResourceSubjectSlug,
  parseSubjectQualifiedSearch,
  TUTOR_ENTITY_SEARCH_TYPES,
  type TutorSearchEntity,
} from '@altitutor/shared';
import type { Href } from 'expo-router';

import type { ResourceSubject } from '@/features/resources/resources-api';

type SearchSubject = Pick<ResourceSubject, 'id' | 'name' | 'short_name' | 'long_name' | 'curriculum'>;

type EntityScope = (typeof TUTOR_ENTITY_SEARCH_TYPES)[number];
export type SearchScope = 'pages' | EntityScope;

type Destination =
  | { href: Href; webPath?: never }
  | { href?: never; webPath: string };

type SearchItem = {
  id: string;
  title: string;
  detail?: string;
  keywords?: string[];
  destination: Destination;
};

export const searchScopes: Record<SearchScope, string> = {
  pages: 'Pages',
  subjects: 'Subjects',
  topics: 'Topics',
  files: 'Files',
  flashcards: 'Flashcards',
  classes: 'Classes',
};

const allScopes = Object.keys(searchScopes) as SearchScope[];
const qualifiedScopes: SearchScope[] = ['topics', 'files', 'flashcards'];

export function toggleSearchScope(current: SearchScope[], scope?: SearchScope) {
  if (!scope) return allScopes;
  if (current.length === 0 || current.length === allScopes.length) return [scope];
  const next = current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope];
  return next.length ? next : allScopes;
}

export function getEffectiveSearchScopes(selected: SearchScope[], input: string): SearchScope[] {
  const scopes = selected.length ? selected : allScopes;
  return parseSubjectQualifiedSearch(input).mode === 'qualified'
    ? [...new Set([...scopes, ...qualifiedScopes])]
    : scopes;
}

const pages: SearchItem[] = [
  { id: 'home', title: 'Home', keywords: ['dashboard', 'updates', 'unlogged sessions'], destination: { href: '/' } },
  { id: 'classes', title: 'Classes', keywords: ['schedule', 'sessions'], destination: { href: '/classes' } },
  { id: 'documentation', title: 'Documentation', keywords: ['policy', 'guides', 'notes'], destination: { href: '/documentation' } },
  { id: 'resources', title: 'Resources', keywords: ['subjects', 'topics', 'files'], destination: { href: '/resources' } },
  { id: 'settings', title: 'Settings', destination: { href: '/settings' } },
  { id: 'profile', title: 'My profile', keywords: ['account'], destination: { href: '/settings/profile' } },
  { id: 'pay-tier', title: 'Pay tier', keywords: ['pay', 'salary', 'wage'], destination: { webPath: '/pay-tier' } },
  { id: 'blockouts', title: 'Blockout dates', keywords: ['blockout', 'unavailable'], destination: { webPath: '/settings/blockouts' } },
];

function subjectHref(subjectId: string): Href {
  return { pathname: '/resource-subject/[subjectId]', params: { subjectId } };
}

function score(item: SearchItem, query: string): number {
  const title = item.title.toLowerCase();
  if (title === query) return 4;
  if (title.startsWith(query)) return 3;
  if (title.includes(query)) return 2;
  if ([item.detail, ...(item.keywords ?? [])].some((value) => value?.toLowerCase().includes(query))) return 1;
  return 0;
}

export function searchPages(input: string, subjects: SearchSubject[] = []): SearchItem[] {
  const subjectPages: SearchItem[] = subjects.map((subject) => ({
    id: `subject-page-${subject.id}`,
    title: getResourceSubjectNavLabel(subject),
    detail: subject.curriculum ?? undefined,
    keywords: [subject.short_name, subject.name, subject.long_name].filter((value): value is string => Boolean(value)),
    destination: { href: subjectHref(subject.id) },
  }));
  const candidates = [...pages, ...subjectPages];
  const query = input.trim().toLowerCase();
  if (!query) return candidates;
  return candidates.filter((page) => score(page, query) > 0).sort((a, b) => score(b, query) - score(a, query));
}

function subjectLabel(subject: { short_name: string | null; name: string | null; long_name: string | null }) {
  return subject.short_name || getResourceSubjectNavLabel(subject);
}

function toItem(entity: TutorSearchEntity): (SearchItem & { scope: EntityScope }) | null {
  switch (entity.type) {
    case 'subject':
      if (getResourceSubjectSlug(entity.data) === 'ucat') return null;
      return {
        scope: 'subjects',
        id: entity.id,
        title: getResourceSubjectNavLabel(entity.data),
        detail: entity.data.curriculum ?? undefined,
        destination: { href: subjectHref(entity.id) },
      };
    case 'topic': {
      const { code, name, subject } = entity.data;
      return {
        scope: 'topics',
        id: entity.id,
        title: [code, name].filter(Boolean).join(' ') || 'Topic',
        detail: subjectLabel(subject),
        destination: { href: { pathname: '/resource-topic/[topicId]', params: { topicId: entity.id } } },
      };
    }
    case 'file': {
      const { code, filename, type, subject, topic } = entity.data;
      return {
        scope: 'files',
        id: entity.id,
        title: [code, topic.name, formatResourceTypeLabel(type)].filter(Boolean).join(' '),
        detail: [subjectLabel(subject), filename].filter(Boolean).join(' · '),
        destination: { href: { pathname: '/resource-file/[fileId]', params: { fileId: entity.id } } },
      };
    }
    case 'flashcards': {
      const { subject, topic } = entity.data;
      const slug = getResourceSubjectSlug(subject);
      if (!slug || !topic.code) return null;
      return {
        scope: 'flashcards',
        id: entity.id,
        title: ['Flashcards', topic.code, topic.name].filter(Boolean).join(' · '),
        detail: subjectLabel(subject),
        destination: { webPath: `/resources/${encodeURIComponent(slug)}/${encodeURIComponent(topic.code)}/flashcards` },
      };
    }
    case 'class':
      return {
        scope: 'classes',
        id: entity.id,
        title: entity.data.short_name || entity.data.long_name || 'Class',
        detail: entity.data.long_name || entity.data.subject_name || undefined,
        destination: { href: { pathname: '/class/[classId]', params: { classId: entity.id } } },
      };
  }
}

export function groupSearchResults(
  scopes: SearchScope[],
  input: string,
  entities: TutorSearchEntity[],
  subjects?: SearchSubject[],
) {
  const query = input.trim().toLowerCase();
  const groups = new Map<SearchScope, SearchItem[]>();
  if (scopes.includes('pages')) groups.set('pages', searchPages(query, subjects));

  for (const entity of entities) {
    const item = toItem(entity);
    if (!item || !scopes.includes(item.scope)) continue;
    const group = groups.get(item.scope);
    if (group) group.push(item);
    else groups.set(item.scope, [item]);
  }

  return [...groups]
    .filter(([, items]) => items.length)
    .map(([scope, items]) => ({
      scope,
      items: query ? [...items].sort((a, b) => score(b, query) - score(a, query)) : items,
    }))
    .sort((a, b) => query ? score(b.items[0], query) - score(a.items[0], query) : 0);
}
