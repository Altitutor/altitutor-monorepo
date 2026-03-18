import type { ComponentType } from 'react'
import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  NotebookText,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { isComingSoon } from '@/features/layout/config/coming-soon'

export type DashboardCard = {
  href: string
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}

const cards: DashboardCard[] = [
  {
    href: '/progress',
    label: 'Progress',
    description: 'Track your performance and improvement over time',
    icon: TrendingUp,
  },
  {
    href: '/learn',
    label: 'Learn',
    description: 'Study materials and resources for UCAT preparation',
    icon: BookOpen,
  },
  {
    href: '/sessions',
    label: 'Sessions',
    description: 'View and manage your tutoring sessions',
    icon: CalendarDays,
  },
  {
    href: '/practice',
    label: 'Practice',
    description: 'Practice questions and drills',
    icon: BrainCircuit,
  },
  {
    href: '/sets/set-generator',
    label: 'Set Generator',
    description: 'Create custom question sets',
    icon: Sparkles,
  },
  {
    href: '/mocks',
    label: 'Mocks',
    description: 'Full-length mock exams',
    icon: NotebookText,
  },
]

export const dashboardCards = cards.map((card) => ({
  ...card,
  comingSoon: isComingSoon(card.href),
}))
