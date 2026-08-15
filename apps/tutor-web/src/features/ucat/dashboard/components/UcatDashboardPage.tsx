'use client'

import {
  BookOpen,
  FileQuestion,
  FolderTree,
  GitMerge,
  LayoutGrid,
  Layers,
  School,
  ScrollText,
  Tag,
  Dumbbell,
  type LucideIcon,
  Users,
} from 'lucide-react'
import { ClickableNavCard, Skeleton } from '@altitutor/ui'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader } from '@/features/ucat/shared/components'
import { TutorPageContainer } from '@/shared/components/layouts'
import { tutorCardCn } from '@/shared/lib/tutor-visual'

type UcatNavCard = {
  title: string
  description: string
  href: string
  icon: LucideIcon
}

const sections: { heading: string; cards: UcatNavCard[] }[] = [
  {
    heading: 'Learn and practice',
    cards: [
      {
        title: 'Learning modules',
        description: 'Build structured learning paths with content blocks and drills',
        href: '/ucat/learning-modules',
        icon: BookOpen,
      },
      {
        title: 'Skill trainer',
        description: 'Author drill items for each UCAT skill trainer type',
        href: '/ucat/skill-trainer-questions',
        icon: Dumbbell,
      },
    ],
  },
  {
    heading: 'Questions',
    cards: [
      {
        title: 'Questions',
        description: 'Manage question stems and their response contracts',
        href: '/ucat/questions',
        icon: FileQuestion,
      },
      {
        title: 'Sets',
        description: 'Build and sequence UCAT question sets',
        href: '/ucat/sets',
        icon: Layers,
      },
      {
        title: 'Mocks',
        description: 'Assemble full mock exams from ordered sets',
        href: '/ucat/mocks',
        icon: ScrollText,
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
      },
      {
        title: 'Classes',
        description: 'View UCAT classes and assign sets and mocks to sessions',
        href: '/ucat/classes',
        icon: School,
      },
    ],
  },
  {
    heading: 'Settings',
    cards: [
      {
        title: 'Reconciliation',
        description: 'Fix uncategorized stems and questions missing explanations',
        href: '/ucat/reconciliation',
        icon: GitMerge,
      },
      {
        title: 'Question tags',
        description: 'Create reusable tags for question-level classification',
        href: '/ucat/question-tags',
        icon: Tag,
      },
      {
        title: 'Question stem categories',
        description: 'Organize question stems with section-scoped categories',
        href: '/ucat/question-stem-categories',
        icon: FolderTree,
      },
      {
        title: 'Sections',
        description: 'Manage UCAT section metadata and display layout',
        href: '/ucat/sections',
        icon: LayoutGrid,
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
        {[2, 3, 2, 4].map((count, sectionIndex) => (
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
                {section.cards.map((card) => (
                  <li key={card.href} className="flex min-w-0 flex-col">
                    <ClickableNavCard
                      href={card.href}
                      icon={card.icon}
                      title={card.title}
                      description={card.description}
                      cardClassName={tutorCardCn()}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </TutorPageContainer>
  )
}
