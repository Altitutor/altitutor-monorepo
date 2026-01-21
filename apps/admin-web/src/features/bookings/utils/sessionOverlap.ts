import { parseISO, isSameDay } from 'date-fns';
import { adelaideTimeToMinutes } from '@/shared/utils/datetime';

export interface SessionItem {
  id: string;
  start_at: string;
  end_at: string;
}

/**
 * Calculate overlap groups for sessions on a given day
 * Sessions that overlap in time are grouped together
 * Uses Adelaide timezone for consistent calculations
 */
export function calculateSessionOverlapGroups(
  sessions: SessionItem[],
  targetDate: Date
): SessionItem[][] {
  // Filter sessions for the target date
  const daySessions = sessions
    .filter((s) => s.start_at && isSameDay(parseISO(s.start_at), targetDate))
    .sort((a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime());

  // Build overlap groups using Adelaide timezone for consistent calculations
  // Fix: Check if session overlaps with ANY session in the group, not just the first one
  const groups: SessionItem[][] = [];
  const processed = new Set<string>();

  daySessions.forEach((s) => {
    if (processed.has(s.id)) return;
    
    const group: SessionItem[] = [s];
    processed.add(s.id);

    // Keep checking for new overlaps until no more sessions can be added
    let foundNewOverlap = true;
    while (foundNewOverlap) {
      foundNewOverlap = false;
      daySessions.forEach((o) => {
        if (processed.has(o.id)) return;
        const oStart = adelaideTimeToMinutes(o.start_at);
        const oEnd = adelaideTimeToMinutes(o.end_at);
        
        // Check if o overlaps with ANY session already in the group
        const overlapsWithGroup = group.some((groupSession) => {
          const gStart = adelaideTimeToMinutes(groupSession.start_at);
          const gEnd = adelaideTimeToMinutes(groupSession.end_at);
          // Events that end exactly when another starts should NOT overlap
          // Use strict comparison: gStart < oEnd && gEnd > oStart
          return gStart < oEnd && gEnd > oStart;
        });
        
        if (overlapsWithGroup) {
          group.push(o);
          processed.add(o.id);
          foundNewOverlap = true;
        }
      });
    }

    groups.push(group);
  });

  return groups;
}

/**
 * Calculate time grid position for a session
 * Uses Adelaide timezone for consistent calculations
 */
export function calculateSessionPosition(
  session: SessionItem,
  startHour: number = 9,
  slotHeight: number = 75
): { top: number; height: number } {
  const sStartMinutes = adelaideTimeToMinutes(session.start_at);
  const sEndMinutes = adelaideTimeToMinutes(session.end_at);
  
  const minutesFromStart = sStartMinutes - (startHour * 60);
  
  const top = Math.max(0, (minutesFromStart / 60) * slotHeight);
  const height = Math.max(45, ((sEndMinutes - sStartMinutes) / 60) * slotHeight);
  
  return { top, height };
}
