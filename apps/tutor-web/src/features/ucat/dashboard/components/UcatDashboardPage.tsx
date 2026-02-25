'use client'

import Link from 'next/link'
import { Skeleton } from '@altitutor/ui'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader } from '@/features/ucat/shared/components'
import { cn } from '@/shared/utils'

type Card = { title: string; description: string; href: string }

const sections: { heading: string; cards: Card[] }[] = [
  {
    heading: 'Questions',
    cards: [
      {
        title: 'Questions',
        description: 'Manage question stems, multiple-choice questions, and syllogisms',
        href: '/ucat/questions',
      },
      {
        title: 'Sets',
        description: 'Build and sequence UCAT question sets',
        href: '/ucat/sets',
      },
      {
        title: 'Mocks',
        description: 'Assemble full mock exams from ordered sets',
        href: '/ucat/mocks',
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
      },
      {
        title: 'Question Tags',
        description: 'Create reusable tags for question-level classification',
        href: '/ucat/question-tags',
      },
      {
        title: 'Sections',
        description: 'Manage UCAT section metadata and display layout',
        href: '/ucat/sections',
      },
    ],
  },
]

export function UcatDashboardPage() {
  const access = useUcatAccess()

  if (access.isLoading) {
    return (
      <div className="p-6 space-y-8">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-72" />
        {[3, 1, 3].map((count, sectionIndex) => (
          <div key={sectionIndex} className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="rounded-lg bg-muted/50 p-5">
                  <Skeleton className="h-6 w-36" />
                  <Skeleton className="mt-2 h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="p-6">
      <UcatPageHeader
        title="UCAT"
        description="Tutor UCAT management dashboard"
        breadcrumbs={[{ label: 'UCAT' }]}
      />

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {section.heading}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {section.cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className={cn(
                    'block rounded-lg bg-muted/50 p-5 shadow-sm transition-colors',
                    'hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
