'use client'

import Link from 'next/link'
import { Button, Skeleton } from '@altitutor/ui'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader } from '@/features/ucat/shared/components'

const cards = [
  {
    title: 'Sections',
    description: 'Manage UCAT section metadata and display layout',
    href: '/ucat/sections',
  },
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
  {
    title: 'Students',
    description: 'Track student progress and attempt history',
    href: '/ucat/students',
  },
]

export function UcatDashboardPage() {
  const access = useUcatAccess()

  if (access.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-72" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-lg bg-muted/50 p-5">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-6 h-9 w-32" />
            </div>
          ))}
        </div>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <article key={card.href} className="rounded-lg bg-muted/50 p-5 shadow-sm">
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
            <div className="mt-4">
              <Button asChild>
                <Link href={card.href}>Open {card.title}</Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
