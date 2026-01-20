import { parseISO, isSameDay, differenceInMinutes } from 'date-fns';

export interface SessionItem {
  id: string;
  start_at: string;
  end_at: string;
}

/**
 * Calculate overlap groups for sessions on a given day
 * Sessions that overlap in time are grouped together
 */
export function calculateSessionOverlapGroups(
  sessions: SessionItem[],
  targetDate: Date
): SessionItem[][] {
  // Filter sessions for the target date
  const daySessions = sessions
    .filter((s) => s.start_at && isSameDay(parseISO(s.start_at), targetDate))
    .sort((a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime());

  // Build overlap groups
  const groups: SessionItem[][] = [];
  const processed = new Set<string>();
  const toMinutes = (dt: Date) => dt.getHours() * 60 + dt.getMinutes();

  daySessions.forEach((s) => {
    if (processed.has(s.id)) return;
    
    const sStart = toMinutes(parseISO(s.start_at));
    const sEnd = toMinutes(parseISO(s.end_at));
    const group: SessionItem[] = [s];
    processed.add(s.id);

    daySessions.forEach((o) => {
      if (processed.has(o.id)) return;
      const oStart = toMinutes(parseISO(o.start_at));
      const oEnd = toMinutes(parseISO(o.end_at));
      if (sStart < oEnd && sEnd > oStart) {
        group.push(o);
        processed.add(o.id);
      }
    });

    groups.push(group);
  });

  return groups;
}

/**
 * Calculate time grid position for a session
 */
export function calculateSessionPosition(
  session: SessionItem,
  startHour: number = 9,
  slotHeight: number = 75
): { top: number; height: number } {
  const sessionStart = parseISO(session.start_at);
  const sessionEnd = parseISO(session.end_at);
  
  const minutesFromStart = (date: Date) => 
    (date.getHours() * 60 + date.getMinutes()) - (startHour * 60);
  
  const top = Math.max(0, (minutesFromStart(sessionStart) / 60) * slotHeight);
  const height = Math.max(45, (differenceInMinutes(sessionEnd, sessionStart) / 60) * slotHeight);
  
  return { top, height };
}
