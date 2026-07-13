import type { ActivityEventsResponse, SessionActivityResponse } from '../types';

function mergeRelatedMaps<T>(
  ...maps: Array<Record<string, T> | undefined>
): Record<string, T> | undefined {
  const merged: Record<string, T> = {};
  let hasAny = false;
  for (const map of maps) {
    if (!map) continue;
    hasAny = true;
    Object.assign(merged, map);
  }
  return hasAny ? merged : undefined;
}

/**
 * Flatten infinite-query activity pages into a single response for the feed/mapper.
 */
export function mergeActivityPages(
  pages: ActivityEventsResponse[]
): ActivityEventsResponse {
  if (pages.length === 0) {
    return { events: [], relatedEntities: {}, total: 0, hasMore: false };
  }

  const events = pages.flatMap((page) => page.events);
  const lastPage = pages[pages.length - 1];

  return {
    events,
    relatedEntities: {
      staff: mergeRelatedMaps(...pages.map((p) => p.relatedEntities.staff)),
      students: mergeRelatedMaps(...pages.map((p) => p.relatedEntities.students)),
      classes: mergeRelatedMaps(...pages.map((p) => p.relatedEntities.classes)),
      sessions: mergeRelatedMaps(...pages.map((p) => p.relatedEntities.sessions)),
      parents: mergeRelatedMaps(...pages.map((p) => p.relatedEntities.parents)),
      tasks: mergeRelatedMaps(...pages.map((p) => p.relatedEntities.tasks)),
      issues: mergeRelatedMaps(...pages.map((p) => p.relatedEntities.issues)),
      projects: mergeRelatedMaps(...pages.map((p) => p.relatedEntities.projects)),
      subjects: mergeRelatedMaps(...pages.map((p) => p.relatedEntities.subjects)),
      notes: mergeRelatedMaps(...pages.map((p) => p.relatedEntities.notes)),
    },
    studentsSubjectsToSubjectId: Object.assign(
      {},
      ...pages.map((p) => p.studentsSubjectsToSubjectId ?? {})
    ),
    tutorLogTopicNamesByEntityId: Object.assign(
      {},
      ...pages.map((p) => p.tutorLogTopicNamesByEntityId ?? {})
    ),
    total: events.length,
    hasMore: lastPage.hasMore,
  };
}

export function mergeSessionActivityPages(
  pages: SessionActivityResponse[]
): SessionActivityResponse {
  const merged = mergeActivityPages(pages);
  return {
    ...merged,
    isAdminMeetingLive: pages.some((page) => page.isAdminMeetingLive),
  };
}
