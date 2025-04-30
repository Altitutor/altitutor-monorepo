import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Subject } from '@/lib/supabase/db/types'

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
export function formatSubjectDisplay(subject: Subject): string {
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