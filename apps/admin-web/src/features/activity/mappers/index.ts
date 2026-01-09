export { mapActivityEventToDisplay, mapActivityEventsToDisplay } from './activityEventMapper';
export { getActivityTemplate, getGroupedActivityTemplate, FIELD_LABELS } from './activityMessageTemplates';
export type { ActivityMessageContext } from './activityMessageTemplates';
export { coalesceRelatedEvents, EVENT_PATTERNS, createCoalescedEvent } from './activityEventCoalescer';
export type { EventPattern, PatternMatcher, PatternCoalescer } from './activityEventCoalescer';

