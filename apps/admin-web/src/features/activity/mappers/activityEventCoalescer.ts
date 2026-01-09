import type { ActivityEventDisplay, ActivityEventsResponse } from '../types';
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
    id: `coalesced-${patternName}-${baseEvent.id}`,
    performedAt: earliestEvent.performedAt,
    timestamp: formatActivityTimestamp(earliestEvent.performedAt),
    isCoalesced: true,
    coalescedPatternName: patternName,
    originalEvents: events, // Store original events for UI expansion
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

/**
 * Registry of event patterns for coalescing
 * Add new patterns here as needed
 */
export const EVENT_PATTERNS: EventPattern[] = [
  // Patterns will be added here
  // Example structure:
  // {
  //   name: 'reschedule',
  //   timeWindowMs: 5000,
  //   minEvents: 3,
  //   maxEvents: 3,
  //   matcher: (events, relatedEntities) => { ... },
  //   coalescer: (events, relatedEntities) => { ... },
  // },
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
  
  // Note: Student ID check is already done above, so we don't need to check again
  // The student check handles cases like rescheduling where events affect different sessions
  // but the same student
  
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
  
  // Use sliding window to find sequences
  for (let i = 0; i <= sortedEvents.length - pattern.minEvents; i++) {
    // Try sequences of different lengths (minEvents to maxEvents or remaining events)
    const maxLength = pattern.maxEvents ?? sortedEvents.length - i;
    
    for (let length = pattern.minEvents; length <= maxLength && i + length <= sortedEvents.length; length++) {
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
        
        // Skip ahead to avoid overlapping matches
        // (once we find a match, we don't need to check subsequences)
        break;
      }
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
  if (events.length === 0 || EVENT_PATTERNS.length === 0) {
    return events;
  }
  
  // Sort events by performedAt (oldest first) for consistent processing
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  );
  
  // Track which events have been coalesced (using sorted indices)
  const coalescedIndices = new Set<number>();
  const result: ActivityEventDisplay[] = [];
  
  // Process each pattern in order (patterns are checked in registration order)
  // Earlier patterns take precedence - once events are coalesced, they can't be used in later patterns
  for (const pattern of EVENT_PATTERNS) {
    const matches = findPatternMatches(sortedEvents, pattern, relatedEntities);
    
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
  for (let i = 0; i < sortedEvents.length; i++) {
    if (!coalescedIndices.has(i)) {
      result.push(sortedEvents[i]);
    }
  }
  
  // Sort result by performedAt (oldest first) to maintain chronological order
  return result.sort(
    (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  );
}

