import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Tables } from '@altitutor/shared'
import type React from 'react'

/**
 * Safely extract error message from unknown error type
 * Use this in catch blocks instead of `error: any`
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

/**
 * Type guard to check if error has Stripe error properties
 */
function isStripeError(error: unknown): error is { statusCode?: number; type?: string; code?: string; message?: string } {
  return (
    error !== null &&
    typeof error === 'object' &&
    ('statusCode' in error || 'type' in error || 'code' in error)
  );
}

/**
 * Extract Stripe error details safely
 */
export function getStripeErrorDetails(error: unknown): { type?: string; code?: string; statusCode?: number } {
  if (isStripeError(error)) {
    return {
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
    };
  }
  return {};
}

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
 * Navigation hover styles for consistent UI
 */
export const navHoverStyles = "hover:bg-muted text-brand-darkBlue dark:text-white dark:hover:bg-muted/50 dark:hover:text-white" 

/**
 * Calculate luminance from RGB values using WCAG formula
 */
export function getLuminanceFromRgb(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate luminance of a hex color to determine if text should be light or dark
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return getLuminanceFromRgb(rgb.r, rgb.g, rgb.b);
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
    'STAFF_INTERVIEW': 'Staff Interview',
    'ADMIN_SHIFT': 'Admin Shift',
    'CHECK_IN': 'Check-in',
    'TRIAL_SHIFT': 'Trial Shift', // Legacy type, may not be in enum but handle gracefully
  };
  
  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Get badge color classes for a session type
 * Returns Tailwind CSS classes for consistent badge styling
 */
export function getSessionTypeBadgeColor(type: string | null | undefined): string {
  if (!type) return 'bg-gray-100 text-gray-800';
  
  switch (type) {
    case 'CLASS':
      return 'bg-blue-100 text-blue-800';
    case 'DRAFTING':
      return 'bg-purple-100 text-purple-800';
    case 'SUBSIDY_INTERVIEW':
      return 'bg-yellow-100 text-yellow-800';
    case 'TRIAL_SESSION':
      return 'bg-green-100 text-green-800';
    case 'TRIAL_SHIFT':
      return 'bg-orange-100 text-orange-800';
    case 'EXAM_COURSE':
      return 'bg-indigo-100 text-indigo-800';
    case 'STAFF_INTERVIEW':
      return 'bg-pink-100 text-pink-800';
    case 'ADMIN_SHIFT':
      return 'bg-slate-100 text-slate-800';
    case 'CHECK_IN':
      return 'bg-teal-100 text-teal-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Re-export enum color utilities from shared UI package
export * from '@altitutor/ui';
export * from './userHelpers';
export * from './subject-icons';
export * from './tableSorting';
export * from './filtering';
export * from './file-type-icons';
export * from './fileOperations';
export * from './toastHelpers';
 