import type { ComponentType } from 'react'
import { BookOpen, BrainCircuit, LayoutDashboard, ListChecks, NotebookText } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

export const appNavigation: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/learn', label: 'Learn', icon: BookOpen },
  { href: '/practice', label: 'Practice', icon: BrainCircuit },
  { href: '/sets', label: 'Sets', icon: ListChecks },
  { href: '/mocks', label: 'Mocks', icon: NotebookText },
]
