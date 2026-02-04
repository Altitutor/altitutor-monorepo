import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Tables } from '@altitutor/shared'
import type React from 'react'
import { formatTime, getDayShortName } from './datetime'

/**
 * Combines class names with Tailwind's merge utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date to a human-readable string
 */
export function formatDate(date: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a timestamp to a human-readable string
 */
export function formatDateTime(date: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a subject for consistent display across the application
 * Combines curriculum, year level, name, and level in a standardized format
 */
/**
 * Get subject long name from database column
 * Falls back to empty string if not available
 */
export function formatSubjectDisplay(subject: Tables<'subjects'>): string {
  return subject.long_name || '';
}

/**
 * Get subject short name from database column
 * Falls back to empty string if not available
 */
export function formatSubjectShortName(subject: Tables<'subjects'>): string {
  return subject.short_name || '';
}

/**
 * Format a class name for consistent display across the application
 * Format: {subject_long_name} {day} {start_time} - {end_time}
 * Example: "SACE 12 Mathematics Mon 2:00 PM - 4:00 PM"
 */
export function formatClassName(
  classData: Tables<'classes'>,
  subject?: Tables<'subjects'> | null
): string {
  const parts: string[] = [];
  
  // Add subject long name from database column
  if (subject?.long_name) {
    parts.push(subject.long_name);
  }
  
  // Add day name (short)
  if (classData.day_of_week != null) {
    parts.push(getDayShortName(classData.day_of_week));
  }
  
  // Add time range
  if (classData.start_time && classData.end_time) {
    parts.push(`${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`);
  }
  
  return parts.join(' ');
}

/**
 * Format a class short name for compact display
 * Format: {subject_short_name} {day} {start_time}
 * Example: "12MATH Mon 2:00 PM"
 */
export function formatClassShortName(
  classData: Tables<'classes'>,
  subject?: Tables<'subjects'> | null
): string {
  const parts: string[] = [];
  
  // Add subject short name from database column
  if (subject?.short_name) {
    parts.push(subject.short_name);
  }
  
  // Add day name (short)
  if (classData.day_of_week != null) {
    parts.push(getDayShortName(classData.day_of_week));
  }
  
  // Add start time only
  if (classData.start_time) {
    parts.push(formatTime(classData.start_time));
  }
  
  return parts.join(' ');
}

/**
 * Navigation hover styles for consistent UI
 */
export const navHoverStyles = "hover:bg-muted text-brand-darkBlue dark:text-white dark:hover:bg-muted/50 dark:hover:text-white" 

/**
 * Calculate luminance of a hex color to determine if text should be light or dark
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  
  // Calculate relative luminance
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Get subject color style properties from subject.color
 * Returns an object with backgroundColor style and appropriate text color class
 */
export function getSubjectColorStyle(
  subject: Tables<'subjects'> | null | undefined
): { style: React.CSSProperties; textColorClass: string } {
  const defaultStyle = { backgroundColor: undefined };
  const defaultTextClass = 'text-gray-800';
  
  if (!subject?.color) {
    return { style: defaultStyle, textColorClass: defaultTextClass };
  }
  
  const hexColor = subject.color.startsWith('#') ? subject.color : `#${subject.color}`;
  const luminance = getLuminance(hexColor);
  
  // Use dark text for light backgrounds (luminance > 0.5), light text for dark backgrounds
  const textColorClass = luminance > 0.5 ? 'text-gray-900' : 'text-white';
  
  return {
    style: { backgroundColor: hexColor },
    textColorClass,
  };
}

/**
 * Get subject color as hex string, with fallback
 */
export function getSubjectColorHex(subject: Tables<'subjects'> | null | undefined): string | null {
  if (!subject?.color) return null;
  return subject.color.startsWith('#') ? subject.color : `#${subject.color}`;
}

/**
 * Get icon stroke color based on background color luminance
 * Returns a contrasting stroke color (light for dark backgrounds, dark for light backgrounds)
 */
export function getIconStrokeColor(hex: string | null | undefined): string {
  if (!hex) return 'currentColor'; // Use default text color if no background
  
  // Ensure hex has # prefix
  const hexColor = hex.startsWith('#') ? hex : `#${hex}`;
  
  // Calculate luminance
  const luminance = getLuminance(hexColor);
  
  // Use light stroke for dark backgrounds, dark stroke for light backgrounds
  return luminance > 0.5 ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
}

/**
 * Format a session type to a human-readable display name
 * Converts enum values like 'TRIAL_SESSION' to 'Trial Session'
 */
export function formatSessionType(type: string | null | undefined): string {
  if (!type) return 'Meeting';
  
  const typeMap: Record<string, string> = {
    'CLASS': 'Class',
    'DRAFTING': 'Drafting',
    'EXAM_COURSE': 'Exam Course',
    'SUBSIDY_INTERVIEW': 'Subsidy Interview',
    'TRIAL_SESSION': 'Trial Session',
    'MEETING': 'Meeting',
  };
  
  return typeMap[type] || type;
}

// Re-export enum color utilities from shared UI package
export * from '@altitutor/ui';
export * from './subject-icons';
 