/**
 * Shared Quick Actions Configuration
 * 
 * This file defines all quick actions available across the application:
 * - Dashboard quick actions buttons
 * - Floating quick actions menu
 * - Command palette commands
 * 
 * This ensures consistency across all three interfaces.
 */

import {
  Calendar,
  FileText,
  Megaphone,
  CheckSquare,
  AlertTriangle,
  Mail,
  FolderKanban,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type BookingSessionType = 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';

export interface QuickActionConfig {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  keywords?: string[]; // For command palette search
  // For booking actions, specify the session type
  bookingSessionType?: BookingSessionType;
  // For other actions, specify the action type
  actionType?: 'tutor-log' | 'log-student-absence' | 'log-staff-absence' | 'create-task' | 'announcement' | 'create-issue' | 'create-project';
}

/**
 * All quick actions available in the application
 * Ordered by: booking actions first, then other actions
 */
export const QUICK_ACTIONS: QuickActionConfig[] = [
  // Booking actions
  {
    id: 'trial-session',
    title: 'Trial session',
    description: 'Book a new trial session',
    icon: Calendar,
    keywords: ['trial', 'book', 'session'],
    bookingSessionType: 'TRIAL_SESSION',
  },
  {
    id: 'subsidy-interview',
    title: 'Subsidy interview',
    description: 'Book a subsidy interview',
    icon: Calendar,
    keywords: ['subsidy', 'interview', 'book'],
    bookingSessionType: 'SUBSIDY_INTERVIEW',
  },
  {
    id: 'drafting',
    title: 'Drafting',
    description: 'Book a drafting session',
    icon: Calendar,
    keywords: ['drafting', 'draft', 'book'],
    bookingSessionType: 'DRAFTING',
  },
  // Other actions
  {
    id: 'add-task',
    title: 'Add Task',
    description: 'Create a new task',
    icon: CheckSquare,
    keywords: ['task', 'create', 'new', 'todo'],
    actionType: 'create-task',
  },
  {
    id: 'add-issue',
    title: 'Add Issue',
    description: 'Create a new issue',
    icon: AlertTriangle,
    keywords: ['issue', 'create', 'new', 'ticket'],
    actionType: 'create-issue',
  },
  {
    id: 'add-project',
    title: 'Add Project',
    description: 'Create a new project',
    icon: FolderKanban,
    keywords: ['project', 'create', 'new'],
    actionType: 'create-project',
  },
  {
    id: 'make-announcement',
    title: 'Make Announcement',
    description: 'Create and send an announcement',
    icon: Megaphone,
    keywords: ['announcement', 'announce', 'message', 'broadcast'],
    actionType: 'announcement',
  },
  {
    id: 'tutor-log',
    title: 'Tutor Log',
    description: 'Create a new tutor log entry',
    icon: FileText,
    keywords: ['log', 'tutor', 'entry'],
    actionType: 'tutor-log',
  },
  {
    id: 'log-student-absence',
    title: 'Log Student Absence',
    description: 'Record a student absence',
    icon: AlertTriangle,
    keywords: ['absence', 'student', 'log', 'record'],
    actionType: 'log-student-absence',
  },
  {
    id: 'log-staff-absence',
    title: 'Log Staff Absence',
    description: 'Record a staff absence',
    icon: AlertTriangle,
    keywords: ['absence', 'staff', 'log', 'record'],
    actionType: 'log-staff-absence',
  },
];

/**
 * Get booking actions only
 */
export function getBookingActions(): QuickActionConfig[] {
  return QUICK_ACTIONS.filter((action) => action.bookingSessionType !== undefined);
}

/**
 * Get non-booking actions only
 */
export function getNonBookingActions(): QuickActionConfig[] {
  return QUICK_ACTIONS.filter((action) => action.bookingSessionType === undefined);
}

/**
 * Get action by ID
 */
export function getQuickActionById(id: string): QuickActionConfig | undefined {
  return QUICK_ACTIONS.find((action) => action.id === id);
}

/**
 * Session-scoped quick actions (shown in session ActionsMenu when conditions are met).
 * Same conditions as in UI: sessionId present, session type !== 'CLASS'.
 */
export interface SessionQuickActionConfig {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  /** Used to wire the action in ActionsMenu */
  sessionActionType: 'send-booking-confirmation';
}

export const SESSION_QUICK_ACTIONS: SessionQuickActionConfig[] = [
  {
    id: 'send-booking-confirmation',
    title: 'Send Booking Confirmation Link',
    description: 'Send the booking confirmation link for this session to a student’s parent(s)',
    icon: Mail,
    sessionActionType: 'send-booking-confirmation',
  },
];
