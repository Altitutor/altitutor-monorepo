/**
 * QuickBooks Export Utilities
 * 
 * Functions for formatting data and generating CSV for QuickBooks import
 */

const ADELAIDE_TIMEZONE = 'Australia/Adelaide';

/**
 * Format a UTC timestamp to DD/MM/YYYY in Adelaide timezone
 */
export function formatDateAdelaide(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: ADELAIDE_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(date);
}

/**
 * Format a UTC timestamp to HH:MM (24-hour format) in Adelaide timezone
 */
export function formatTimeAdelaide(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: ADELAIDE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Format a UTC timestamp to HH:MM AM/PM in Adelaide timezone
 */
export function formatTime12HourAdelaide(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: ADELAIDE_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatter.format(date);
}

/**
 * Calculate hours between two timestamps as a decimal
 */
export function calculateHours(startAt: string, endAt: string): number {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const milliseconds = end - start;
  const hours = milliseconds / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100; // Round to 2 decimal places
}

/**
 * Escape CSV field value (handles quotes and commas)
 */
export function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Generate CSV row from QuickBooks timesheet entry
 */
export function generateCsvRow(entry: {
  date: string; // DD/MM/YYYY
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  employeeExternalId: string;
  payCategoryExternalId: string;
  comments: string;
  units: number; // decimal hours
}): string {
  const {
    date,
    startTime,
    endTime,
    employeeExternalId,
    payCategoryExternalId,
    comments,
    units,
  } = entry;
  
  return [
    escapeCsvField(date),
    escapeCsvField(startTime),
    escapeCsvField(endTime),
    escapeCsvField(employeeExternalId),
    escapeCsvField(payCategoryExternalId),
    escapeCsvField(comments),
    escapeCsvField(units.toString()),
  ].join(',');
}

/**
 * Generate CSV header row
 */
export function generateCsvHeader(): string {
  return [
    'date',
    'start time',
    'end time',
    'employee external id',
    'pay category external id',
    'comments',
    'units',
  ].join(',');
}

/**
 * Generate complete CSV content from entries
 * Groups entries: admin+meetings together, then classes
 * Adds blank lines between dates within each section
 */
export function generateCsv(entries: Array<{
  date: string;
  startTime: string;
  endTime: string;
  employeeExternalId: string;
  payCategoryExternalId: string;
  comments: string;
  units: number;
  sessionGroup?: 'admin' | 'meeting' | 'class';
  isAdminOrMeeting?: boolean;
}>): string {
  const header = generateCsvHeader();
  const rows: string[] = [];
  
  let lastIsAdminOrMeeting: boolean | null = null;
  let lastDate: string | null = null;
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isAdminOrMeeting = entry.isAdminOrMeeting ?? (entry.sessionGroup === 'admin' || entry.sessionGroup === 'meeting');
    
    // Add blank line between sections (admin+meetings -> classes)
    if (lastIsAdminOrMeeting !== null && lastIsAdminOrMeeting !== isAdminOrMeeting) {
      rows.push('');
      // Reset lastDate when transitioning sections to avoid double blank lines
      lastDate = null;
    }
    
    // Add blank line between dates within the same section
    if (lastDate !== null && entry.date !== lastDate && lastIsAdminOrMeeting === isAdminOrMeeting) {
      rows.push('');
    }
    
    rows.push(generateCsvRow(entry));
    
    lastIsAdminOrMeeting = isAdminOrMeeting;
    lastDate = entry.date;
  }
  
  return [header, ...rows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
