'use client'

import Link from 'next/link'
import { Button } from '@altitutor/ui'
import { TrendingUp } from 'lucide-react'
import { UcatPageHeader } from '@/features/ucat/shared/components'
import { useUcatStudentSummary } from '@/features/ucat/students/hooks/useUcatStudents'
import { useProgress } from '../hooks/useProgress'
import { SectionProgressCards } from './section-progress-cards'
import { StudentScoreProgress } from './student-score-progress'
import { StudentReviewActivity } from './student-review-activity'

type ProgressPageProps = {
  studentId: string
  basePath: string
  studentName?: string
}

export function ProgressPage({
  studentId,
  basePath,
  studentName: studentNameProp,
}: ProgressPageProps) {
  const { data, isLoading, error } = useProgress(studentId)
  const { data: summary } = useUcatStudentSummary(studentId)
  const studentName =
    studentNameProp ??
    (summary as { student_name?: string } | undefined)?.student_name

  const title = studentName ? `Progress – ${studentName}` : 'Progress'
  const description = studentName
    ? `Track ${studentName}'s performance across sections, set attempts, and mock exams.`
    : 'Track performance across sections, set attempts, and mock exams.'

  if (isLoading) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader
          title={title}
          description="Loading progress..."
          backHref={
            basePath.split('/').slice(0, -1).join('/') || '/ucat/students'
          }
          backLabel="Back"
        />
        <div className="animate-pulse space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader
          title={title}
          description="Could not load progress."
          backHref={
            basePath.split('/').slice(0, -1).join('/') || '/ucat/students'
          }
          backLabel="Back"
        />
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader
          title={title}
          description="No progress data available."
          backHref={
            basePath.split('/').slice(0, -1).join('/') || '/ucat/students'
          }
          backLabel="Back"
        />
      </div>
    )
  }

  return (
    <div className="pb-8">
      <div className="px-5 py-6 sm:px-6">
        <UcatPageHeader
          title={title}
          description={description}
          backHref="/ucat/students"
          backLabel="Students"
          actions={
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`${basePath}/mocks`}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Mock progress
              </Link>
            </Button>
          }
          breadcrumbs={[
            { label: 'UCAT', href: '/ucat' },
            { label: 'Students', href: '/ucat/students' },
            { label: studentName ?? 'Student' },
          ]}
        />
      </div>

      <StudentScoreProgress data={data} studentName={studentName} />

      <div className="mx-auto grid w-full max-w-[1400px] gap-5 px-5 pt-6 sm:px-6 lg:grid-cols-2 lg:items-start">
        <StudentReviewActivity data={data} />
        <section aria-label="Sections">
          <SectionProgressCards
            sections={data.sectionProgress}
            linkToSection
            basePath={basePath}
            mode="all_time"
            timeFrameDays="30"
          />
        </section>
      </div>
    </div>
  )
}
