'use client'

import Link from 'next/link'
import {
  ArrowRight,
  FileQuestion,
  FolderTree,
  GitMerge,
  LayoutGrid,
  Layers,
  School,
  ScrollText,
  Tag,
  type LucideIcon,
  Users,
} from 'lucide-react'
import { Card, Skeleton } from '@altitutor/ui'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader } from '@/features/ucat/shared/components'
import { TutorPageContainer } from '@/shared/components/layouts'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import { cn } from '@/shared/utils'

type UcatNavCard = {
  title: string
  description: string
  href: string
  icon: LucideIcon
  accentClass: string
}

const sections: { heading: string; cards: UcatNavCard[] }[] = [
  {
    heading: 'Questions',
    cards: [
      {
        title: 'Questions',
        description: 'Manage question stems, multiple-choice questions, and syllogisms',
        href: '/ucat/questions',
        icon: FileQuestion,
        accentClass:
          'bg-brand-darkBlue/10 text-brand-darkBlue dark:bg-brand-lightBlue/15 dark:text-brand-lightBlue',
      },
      {
        title: 'Sets',
        description: 'Build and sequence UCAT question sets',
        href: '/ucat/sets',
        icon: Layers,
        accentClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      },
      {
        title: 'Mocks',
        description: 'Assemble full mock exams from ordered sets',
        href: '/ucat/mocks',
        icon: ScrollText,
        accentClass: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
      },
      {
        title: 'Reconciliation',
        description: 'Fix uncategorized stems and questions missing explanations',
        href: '/ucat/reconciliation',
        icon: GitMerge,
        accentClass: 'bg-orange-500/10 text-orange-800 dark:text-orange-300',
      },
    ],
  },
  {
    heading: 'Students',
    cards: [
      {
        title: 'Students',
        description: 'Track student progress and attempt history',
        href: '/ucat/students',
        icon: Users,
        accentClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
      },
      {
        title: 'Classes',
        description: 'View UCAT classes and assign sets and mocks to sessions',
        href: '/ucat/classes',
        icon: School,
        accentClass: 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-300',
      },
    ],
  },
  {
    heading: 'Settings',
    cards: [
      {
        title: 'Question Categories',
        description: 'Organize question stems with section-scoped categories',
        href: '/ucat/question-stem-categories',
        icon: FolderTree,
        accentClass: 'bg-teal-500/10 text-teal-800 dark:text-teal-300',
      },
      {
        title: 'Question Tags',
        description: 'Create reusable tags for question-level classification',
        href: '/ucat/question-tags',
        icon: Tag,
        accentClass: 'bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-300',
      },
      {
        title: 'Sections',
        description: 'Manage UCAT section metadata and display layout',
        href: '/ucat/sections',
        icon: LayoutGrid,
        accentClass: 'bg-slate-500/10 text-slate-800 dark:text-slate-300',
      },
    ],
  },
]

export function UcatDashboardPage() {
  const access = useUcatAccess()

  if (access.isLoading) {
    return (
      <TutorPageContainer className="space-y-8">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-72" />
        {[4, 2, 3].map((count, sectionIndex) => (
          <div key={sectionIndex} className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <ul className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: count }).map((_, index) => (
                <li key={index}>
                  <div className={tutorCardCn('p-5')}>
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-36" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </TutorPageContainer>
    )
  }

  if (!access.data) {
    return (
      <TutorPageContainer>
        <UcatAccessDenied />
      </TutorPageContainer>
    )
  }

  return (
    <TutorPageContainer className="space-y-8">
      <UcatPageHeader
        title="UCAT"
        description="Tutor UCAT management dashboard"
        breadcrumbs={[{ label: 'UCAT' }]}
      />

      <div className="space-y-8">
        {sections.map((section) => {
          const sectionId = `ucat-section-${section.heading.replace(/\s+/g, '-').toLowerCase()}`
          return (
            <section key={section.heading} aria-labelledby={sectionId} className="space-y-4">
              <h2 id={sectionId} className="text-2xl font-semibold">
                {section.heading}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {section.cards.map((card) => {
                  const Icon = card.icon
                  return (
                    <li key={card.href}>
                      <Link
                        href={card.href}
                        className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Card
                          className={cn(
                            tutorCardCn('h-full'),
                            'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]',
                          )}
                        >
                          <div className="flex items-start gap-4 p-5">
                            <div
                              className={cn(
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
                                card.accentClass,
                              )}
                            >
                              <Icon className="h-5 w-5" aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5 pr-1">
                              <p className="text-base font-semibold leading-snug tracking-tight text-card-foreground transition-colors duration-300 group-hover:text-brand-darkBlue dark:group-hover:text-brand-lightBlue">
                                {card.title}
                              </p>
                              <p className="text-sm leading-relaxed text-muted-foreground">{card.description}</p>
                            </div>
                            <ArrowRight
                              className={cn(
                                'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out',
                                'group-hover:translate-x-0.5 group-hover:text-foreground',
                              )}
                              aria-hidden
                            />
                          </div>
                        </Card>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </TutorPageContainer>
  )
}
