import type { Tables } from '@altitutor/shared';

interface CalculateSessionChangesParams {
  classData: Tables<'classes'>;
  newStartDate: string | null;
  newEndDate: string | null;
  newDayOfWeek: number;
  newStartTime: string;
  newEndTime: string;
  existingFutureSessions: Tables<'sessions'>[];
}

interface SessionChangeResult {
  sessionsToDelete: Tables<'sessions'>[];
  sessionsToCreate: Array<{ date: string; startAt: string; endAt: string }>;
}

/**
 * Calculate which sessions would be created/deleted when updating class dates/times
 * Only considers future sessions (start_at >= NOW())
 */
export function calculateSessionChanges({
  classData,
  newStartDate,
  newEndDate,
  newDayOfWeek,
  newStartTime,
  newEndTime,
  existingFutureSessions,
}: CalculateSessionChangesParams): SessionChangeResult {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Determine old date range
  const oldStartDate = classData.session_start_date 
    ? new Date(classData.session_start_date)
    : today;
  
  const oldEndDate = classData.session_end_date
    ? new Date(classData.session_end_date)
    : new Date(oldStartDate.getFullYear(), 11, 31); // Dec 31 of year containing start date
  
  // Determine new date range
  const newStart = newStartDate 
    ? new Date(newStartDate)
    : today;
  
  const newEnd = newEndDate
    ? new Date(newEndDate)
    : new Date(newStart.getFullYear(), 11, 31); // Dec 31 of year containing start date
  
  // Only consider future sessions
  const effectiveOldStart = oldStartDate < today ? today : oldStartDate;
  const effectiveNewStart = newStart < today ? today : newStart;
  
  // Sessions to delete: future sessions that are outside the new date range
  const sessionsToDelete = existingFutureSessions.filter(session => {
    if (!session.start_at) return false;
    const sessionDate = new Date(session.start_at);
    const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
    
    // Delete if session is before new start date or after new end date
    return sessionDateOnly < newStart || sessionDateOnly > newEnd;
  });
  
  // Calculate sessions that would be created
  // These are sessions that:
  // 1. Fall on the correct day of week
  // 2. Are within the new date range
  // 3. Don't already exist
  const sessionsToCreate: Array<{ date: string; startAt: string; endAt: string }> = [];
  
  const existingSessionDates = new Set(
    existingFutureSessions
      .filter(s => s.start_at)
      .map(s => {
        const d = new Date(s.start_at!);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
  );
  
  // Iterate through dates in the new range
  const currentDate = new Date(effectiveNewStart);
  const endDate = new Date(newEnd);
  
  while (currentDate <= endDate) {
    // Check if this date matches the day of week (0=Sunday, 6=Saturday)
    const dayOfWeek = currentDate.getDay();
    
    if (dayOfWeek === newDayOfWeek) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      
      // Only create if it doesn't already exist
      if (!existingSessionDates.has(dateStr)) {
        // Build timestamps in Adelaide timezone
        const startAt = `${dateStr}T${newStartTime}:00`;
        const endAt = `${dateStr}T${newEndTime}:00`;
        
        sessionsToCreate.push({
          date: dateStr,
          startAt,
          endAt,
        });
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return {
    sessionsToDelete,
    sessionsToCreate,
  };
}
