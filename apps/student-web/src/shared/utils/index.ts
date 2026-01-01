import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Tables } from '@altitutor/shared'
import type React from 'react'

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
 * Navigation hover styles for consistent UI
 */
export const navHoverStyles = "hover:bg-brand-lightBlue/10 text-brand-darkBlue dark:text-white dark:hover:bg-brand-dark-card/70 dark:hover:text-white" 

/**
 * Calculate luminance from RGB values using WCAG formula
 */
function getLuminanceFromRgb(r: number, g: number, b: number): number {
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

// Re-export enum color utilities from shared UI package
export * from '@altitutor/ui'; 