'use client'

import Link from 'next/link'
import { Card, CardContent } from '@altitutor/ui'
import { UcatPageHeader } from '@/features/layout'
import { SECTION_NUMBER_TO_NAME } from '@/features/sets/lib/section-labels'
import { ListChecks } from 'lucide-react'

const SECTIONS = [1, 2, 3, 4] as const

export function SetsLandingPage() {
  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Sets"
        description="Choose a section to browse and practice question sets."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((num) => {
          const label = SECTION_NUMBER_TO_NAME[num] ?? `Section ${num}`
          return (
            <Link key={num} href={`/sets/sections/${num}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-col items-center gap-3 p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sidebar text-sidebar-foreground">
                    <ListChecks className="h-6 w-6" />
                  </div>
                  <span className="text-center font-medium">{label}</span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
