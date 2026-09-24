'use client'

import { useMemo } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui'
import { format, subDays } from 'date-fns'
import type { ProgressResponse } from '@altitutor/shared'
import { cn } from '@/shared/utils'

const intensityClasses = [
  'bg-muted/60',
  'bg-primary/20',
  'bg-primary/40',
  'bg-primary/65',
  'bg-primary',
]

export function StudentReviewActivity({ data }: { data: ProgressResponse }) {
  const { days, activityByDate } = useMemo(() => {
    const map = new Map<string, { questions: number; sets: number }>()
    for (const attempt of data.questionAttempts) {
      const key = attempt.attemptedAt.slice(0, 10)
      const current = map.get(key) ?? { questions: 0, sets: 0 }
      current.questions += 1
      map.set(key, current)
    }
    for (const attempt of data.setAttempts) {
      const key = (attempt.completedAt ?? attempt.attemptedAt).slice(0, 10)
      const current = map.get(key) ?? { questions: 0, sets: 0 }
      current.sets += 1
      map.set(key, current)
    }

    const today = new Date()
    const start = subDays(today, 83)
    return {
      activityByDate: map,
      days: Array.from({ length: 84 }, (_, index) => {
        const date = new Date(start)
        date.setDate(start.getDate() + index)
        return date
      }),
    }
  }, [data.questionAttempts, data.setAttempts])

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="h-full rounded-2xl border-0 shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10">
        <CardHeader>
          <CardTitle className="text-base">Review activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-2">
            {days.map((date) => {
              const key = format(date, 'yyyy-MM-dd')
              const activity = activityByDate.get(key)
              const total = (activity?.questions ?? 0) + (activity?.sets ?? 0)
              const intensity =
                total === 0
                  ? 0
                  : total < 5
                    ? 1
                    : total < 15
                      ? 2
                      : total < 30
                        ? 3
                        : 4
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'size-4 rounded-[4px] ring-1 ring-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:ring-white/[0.06]',
                        intensityClasses[intensity],
                      )}
                      aria-label={`${format(date, 'd MMMM yyyy')}: ${activity?.questions ?? 0} question attempts, ${activity?.sets ?? 0} set attempts`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{format(date, 'd MMMM yyyy')}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity?.questions ?? 0} questions ·{' '}
                      {activity?.sets ?? 0} sets
                    </p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          <div className="mt-4 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
            <span>Less</span>
            {intensityClasses.map((className) => (
              <span
                key={className}
                className={cn('size-3 rounded-[3px]', className)}
              />
            ))}
            <span>More</span>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
