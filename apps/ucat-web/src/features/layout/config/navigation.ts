import type { ComponentType } from 'react'
import { BookOpen, BrainCircuit, CalendarDays, LayoutDashboard, ListChecks, NotebookText } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

export type NavSection = {
  /**
   * Optional section heading shown above the items (e.g. "LEARN").
   * If omitted, items are rendered without a heading (used for Dashboard).
   */
  title?: string
  items: NavItem[]
}

export const appNavigation: NavSection[] = [
  {
    // Top-level dashboard entry, no heading
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'LEARN',
    items: [
      { href: '/learn', label: 'Learn', icon: BookOpen },
      { href: '/sessions', label: 'Sessions', icon: CalendarDays },
    ],
  },
  {
    title: 'PRACTICE',
    items: [
      { href: '/practice', label: 'Practice', icon: BrainCircuit },
      { href: '/sets', label: 'Sets', icon: ListChecks },
      { href: '/mocks', label: 'Mocks', icon: NotebookText },
    ],
  },
]
