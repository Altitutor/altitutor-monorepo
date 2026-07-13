import type { ActivityEventDisplay, ActivityEventsResponse, ChangedField } from '../types';
import { formatActivityTimestamp } from '@/shared/utils/datetime';

/**
 * Pattern matcher function - determines if a sequence of events matches a pattern
 * @param events Array of events to check (should be sorted by performedAt, oldest first)
 * @param relatedEntities Related entities for context
 * @returns true if the events match the pattern
 */
export type PatternMatcher = (
  events: ActivityEventDisplay[],
  relatedEntities: ActivityEventsResponse['relatedEntities']
) => boolean;

/**
 * Pattern coalescer function - combines matching events into a single logical event
 * @param events Array of events that matched the pattern
 * @param relatedEntities Related entities for context
 * @returns A single coalesced event representing the logical action
 */
export type PatternCoalescer = (
  events: ActivityEventDisplay[],
  relatedEntities: ActivityEventsResponse['relatedEntities']
) => ActivityEventDisplay;

/**
 * Helper function to create a coalesced event with proper metadata
 * Use this in pattern coalescers to ensure consistent metadata
 */
export function createCoalescedEvent(
  events: ActivityEventDisplay[],
  patternName: string,
  coalescedEvent: Partial<ActivityEventDisplay> & {
    message: string;
    icon: ActivityEventDisplay['icon'];
    iconColor: ActivityEventDisplay['iconColor'];
  }
): ActivityEventDisplay {
  if (events.length === 0) {
    throw new Error('Cannot create coalesced event from empty array');
  }
  
  // Use earliest timestamp from matched events
  const earliestEvent = events.reduce((earliest, current) => 
    new Date(current.performedAt) < new Date(earliest.performedAt) ? current : earliest
  );
  
  // Use the first event as a base for common properties
  const baseEvent = events[0];
  
  return {
    ...baseEvent,
    ...coalescedEvent,
    performedBy: coalescedEvent.performedBy ?? bestPerformer(events),
    id: `coalesced-${patternName}-${baseEvent.id}`,
    performedAt: earliestEvent.performedAt,
    timestamp: formatActivityTimestamp(earliestEvent.performedAt),
    isCoalesced: true,
    coalescedPatternName: patternName,
    originalEvents: events, // Store original events for UI expansion
    // Clear field-level detail so the UI shows the logical action, not every column change
    changedFields: undefined,
    changedFieldName: undefined,
    changedFieldLabel: undefined,
    oldValue: undefined,
    newValue: undefined,
  };
}

/**
 * Event pattern definition for coalescing related events
 */
export interface EventPattern {
  /**
   * Unique name for this pattern (e.g., 'reschedule', 'credit_session')
   */
  name: string;
  
  /**
   * Maximum time window in milliseconds for events to be considered related
   * Default: 5000ms (5 seconds)
   */
  timeWindowMs?: number;
  
  /**
   * Minimum number of events required for this pattern
   */
  minEvents: number;
  
  /**
   * Maximum number of events this pattern can match
   */
  maxEvents?: number;
  
  /**
   * Function to check if events match this pattern
   */
  matcher: PatternMatcher;
  
  /**
   * Function to coalesce matching events into a single event
   */
  coalescer: PatternCoalescer;
}

function getChangedField(
  event: ActivityEventDisplay,
  fieldName: string
): ChangedField | undefined {
  return event.changedFields?.find((field) => field.fieldName === fieldName);
}

function hasBooleanFieldChange(
  event: ActivityEventDisplay,
  fieldName: string,
  newValue: boolean
): boolean {
  const field = getChangedField(event, fieldName);
  return field?.newValue === String(newValue);
}

function hasField(event: ActivityEventDisplay, fieldName: string): boolean {
  return Boolean(getChangedField(event, fieldName));
}

function performerName(event: ActivityEventDisplay): string {
  return event.performedBy.name || 'System';
}

function isResolvedStaffPerformer(event: ActivityEventDisplay): boolean {
  const name = event.performedBy.name?.trim();
  if (!name) return false;
  if (name === 'System' || name === 'Student' || name === 'Staff' || name === 'Unknown') {
    return false;
  }
  return Boolean(event.performedBy.id);
}

