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
export function formatSubjectDisplay(subject: Tables<'subjects'>): string {
  return [
    subject.curriculum || '',
    subject.year_level ? subject.year_level : '',
    subject.name || '',
    subject.level || ''
  ].filter(Boolean).join(' ').trim();
}

/**
 * Format a subject short name for compact display
 * Format: {curriculum} {year_level}{nickname} {level} (no space between year_level and nickname)
 * Where nickname is the first 4 letters of the subject name, capitalized
 * Example: "SACE 12MATH Standard" for "SACE 12 Mathematics Standard"
 */
export function formatSubjectShortName(subject: Tables<'subjects'>): string {
  const parts: string[] = [];
  
  // Add curriculum
  if (subject.curriculum) {
    parts.push(subject.curriculum);
  }
  
  // Add year level and nickname together (no space)
  const yearLevel = subject.year_level != null ? String(subject.year_level) : '';
  const nickname = subject.name ? subject.name.substring(0, 4).toUpperCase() : '';
  
  if (yearLevel || nickname) {
    parts.push(`${yearLevel}${nickname}`);
  }
  
  // Add level
  if (subject.level) {
    parts.push(subject.level);
  }
  
  return parts.filter(Boolean).join(' ').trim();
}

/**
 * Format a class name for consistent display across the application
 * Format: {curriculum} {year_level} {subject_name} {day} {start_time} - {end_time}
 * Example: "SACE 12 Mathematics Mon 2:00 PM - 4:00 PM"
 */
export function formatClassName(
  classData: Tables<'classes'>,
  subject?: Tables<'subjects'> | null
): string {
  const parts: string[] = [];
  
  // Add curriculum
  if (subject?.curriculum) {
    parts.push(subject.curriculum);
  }
  
  // Add year level
  if (subject?.year_level != null) {
    parts.push(String(subject.year_level));
  }
  
  // Add subject name
  if (subject?.name) {
    parts.push(subject.name);
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
 * Example: "SACE 12MATH Mon 2:00 PM"
 */
export function formatClassShortName(
  classData: Tables<'classes'>,
  subject?: Tables<'subjects'> | null
): string {
  const parts: string[] = [];
  
  // Add subject short name
  if (subject) {
    parts.push(formatSubjectShortName(subject));
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
export const navHoverStyles = "hover:bg-brand-lightBlue/10 text-brand-darkBlue dark:text-white dark:hover:bg-brand-dark-card/70 dark:hover:text-white" 

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

// Re-export enum color utilities from shared UI package
export * from '@altitutor/ui';
export * from './subject-icons';
 