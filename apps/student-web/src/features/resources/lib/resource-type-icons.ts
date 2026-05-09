import {
  BookOpen,
  ClipboardList,
  Edit3,
  File,
  GraduationCap,
  Layers,
  ScrollText,
  StickyNote,
  Video,
  type LucideIcon,
} from 'lucide-react';

const RESOURCE_TYPE_ICON: Record<string, LucideIcon> = {
  NOTES: BookOpen,
  TEST: ClipboardList,
  PRACTICE_QUESTIONS: Edit3,
  VIDEO: Video,
  EXAM: GraduationCap,
  FLASHCARDS: Layers,
  REVISION_SHEET: ScrollText,
  CHEAT_SHEET: StickyNote,
};

const RESOURCE_TYPE_ACCENT: Record<string, string> = {
  NOTES: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  TEST: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  PRACTICE_QUESTIONS: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  VIDEO: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  EXAM: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
  FLASHCARDS: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
  REVISION_SHEET: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  CHEAT_SHEET: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
};

export function getResourceTypeIcon(type: string): LucideIcon {
  return RESOURCE_TYPE_ICON[type] ?? File;
}

export function getResourceTypeAccent(type: string): string {
  return RESOURCE_TYPE_ACCENT[type] ?? 'bg-muted text-muted-foreground';
}