/** Prefer a real staff name when coalescing/grouping mixed System + staff events. */
function bestPerformer(events: ActivityEventDisplay[]): ActivityEventDisplay['performedBy'] {
  const withStaff = events.find(isResolvedStaffPerformer);
  if (withStaff) return withStaff.performedBy;
  const nonSystem = events.find((event) => {
    const name = event.performedBy.name?.trim();
    return Boolean(name) && name !== 'System' && name !== 'Unknown';
  });
  if (nonSystem) return nonSystem.performedBy;
  return events[0]?.performedBy ?? { id: '', name: 'System' };
}

function studentName(event: ActivityEventDisplay): string {
  return event.relatedEntities?.student?.name || 'student';
}

function staffName(event: ActivityEventDisplay): string {
  return event.relatedEntities?.staff?.name || 'staff';
}

function sessionName(event: ActivityEventDisplay): string {
  return event.relatedEntities?.session?.name || 'session';
}

function className(event: ActivityEventDisplay): string {
  return event.relatedEntities?.class?.name || 'class';
}

function findEventWithBooleanField(
  events: ActivityEventDisplay[],
  fieldName: string,
  newValue: boolean
): ActivityEventDisplay | undefined {
  return events.find((event) => hasBooleanFieldChange(event, fieldName, newValue));
}

function findAddPersonEvent(events: ActivityEventDisplay[]): ActivityEventDisplay | undefined {
  return events.find((event) => event.icon === 'user-plus');
}

function isTutorLogEntity(event: ActivityEventDisplay): boolean {
  return typeof event.entityType === 'string' && event.entityType.startsWith('tutor_logs');
}

