/**
 * Command Palette Configuration
 * 
 * This file defines all searchable commands, pages, and entity types for the Command Palette.
 * 
 * ## Adding New Pages
 * Pages added to `navItems` in `apps/admin-web/src/app/(admin)/layout.tsx` are automatically
 * searchable. No additional configuration needed.
 * 
 * For settings pages or other pages not in navItems, add them to the `additionalPages` array below.
 * 
 * ## Adding New Commands
 * 1. Add the command to `QUICK_ACTIONS` in `apps/admin-web/src/shared/constants/quickActions.ts`
 * 2. The action will be wired up automatically via `useCommandPaletteCommandActions` hook
 * 3. If the command needs custom handling, update `useCommandPaletteCommandActions` hook
 * 
 * ## Adding/Removing Entity Types
 * 1. Update the `entityTypes` object below
 * 2. Ensure the corresponding search RPC exists in the database (e.g., `search_students_admin`)
 * 3. Update `useCommandPaletteSearch` hook to include the new entity type
 */

import {
  AlertTriangle,
  GraduationCap,
  UserRound,
  Users,
  Calendar,
  CreditCard,
  FileText,
  Beaker,
  Newspaper,
  Settings,
  Clock,
  Ban,
  Link2,
  Zap,
  File,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { QUICK_ACTIONS } from '@/shared/constants/quickActions';

export type CommandAction = () => void;

export interface CommandPaletteCommand {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  keywords?: string[]; // Additional search keywords
  action: CommandAction;
}

export interface CommandPalettePage {
  id: string;
  title: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[]; // Additional search keywords
}

export interface EntityTypeConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  limit: number; // Max results per entity type
  enabled: boolean; // Can be disabled without removing from config
}

/**
 * Commands that can be executed from the Command Palette
 * These trigger actions rather than navigation
 * 
 * Commands are derived from QUICK_ACTIONS to ensure consistency across
 * dashboard, floating menu, and command palette
 */
export const commands: CommandPaletteCommand[] = QUICK_ACTIONS.map((action) => ({
  id: action.id,
  title: action.title,
  description: action.description,
  icon: action.icon,
  keywords: action.keywords,
  action: () => {}, // Will be set by CommandPalette component via useCommandPaletteCommands
}));

/**
 * Pages that can be navigated to from the Command Palette
 * 
 * NOTE: Pages are automatically extracted from navItems in layout.tsx
 * This array includes additional pages (like settings sub-pages) that aren't in the main nav
 */
export const additionalPages: CommandPalettePage[] = [
  // Settings pages
  {
    id: 'settings-opening-hours',
    title: 'Opening Hours',
    href: '/settings/opening-hours',
    icon: Clock,
    keywords: ['opening', 'hours', 'schedule'],
  },
  {
    id: 'settings-blockouts',
    title: 'Blockout Dates',
    href: '/settings/blockouts',
    icon: Ban,
    keywords: ['blockout', 'dates', 'unavailable'],
  },
  {
    id: 'settings-booking',
    title: 'Booking Settings',
    href: '/settings/booking',
    icon: Calendar,
    keywords: ['booking', 'settings', 'config'],
  },
  {
    id: 'settings-templates',
    title: 'Message Templates',
    href: '/settings/templates',
    icon: FileText,
    keywords: ['templates', 'messages', 'message'],
  },
  {
    id: 'settings-automation',
    title: 'Automation Rules',
    href: '/settings/automation',
    icon: Zap,
    keywords: ['automation', 'rules', 'auto'],
  },
  {
    id: 'settings-billing',
    title: 'Billing Settings',
    href: '/settings/billing',
    icon: CreditCard,
    keywords: ['billing', 'pricing', 'settings'],
  },
  {
    id: 'settings-stripe-sync',
    title: 'Stripe Sync',
    href: '/settings/stripe-sync',
    icon: Link2,
    keywords: ['stripe', 'sync', 'payment'],
  },
  // Main settings page
  {
    id: 'settings',
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    keywords: ['settings', 'config', 'preferences'],
  },
  // My Account page
  {
    id: 'my-account',
    title: 'My Account',
    href: '/my-account',
    icon: UserRound,
    keywords: ['account', 'profile', 'my'],
  },
];

/**
 * Entity types that can be searched
 * Each entity type uses its corresponding RPC function for search
 */
export const entityTypes: Record<string, EntityTypeConfig> = {
  students: {
    id: 'students',
    label: 'Students',
    icon: GraduationCap,
    limit: 8,
    enabled: true,
  },
  staff: {
    id: 'staff',
    label: 'Staff',
    icon: Users,
    limit: 8,
    enabled: true,
  },
  parents: {
    id: 'parents',
    label: 'Parents',
    icon: UserRound,
    limit: 8,
    enabled: true,
  },
  classes: {
    id: 'classes',
    label: 'Classes',
    icon: Calendar,
    limit: 8,
    enabled: true,
  },
  subjects: {
    id: 'subjects',
    label: 'Subjects',
    icon: Beaker,
    limit: 8,
    enabled: true,
  },
  topics: {
    id: 'topics',
    label: 'Topics',
    icon: Newspaper,
    limit: 8,
    enabled: true,
  },
  files: {
    id: 'files',
    label: 'Files',
    icon: File,
    limit: 8,
    enabled: true,
  },
};

/**
 * Helper function to extract pages from navItems
 * This ensures pages added to the sidebar are automatically searchable
 */
export function extractPagesFromNavItems(navItems: Array<{ title: string; href: string; icon: LucideIcon }>): CommandPalettePage[] {
  return navItems
    .filter((item): item is { title: string; href: string; icon: LucideIcon } => 
      'href' in item && 'icon' in item
    )
    .map((item) => ({
      id: item.href,
      title: item.title,
      href: item.href,
      icon: item.icon,
    }));
}
