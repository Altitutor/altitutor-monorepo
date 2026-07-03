import {
  Beaker,
  BookOpen,
  BrainCircuit,
  Calendar,
  Dumbbell,
  File,
  FileQuestion,
  FolderTree,
  GitMerge,
  Home,
  Layers,
  LayoutGrid,
  Newspaper,
  School,
  ScrollText,
  Settings,
  Tag,
  TrendingUp,
  Users,
  Brain,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getResourceSubjectHref, getResourceSubjectNavLabel } from '@altitutor/shared';
import type { ResourceSubjectNavItem } from '@/features/resources/lib/types';

export interface CommandPalettePage {
  id: string;
  title: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
}

export interface EntityTypeConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  limit: number;
  enabled: boolean;
}

export const entityTypes: Record<string, EntityTypeConfig> = {
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
  flashcards: {
    id: 'flashcards',
    label: 'Flashcards',
    icon: Brain,
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
};

export const staticPages: CommandPalettePage[] = [
  { id: 'dashboard', title: 'Dashboard', href: '/dashboard', icon: Home },
  { id: 'classes', title: 'Classes', href: '/classes', icon: Calendar, keywords: ['sessions', 'schedule'] },
  { id: 'pay-tier', title: 'Pay tier', href: '/pay-tier', icon: TrendingUp, keywords: ['pay', 'salary', 'wage'] },
  { id: 'resources', title: 'Resources', href: '/resources', icon: BookOpen, keywords: ['subjects', 'topics', 'files'] },
  { id: 'settings', title: 'Settings', href: '/settings', icon: Settings },
  {
    id: 'settings-profile',
    title: 'My Profile',
    href: '/settings/profile',
    icon: Users,
    keywords: ['profile', 'account'],
  },
  {
    id: 'settings-blockouts',
    title: 'Blockout dates',
    href: '/settings/blockouts',
    icon: Calendar,
    keywords: ['blockout', 'unavailable'],
  },
];

export const ucatPages: CommandPalettePage[] = [
  { id: 'ucat', title: 'UCAT', href: '/ucat', icon: BrainCircuit },
  { id: 'ucat-learning-modules', title: 'UCAT learning modules', href: '/ucat/learning-modules', icon: BookOpen },
  {
    id: 'ucat-skill-trainer-questions',
    title: 'UCAT Skill trainer',
    href: '/ucat/skill-trainer-questions',
    icon: Dumbbell,
  },
  { id: 'ucat-questions', title: 'UCAT questions', href: '/ucat/questions', icon: FileQuestion },
  { id: 'ucat-sets', title: 'UCAT sets', href: '/ucat/sets', icon: Layers },
  { id: 'ucat-mocks', title: 'UCAT mocks', href: '/ucat/mocks', icon: ScrollText },
  { id: 'ucat-students', title: 'UCAT students', href: '/ucat/students', icon: Users },
  { id: 'ucat-classes', title: 'UCAT classes', href: '/ucat/classes', icon: School },
  { id: 'ucat-reconciliation', title: 'UCAT reconciliation', href: '/ucat/reconciliation', icon: GitMerge },
  { id: 'ucat-question-tags', title: 'UCAT question tags', href: '/ucat/question-tags', icon: Tag },
  {
    id: 'ucat-question-stem-categories',
    title: 'UCAT question stem categories',
    href: '/ucat/question-stem-categories',
    icon: FolderTree,
  },
  { id: 'ucat-sections', title: 'UCAT sections', href: '/ucat/sections', icon: LayoutGrid },
];

export function buildSubjectPages(subjects: ResourceSubjectNavItem[]): CommandPalettePage[] {
  return subjects.map((subject) => ({
    id: `subject-page-${subject.id}`,
    title: getResourceSubjectNavLabel(subject),
    href: getResourceSubjectHref(subject),
    icon: BookOpen,
    keywords: [subject.short_name ?? '', subject.name ?? '', subject.long_name ?? ''].filter(Boolean),
  }));
}

export function extractPagesFromNavItems(
  navItems: Array<{ title: string; href: string; icon: LucideIcon }>,
): CommandPalettePage[] {
  return navItems.map((item) => ({
    id: item.href,
    title: item.title,
    href: item.href,
    icon: item.icon,
  }));
}