function sameRelatedId(
  events: ActivityEventDisplay[],
  kind: 'student' | 'staff' | 'session' | 'class'
): string | undefined {
  const ids = events
    .map((event) => event.relatedEntities?.[kind]?.id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return undefined;
  const first = ids[0];
  return ids.every((id) => id === first) ? first : undefined;
}

function uniqueNames(names: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

function buildTutorLogCoalescedMessage(events: ActivityEventDisplay[]): string {
  const base = events[0];
  const students = uniqueNames(events.map((event) => event.relatedEntities?.student?.name));
  const topicNames = uniqueNames(
    events.map((event) => {
      const topicName = event.metadata?.topicName;
      return typeof topicName === 'string' ? topicName : undefined;
    })
  );
  const topicRowCount = events.filter((event) => event.entityType === 'tutor_logs_topics').length;

  let message =
    students.length > 0
      ? `${performerName(base)} logged attendance for ${students.join(', ')} on ${sessionName(base)}`
      : `${performerName(base)} submitted a tutor log for ${sessionName(base)}`;

  if (topicNames.length > 0) {
    message += `. Topics: ${topicNames.join(', ')}`;
  } else if (topicRowCount > 0) {
    message += `. Topics: ${topicRowCount}`;
  }

  return message;
}

/**
 * Coalesce tutor-log RPC bursts even when other events (e.g. session notes) are
 * interleaved at the same timestamp. Contiguous sliding-window matching is not enough.
 */
function coalesceTutorLogBursts(
  events: ActivityEventDisplay[]
): { coalesced: ActivityEventDisplay[]; remaining: ActivityEventDisplay[] } {
  const TIME_WINDOW_MS = 15_000;
  const usedIds = new Set<string>();
  const coalesced: ActivityEventDisplay[] = [];

  const tutorLogEvents = events.filter(
    (event) => isTutorLogEntity(event) && event.relatedEntities?.session?.id
  );

  const groups = new Map<string, ActivityEventDisplay[]>();
  for (const event of tutorLogEvents) {
    const sessionId = event.relatedEntities!.session!.id;
    const key = `${event.performedBy.id}|${sessionId}`;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  for (const groupEvents of groups.values()) {
    const sorted = [...groupEvents].sort(
      (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
    );

    let cluster: ActivityEventDisplay[] = [];
    const flushCluster = (): void => {
      if (cluster.length >= 2) {
        const root =
          cluster.find((event) => event.entityType === 'tutor_logs') ?? cluster[0];
        coalesced.push(
          createCoalescedEvent(cluster, 'submit_tutor_log', {
            message: buildTutorLogCoalescedMessage(cluster),
            icon: 'check',
            iconColor: 'green',
            relatedEntities: {
              ...root.relatedEntities,
              // Prefer a student from attendance when present
              student:
                cluster.find((event) => event.relatedEntities?.student)?.relatedEntities?.student ??
                root.relatedEntities?.student,
            },
            performedBy: root.performedBy,
          })
        );
        cluster.forEach((event) => usedIds.add(event.id));
      }
      cluster = [];
    };

    for (const event of sorted) {
      if (cluster.length === 0) {
        cluster.push(event);
        continue;
      }
      const anchor = cluster[0];
      const delta = Math.abs(
        new Date(event.performedAt).getTime() - new Date(anchor.performedAt).getTime()
      );
      if (delta <= TIME_WINDOW_MS) {
        cluster.push(event);
      } else {
        flushCluster();
        cluster.push(event);
      }
    }
    flushCluster();
  }

  return {
    coalesced,
    remaining: events.filter((event) => !usedIds.has(event.id)),
  };
}

function countSessionAdds(events: ActivityEventDisplay[]): number {
  return events.filter(
    (event) => event.entityType === 'sessions_students' && event.eventType === 'CREATED'
  ).length;
}

function countSessionStaffAdds(events: ActivityEventDisplay[]): number {
  return events.filter(
    (event) => event.entityType === 'sessions_staff' && event.eventType === 'CREATED'
  ).length;
}

/**
 * Registry of event patterns for coalescing.
 * Order matters: more specific / multi-event patterns first.
 *
 * Tutor-log bursts are handled separately in coalesceTutorLogBursts() so interleaved
 * notes/other events at the same timestamp do not break the match.
 *
 * Patterns derived from production activity_events (read-only analysis):
 * - credit / reschedule / staff swap / planned absence (multi-field updates)
 * - enroll (classes_students CREATED + sessions_students CREATED*)
 * - assign staff (classes_staff CREATED + sessions_staff CREATED*)
 * - unenroll (classes_students unenrolled_* + sessions_students DELETED*)
 * - unassign staff (classes_staff unassigned_* + sessions_staff DELETED*)
 */
export const EVENT_PATTERNS: EventPattern[] = [
  {
    name: 'enroll_student',
    timeWindowMs: 10000,
    minEvents: 2,
    maxEvents: 120,
    matcher: (events) => {
      const enrollment = events.find(
        (event) => event.entityType === 'classes_students' && event.eventType === 'CREATED'
      );
      if (!enrollment) return false;
      if (!sameRelatedId(events, 'student')) return false;
      const sessionAdds = countSessionAdds(events);
      if (sessionAdds < 1) return false;
      return events.every(
        (event) =>
          event === enrollment ||
          (event.entityType === 'sessions_students' && event.eventType === 'CREATED') ||
          (event.entityType === 'students_subjects' && event.eventType === 'CREATED')
      );
    },
    coalescer: (events) => {
      const enrollment = events.find(
        (event) => event.entityType === 'classes_students' && event.eventType === 'CREATED'
      )!;
      const performer = bestPerformer([enrollment, ...events]);
      const sessionCount = countSessionAdds(events);
      const sessionSuffix =
        sessionCount > 0 ? ` (${sessionCount} session${sessionCount === 1 ? '' : 's'})` : '';
      return createCoalescedEvent(events, 'enroll_student', {
        message: `${performer.name || 'System'} enrolled ${studentName(enrollment)} in ${className(enrollment)}${sessionSuffix}`,
        icon: 'user-plus',
        iconColor: 'green',
        relatedEntities: enrollment.relatedEntities,
        performedBy: performer,
      });
    },
  },
  {
    name: 'assign_staff',
    timeWindowMs: 10000,
    minEvents: 2,
    maxEvents: 120,
    matcher: (events) => {
      const assignment = events.find(
        (event) => event.entityType === 'classes_staff' && event.eventType === 'CREATED'
      );
      if (!assignment) return false;
      if (!sameRelatedId(events, 'staff')) return false;
      if (countSessionStaffAdds(events) < 1) return false;
      return events.every(
        (event) =>
          event === assignment ||
          (event.entityType === 'sessions_staff' && event.eventType === 'CREATED')
      );
    },
    coalescer: (events) => {
      const assignment = events.find(
        (event) => event.entityType === 'classes_staff' && event.eventType === 'CREATED'
      )!;
      const sessionCount = countSessionStaffAdds(events);
      const sessionSuffix =
        sessionCount > 0 ? ` (${sessionCount} session${sessionCount === 1 ? '' : 's'})` : '';
      return createCoalescedEvent(events, 'assign_staff', {
        message: `${performerName(assignment)} assigned ${staffName(assignment)} to ${className(assignment)}${sessionSuffix}`,
        icon: 'user-plus',
        iconColor: 'green',
        relatedEntities: assignment.relatedEntities,
      });
    },
  },
  {
    name: 'unenroll_student',
    timeWindowMs: 10000,
    minEvents: 2,
    maxEvents: 120,
    matcher: (events) => {
      const unenroll = events.find((event) => hasField(event, 'unenrolled_at'));
      if (!unenroll) return false;
      if (!sameRelatedId(events, 'student')) return false;
      const removals = events.filter(
        (event) => event.entityType === 'sessions_students' && event.eventType === 'DELETED'
      );
      if (removals.length < 1) return false;
      return events.every(
        (event) =>
          event === unenroll ||
          (event.entityType === 'sessions_students' && event.eventType === 'DELETED')
      );
    },
    coalescer: (events) => {
      const unenroll = events.find((event) => hasField(event, 'unenrolled_at'))!;
      const removalCount = events.filter(
        (event) => event.entityType === 'sessions_students' && event.eventType === 'DELETED'
      ).length;
      return createCoalescedEvent(events, 'unenroll_student', {
        message: `${performerName(unenroll)} unenrolled ${studentName(unenroll)} from ${className(unenroll)} (${removalCount} session${removalCount === 1 ? '' : 's'})`,
        icon: 'user-minus',
        iconColor: 'red',
        relatedEntities: unenroll.relatedEntities,
      });
    },
  },
  {
    name: 'unassign_staff',
    timeWindowMs: 10000,
    minEvents: 2,
    maxEvents: 120,
    matcher: (events) => {
      const unassign = events.find((event) => hasField(event, 'unassigned_at'));
      if (!unassign) return false;
      if (!sameRelatedId(events, 'staff')) return false;
      const removals = events.filter(
        (event) => event.entityType === 'sessions_staff' && event.eventType === 'DELETED'
      );
      if (removals.length < 1) return false;
      return events.every(
        (event) =>
          event === unassign ||
          (event.entityType === 'sessions_staff' && event.eventType === 'DELETED')
      );
    },
    coalescer: (events) => {
      const unassign = events.find((event) => hasField(event, 'unassigned_at'))!;
      const removalCount = events.filter(
        (event) => event.entityType === 'sessions_staff' && event.eventType === 'DELETED'
      ).length;
      return createCoalescedEvent(events, 'unassign_staff', {
        message: `${performerName(unassign)} unassigned ${staffName(unassign)} from ${className(unassign)} (${removalCount} session${removalCount === 1 ? '' : 's'})`,
        icon: 'user-minus',
        iconColor: 'red',
        relatedEntities: unassign.relatedEntities,
      });
    },
  },
  {
    name: 'staff_swap',
    timeWindowMs: 5000,
    minEvents: 2,
    maxEvents: 2,
    matcher: (events) => {
      const swapUpdate = findEventWithBooleanField(events, 'is_swapped', true);
      const replacement = findAddPersonEvent(events);
      if (!swapUpdate || !replacement || swapUpdate === replacement) return false;
      if (!replacement.relatedEntities?.staff) return false;
      const swapSessionId = swapUpdate.relatedEntities?.session?.id;
      const replacementSessionId = replacement.relatedEntities?.session?.id;
      return Boolean(swapSessionId && replacementSessionId && swapSessionId === replacementSessionId);
    },
    coalescer: (events) => {
      const swapUpdate = findEventWithBooleanField(events, 'is_swapped', true)!;
      const replacement = findAddPersonEvent(events)!;
      return createCoalescedEvent(events, 'staff_swap', {
        message: `${performerName(swapUpdate)} swapped ${staffName(swapUpdate)} for ${staffName(replacement)} on ${sessionName(swapUpdate)}`,
        icon: 'user-edit',
        iconColor: 'blue',
        relatedEntities: {
          ...swapUpdate.relatedEntities,
          staff: swapUpdate.relatedEntities?.staff,
        },
      });
    },
  },
  {
    name: 'reschedule_session',
    timeWindowMs: 5000,
    minEvents: 2,
    maxEvents: 2,
    matcher: (events) => {
      const rescheduleUpdate = findEventWithBooleanField(events, 'is_rescheduled', true);
      const targetAdd = findAddPersonEvent(events);
      if (!rescheduleUpdate || !targetAdd || rescheduleUpdate === targetAdd) return false;
      if (!targetAdd.relatedEntities?.student) return false;
      const fromStudentId = rescheduleUpdate.relatedEntities?.student?.id;
      const toStudentId = targetAdd.relatedEntities?.student?.id;
      const fromSessionId = rescheduleUpdate.relatedEntities?.session?.id;
      const toSessionId = targetAdd.relatedEntities?.session?.id;
      return Boolean(
        fromStudentId &&
          toStudentId &&
          fromStudentId === toStudentId &&
          fromSessionId &&
          toSessionId &&
          fromSessionId !== toSessionId
      );
    },
    coalescer: (events) => {
      const rescheduleUpdate = findEventWithBooleanField(events, 'is_rescheduled', true)!;
      const targetAdd = findAddPersonEvent(events)!;
      return createCoalescedEvent(events, 'reschedule_session', {
        message: `${performerName(rescheduleUpdate)} rescheduled ${studentName(rescheduleUpdate)} from ${sessionName(rescheduleUpdate)} to ${sessionName(targetAdd)}`,
        icon: 'arrow-right',
        iconColor: 'blue',
        relatedEntities: rescheduleUpdate.relatedEntities,
      });
    },
  },
  {
    name: 'credit_session',
    timeWindowMs: 5000,
    minEvents: 1,
    maxEvents: 1,
    matcher: (events) => hasBooleanFieldChange(events[0], 'is_credited', true),
    coalescer: (events) => {
      const event = events[0];
      return createCoalescedEvent(events, 'credit_session', {
        message: `${performerName(event)} credited ${studentName(event)} for ${sessionName(event)}`,
        icon: 'check',
        iconColor: 'green',
      });
    },
  },
  {
    name: 'undo_credit_session',
    timeWindowMs: 5000,
    minEvents: 1,
    maxEvents: 1,
    matcher: (events) => hasBooleanFieldChange(events[0], 'is_credited', false),
    coalescer: (events) => {
      const event = events[0];
      return createCoalescedEvent(events, 'undo_credit_session', {
        message: `${performerName(event)} undid credit for ${studentName(event)} on ${sessionName(event)}`,
        icon: 'x',
        iconColor: 'yellow',
      });
    },
  },
  {
    name: 'reschedule_session_update',
    timeWindowMs: 5000,
    minEvents: 1,
    maxEvents: 1,
    matcher: (events) => hasBooleanFieldChange(events[0], 'is_rescheduled', true),
    coalescer: (events) => {
      const event = events[0];
      return createCoalescedEvent(events, 'reschedule_session_update', {
        message: `${performerName(event)} rescheduled ${studentName(event)} from ${sessionName(event)}`,
        icon: 'arrow-right',
        iconColor: 'blue',
      });
    },
  },
  {
    name: 'undo_staff_swap',
    timeWindowMs: 5000,
    minEvents: 1,
    maxEvents: 1,
    matcher: (events) => hasBooleanFieldChange(events[0], 'is_swapped', false),
    coalescer: (events) => {
      const event = events[0];
      return createCoalescedEvent(events, 'undo_staff_swap', {
        message: `${performerName(event)} undid staff swap for ${staffName(event)} on ${sessionName(event)}`,
        icon: 'arrow-left',
        iconColor: 'yellow',
      });
    },
  },
  {
    name: 'staff_planned_absence',
    timeWindowMs: 5000,
    minEvents: 1,
    maxEvents: 1,
    matcher: (events) => {
      const event = events[0];
      // Credit/reschedule/swap already handled; this is staff absence-only updates
      if (hasField(event, 'is_credited') || hasField(event, 'is_rescheduled') || hasField(event, 'is_swapped')) {
        return false;
      }
      return hasBooleanFieldChange(event, 'planned_absence', true) && Boolean(event.relatedEntities?.staff);
    },
    coalescer: (events) => {
      const event = events[0];
      return createCoalescedEvent(events, 'staff_planned_absence', {
        message: `${performerName(event)} logged planned absence for ${staffName(event)} on ${sessionName(event)}`,
        icon: 'flag',
        iconColor: 'yellow',
      });
    },
  },
  {
    name: 'undo_staff_planned_absence',
    timeWindowMs: 5000,
    minEvents: 1,
    maxEvents: 1,
    matcher: (events) => {
      const event = events[0];
      if (hasField(event, 'is_credited') || hasField(event, 'is_rescheduled') || hasField(event, 'is_swapped')) {
        return false;
      }
      return hasBooleanFieldChange(event, 'planned_absence', false) && Boolean(event.relatedEntities?.staff);
    },
    coalescer: (events) => {
      const event = events[0];
      return createCoalescedEvent(events, 'undo_staff_planned_absence', {
        message: `${performerName(event)} cleared planned absence for ${staffName(event)} on ${sessionName(event)}`,
        icon: 'flag',
        iconColor: 'gray',
      });
    },
  },
  {
    name: 'unenroll_student_update',
    timeWindowMs: 5000,
    minEvents: 1,
    maxEvents: 1,
    matcher: (events) => hasField(events[0], 'unenrolled_at'),
    coalescer: (events) => {
      const event = events[0];
      return createCoalescedEvent(events, 'unenroll_student_update', {
        message: `${performerName(event)} unenrolled ${studentName(event)} from ${className(event)}`,
        icon: 'user-minus',
        iconColor: 'red',
      });
    },
  },
  {
    name: 'unassign_staff_update',
    timeWindowMs: 5000,
    minEvents: 1,
    maxEvents: 1,
    matcher: (events) => hasField(events[0], 'unassigned_at'),
    coalescer: (events) => {
      const event = events[0];
      return createCoalescedEvent(events, 'unassign_staff_update', {
        message: `${performerName(event)} unassigned ${staffName(event)} from ${className(event)}`,
        icon: 'user-minus',
        iconColor: 'red',
      });
    },
  },
];

/**
 * Check if two events are related (same user, within time window, and share a common entity)
 * Common entities include: same student, same session, same class, etc.
 */
function areEventsRelated(
  a: ActivityEventDisplay,
  b: ActivityEventDisplay,
  timeWindowMs: number
): boolean {
  // Must be same performer
  if (a.performedBy.id !== b.performedBy.id) return false;
  
  // Must be within time window
  const timeDiff = Math.abs(
    new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  );
  if (timeDiff > timeWindowMs) return false;
  
  // Check for common related entities (student, session, class, etc.)
  const aStudentId = a.relatedEntities?.student?.id;
  const bStudentId = b.relatedEntities?.student?.id;
  if (aStudentId && bStudentId && aStudentId === bStudentId) return true;
  
  const aSessionId = a.relatedEntities?.session?.id;
  const bSessionId = b.relatedEntities?.session?.id;
  if (aSessionId && bSessionId && aSessionId === bSessionId) return true;
  
  const aClassId = a.relatedEntities?.class?.id;
  const bClassId = b.relatedEntities?.class?.id;
  if (aClassId && bClassId && aClassId === bClassId) return true;

  const aStaffId = a.relatedEntities?.staff?.id;
  const bStaffId = b.relatedEntities?.staff?.id;
  if (aStaffId && bStaffId && aStaffId === bStaffId) return true;
  
  return false;
}

/**
 * Find sequences of events that match a pattern
 * Uses a sliding window approach to find matching event sequences
 */
function findPatternMatches(
  events: ActivityEventDisplay[],
  pattern: EventPattern,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): Array<{ startIndex: number; endIndex: number; matchedEvents: ActivityEventDisplay[] }> {
  const matches: Array<{ startIndex: number; endIndex: number; matchedEvents: ActivityEventDisplay[] }> = [];
  const timeWindowMs = pattern.timeWindowMs ?? 5000;
  
  // Sort events by performedAt (oldest first) if not already sorted
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  );
  
  // Use sliding window to find sequences (prefer longest match, then skip ahead)
  for (let i = 0; i <= sortedEvents.length - pattern.minEvents; i++) {
    const maxLength = Math.min(
      pattern.maxEvents ?? sortedEvents.length - i,
      sortedEvents.length - i
    );

    let matchedLength = 0;
    for (let length = maxLength; length >= pattern.minEvents; length--) {
      const candidate = sortedEvents.slice(i, i + length);
      
      // Check if all events in candidate are related (same user, within time window, share entity)
      let allRelated = true;
      for (let j = 0; j < candidate.length - 1; j++) {
        if (!areEventsRelated(candidate[j], candidate[j + 1], timeWindowMs)) {
          allRelated = false;
          break;
        }
      }
      
      if (!allRelated) continue;
      
      // Check if candidate matches the pattern
      if (pattern.matcher(candidate, relatedEntities)) {
        matches.push({
          startIndex: i,
          endIndex: i + length - 1,
          matchedEvents: candidate,
        });
        matchedLength = length;
        break;
      }
    }

    if (matchedLength > 0) {
      i += matchedLength - 1;
    }
  }
  
  return matches;
}

/**
 * Coalesce related events into logical actions using pattern matching
 * This runs before grouping, so patterns can combine events that represent
 * a single logical action (e.g., rescheduling involves multiple events)
 */
export function coalesceRelatedEvents(
  events: ActivityEventDisplay[],
  relatedEntities: ActivityEventsResponse['relatedEntities']
): ActivityEventDisplay[] {
  if (events.length === 0) {
    return events;
  }

  // Sort events by performedAt (oldest first) for consistent processing
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  );

  // Tutor-log RPC bursts first (non-contiguous: notes can interleave at the same timestamp)
  const { coalesced: tutorLogCoalesced, remaining: afterTutorLogs } =
    coalesceTutorLogBursts(sortedEvents);

  if (EVENT_PATTERNS.length === 0) {
    return [...tutorLogCoalesced, ...afterTutorLogs].sort(
      (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
    );
  }

  // Track which remaining events have been coalesced (using sorted indices)
  const coalescedIndices = new Set<number>();
  const result: ActivityEventDisplay[] = [...tutorLogCoalesced];

  // Process each pattern in order (patterns are checked in registration order)
  // Earlier patterns take precedence - once events are coalesced, they can't be used in later patterns
  for (const pattern of EVENT_PATTERNS) {
    const matches = findPatternMatches(afterTutorLogs, pattern, relatedEntities);

    // Process matches in reverse order (end to start) to preserve indices when marking as coalesced
    for (const match of matches.reverse()) {
      // Check if any events in this match have already been coalesced
      const alreadyCoalesced = match.matchedEvents.some((_, idx) =>
        coalescedIndices.has(match.startIndex + idx)
      );

      if (alreadyCoalesced) continue;

      // Coalesce the events
      const coalescedEvent = pattern.coalescer(match.matchedEvents, relatedEntities);

      // Mark events as coalesced (using sorted indices)
      for (let i = match.startIndex; i <= match.endIndex; i++) {
        coalescedIndices.add(i);
      }

      // Add coalesced event to result
      result.push(coalescedEvent);
    }
  }

  // Add non-coalesced events to result (using sorted order)
  for (let i = 0; i < afterTutorLogs.length; i++) {
    if (!coalescedIndices.has(i)) {
      result.push(afterTutorLogs[i]);
    }
  }

  // Sort result by performedAt (oldest first) to maintain chronological order
  return result.sort(
    (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  );
}

