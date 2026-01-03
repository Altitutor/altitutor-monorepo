// Utilities for formatting dates/times and working with day-of-week values

export function formatTime(timeString: string | null | undefined): string {
  if (!timeString) return '';

  // Accept HH:mm or HH:mm:ss
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) {
    const [hoursStr, minutesStr] = timeString.split(':');
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const paddedMinutes = minutes.toString().padStart(2, '0');
    return `${hour12}:${paddedMinutes} ${ampm}`;
  }

  return String(timeString);
}

export function getDayOfWeek(dayIndex: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex] ?? 'Unknown';
}

export function getDayShortName(dayIndex: number): string {
  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return daysShort[dayIndex] ?? '';
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  // Format as "Mon, Jan 15, 2024"
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  return dateObj.toLocaleDateString('en-US', options);
}

export function formatTimeHHMM(timeString: string | null | undefined): string {
  if (!timeString) return '';

  // If it's already in HH:mm or HH:mm:ss format, extract HH:mm
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) {
    const [hoursStr, minutesStr] = timeString.split(':');
    const hours = String(hoursStr).padStart(2, '0');
    const minutes = String(minutesStr).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // If it's an ISO datetime string, parse and format
  try {
    const date = new Date(timeString);
    if (!isNaN(date.getTime())) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  } catch (e) {
    // Fall through to return empty string
  }

  return '';
}

/**
 * Convert a date string (YYYY-MM-DD) to UTC timestamp for start of day
 * Interprets the date as local timezone and converts to UTC
 * Example: "2024-01-15" -> "2024-01-14T13:30:00.000Z" (if in GMT+10:30)
 */
export function dateStringToUtcStart(dateString: string): string {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Invalid date string format: ${dateString}. Expected YYYY-MM-DD`);
  }
  // Create date at midnight in local timezone, then convert to UTC
  const localDate = new Date(`${dateString}T00:00:00`);
  return localDate.toISOString();
}

/**
 * Convert a date string (YYYY-MM-DD) to UTC timestamp for end of day
 * Interprets the date as local timezone and converts to UTC
 * Example: "2024-01-15" -> "2024-01-15T13:29:59.999Z" (if in GMT+10:30)
 */
export function dateStringToUtcEnd(dateString: string): string {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Invalid date string format: ${dateString}. Expected YYYY-MM-DD`);
  }
  // Create date at end of day in local timezone, then convert to UTC
  const localDate = new Date(`${dateString}T23:59:59.999`);
  return localDate.toISOString();
}

