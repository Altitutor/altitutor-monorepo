import { parseISO } from 'date-fns';

const ADELAIDE_TIMEZONE = 'Australia/Adelaide';

/**
 * Convert a date string (YYYY-MM-DD) to midnight Adelaide time in UTC ISO string
 * Properly handles DST using Intl API
 */
export function dateToAdelaideMidnightUTC(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  const adelaideFormatter = new Intl.DateTimeFormat('en', {
    timeZone: ADELAIDE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Search for UTC time that gives us midnight in Adelaide
  // Try UTC times from 13 hours before to 11 hours after midnight UTC
  // (Adelaide is typically UTC+9:30 to UTC+10:30)
  for (let hourOffset = -13; hourOffset <= 11; hourOffset++) {
    let testYear = year;
    let testMonth = month;
    let testDay = day;
    let testHour = hourOffset;
    
    // Handle negative hours (previous day)
    if (testHour < 0) {
      testHour += 24;
      testDay -= 1;
      if (testDay < 1) {
        testMonth -= 1;
        if (testMonth < 1) {
          testMonth = 12;
          testYear -= 1;
        }
        testDay = 31;
      }
    }
    
    const testUtc = new Date(Date.UTC(testYear, testMonth - 1, testDay, testHour, 0, 0, 0));
    const testAdelaide = adelaideFormatter.formatToParts(testUtc);
    const testAdelaideHour = parseInt(testAdelaide.find(p => p.type === 'hour')?.value || '0', 10);
    const testAdelaideMinute = parseInt(testAdelaide.find(p => p.type === 'minute')?.value || '0', 10);
    const testAdelaideDay = parseInt(testAdelaide.find(p => p.type === 'day')?.value || '0', 10);
    const testAdelaideMonth = parseInt(testAdelaide.find(p => p.type === 'month')?.value || '0', 10);
    const testAdelaideYear = parseInt(testAdelaide.find(p => p.type === 'year')?.value || '0', 10);
    
    if (
      testAdelaideHour === 0 &&
      testAdelaideMinute === 0 &&
      testAdelaideDay === day &&
      testAdelaideMonth === month &&
      testAdelaideYear === year
    ) {
      return testUtc.toISOString();
    }
  }
  
  // Fallback: approximate (shouldn't happen)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
}

/**
 * Convert a date string (YYYY-MM-DD) to end of day (23:59:59.999) Adelaide time in UTC ISO string
 */
export function dateToAdelaideEndOfDayUTC(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  const adelaideFormatter = new Intl.DateTimeFormat('en', {
    timeZone: ADELAIDE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Search for UTC time that gives us 23:59:59 in Adelaide
  for (let hourOffset = -13; hourOffset <= 11; hourOffset++) {
    let testYear = year;
    let testMonth = month;
    let testDay = day;
    let testHour = hourOffset;
    
    // Handle negative hours (previous day)
    if (testHour < 0) {
      testHour += 24;
      testDay -= 1;
      if (testDay < 1) {
        testMonth -= 1;
        if (testMonth < 1) {
          testMonth = 12;
          testYear -= 1;
        }
        testDay = 31;
      }
    }
    
    const testUtc = new Date(Date.UTC(testYear, testMonth - 1, testDay, testHour, 59, 59, 999));
    const testAdelaide = adelaideFormatter.formatToParts(testUtc);
    const testAdelaideHour = parseInt(testAdelaide.find(p => p.type === 'hour')?.value || '0', 10);
    const testAdelaideMinute = parseInt(testAdelaide.find(p => p.type === 'minute')?.value || '0', 10);
    const testAdelaideSecond = parseInt(testAdelaide.find(p => p.type === 'second')?.value || '0', 10);
    const testAdelaideDay = parseInt(testAdelaide.find(p => p.type === 'day')?.value || '0', 10);
    const testAdelaideMonth = parseInt(testAdelaide.find(p => p.type === 'month')?.value || '0', 10);
    const testAdelaideYear = parseInt(testAdelaide.find(p => p.type === 'year')?.value || '0', 10);
    
    if (
      testAdelaideHour === 23 &&
      testAdelaideMinute === 59 &&
      testAdelaideSecond === 59 &&
      testAdelaideDay === day &&
      testAdelaideMonth === month &&
      testAdelaideYear === year
    ) {
      return testUtc.toISOString();
    }
  }
  
  // Fallback: approximate
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString();
}

/**
 * Convert UTC ISO string to Adelaide date string (YYYY-MM-DD)
 */
export function utcToAdelaideDate(utcString: string): string {
  const date = new Date(utcString);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ADELAIDE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Format date range for display (convert UTC to Adelaide, show dates only)
 */
export function formatDateRange(startUtc: string, endUtc: string): string {
  const startDate = new Date(startUtc);
  const endDate = new Date(endUtc);
  
  const startFormatted = startDate.toLocaleDateString('en-AU', {
    timeZone: ADELAIDE_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  const endFormatted = endDate.toLocaleDateString('en-AU', {
    timeZone: ADELAIDE_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  // Check if it's a single day
  const startDateOnly = startDate.toLocaleDateString('en-CA', { timeZone: ADELAIDE_TIMEZONE });
  const endDateOnly = endDate.toLocaleDateString('en-CA', { timeZone: ADELAIDE_TIMEZONE });
  
  if (startDateOnly === endDateOnly) {
    return startFormatted;
  }
  
  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Get today's date in Adelaide timezone (YYYY-MM-DD format)
 */
export function getTodayAdelaideDate(): string {
  const today = new Date();
  return utcToAdelaideDate(today.toISOString());
}

/**
 * Get Adelaide time components from a date
 */
function getAdelaideTime(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: ADELAIDE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === 'year')?.value || '0', 10),
    month: parseInt(parts.find(p => p.type === 'month')?.value || '0', 10),
    day: parseInt(parts.find(p => p.type === 'day')?.value || '0', 10),
    hour: parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10),
    minute: parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10),
    second: parseInt(parts.find(p => p.type === 'second')?.value || '0', 10),
  };
}

/**
 * Check if a slot is in the past using Adelaide timezone
 * Compares the Adelaide local time of the slot with the current Adelaide local time
 */
export function isSlotInPast(startAt: string): boolean {
  const slotDate = parseISO(startAt);
  const now = new Date();
  
  const slotTime = getAdelaideTime(slotDate);
  const nowTime = getAdelaideTime(now);
  
  // Compare year, month, day, hour, minute, second
  if (slotTime.year !== nowTime.year) {
    return slotTime.year < nowTime.year;
  }
  if (slotTime.month !== nowTime.month) {
    return slotTime.month < nowTime.month;
  }
  if (slotTime.day !== nowTime.day) {
    return slotTime.day < nowTime.day;
  }
  if (slotTime.hour !== nowTime.hour) {
    return slotTime.hour < nowTime.hour;
  }
  if (slotTime.minute !== nowTime.minute) {
    return slotTime.minute < nowTime.minute;
  }
  return slotTime.second < nowTime.second;
}

/**
 * Format a date/time string for display in Adelaide timezone
 */
export function formatSlotDateTime(startAt: string): string {
  return new Date(startAt).toLocaleString('en-AU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: ADELAIDE_TIMEZONE,
  });
}

/**
 * Get current Adelaide time as a formatted string
 */
export function getCurrentAdelaideTime(): string {
  return new Date().toLocaleString('en-AU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: ADELAIDE_TIMEZONE,
  });
}
