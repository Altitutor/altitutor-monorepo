'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { CalendarDays, Clock, Users } from 'lucide-react'
import { UcatPagePlaceholder } from '@altitutor/ui'
import { useStudentUcatSessions } from '@/features/sessions/hooks/use-sessions'

function getAdelaideDayStatus(startAtIso: string | null | undefined): 'past' | 'today' | 'future' {
  if (!startAtIso) return 'future'

  // Convert to Adelaide time and compare dates only
  const adelaideTz = 'Australia/Adelaide'
  const now = new Date()

  const todayParts = new Intl.DateTimeFormat('en-AU', {
    timeZone: adelaideTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value
      return acc
    }, {})

  const startDate = new Date(startAtIso)
  const startParts = new Intl.DateTimeFormat('en-AU', {
    timeZone: adelaideTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(startDate)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value
      return acc
    }, {})

  const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`
  const startKey = `${startParts.year}-${startParts.month}-${startParts.day}`

  if (startKey === todayKey) return 'today'
  if (startKey < todayKey) return 'past'
  return 'future'
}

export function SessionsListPage() {
  const { data, isLoading, error } = useStudentUcatSessions()

  const grouped = useMemo(() => data ?? [], [data])

  if (isLoading) {
    return (
      <UcatPagePlaceholder title="Sessions" description="Your upcoming and past UCAT class sessions.">
        <p className="text-sm text-muted-foreground">Loading sessions...</p>
      </UcatPagePlaceholder>
    )
  }

  if (error) {
    return (
      <UcatPagePlaceholder title="Sessions" description="Your upcoming and past UCAT class sessions.">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load sessions'}
        </p>
      </UcatPagePlaceholder>
    )
  }

  if (!grouped || grouped.length === 0) {
    return (
      <UcatPagePlaceholder title="Sessions" description="Your upcoming and past UCAT class sessions.">
        <p className="text-sm text-muted-foreground">You don&apos;t have any UCAT sessions yet.</p>
      </UcatPagePlaceholder>
    )
  }

  return (
    <UcatPagePlaceholder title="Sessions" description="View your UCAT classes and sessions.">
      <div className="space-y-6">
        {grouped.map((cls) => (
          <section
            key={cls.class_id}
            className="space-y-3 rounded-xl bg-card text-card-foreground p-4 shadow-sm border border-border"
          >
            <header className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold leading-tight">
                  {cls.subject_name}
                  {cls.class_level ? <span className="ml-1 text-xs text-muted-foreground">({cls.class_level})</span> : null}
                </h2>
                {cls.class_status ? (
                  <p className="text-xs text-muted-foreground capitalize">Status: {cls.class_status.toLowerCase()}</p>
                ) : null}
              </div>
            </header>

            <ul className="space-y-2">
              {cls.sessions.map((session) => {
                const status = getAdelaideDayStatus(session.start_at)
                const isPast = status === 'past'
                const isToday = status === 'today'

                const baseClasses =
                  'flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors'
                const variantClasses = isToday
                  ? 'bg-sidebar/80 text-sidebar-foreground'
                  : isPast
                    ? 'bg-muted/60 text-muted-foreground'
                    : 'bg-card text-card-foreground hover:bg-muted'

                const href = session.session_id
                  ? `/sessions/${encodeURIComponent(session.session_id as string)}`
                  : '#'

                const dateLabel = session.start_at
                  ? new Intl.DateTimeFormat('en-AU', {
                      timeZone: 'Australia/Adelaide',
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                    }).format(new Date(session.start_at))
                  : 'Date TBC'

                const timeLabel =
                  session.start_at && session.end_at
                    ? `${new Intl.DateTimeFormat('en-AU', {
                        timeZone: 'Australia/Adelaide',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(session.start_at))} - ${new Intl.DateTimeFormat('en-AU', {
                        timeZone: 'Australia/Adelaide',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(session.end_at))}`
                    : null

                return (
                  <li key={session.session_id}>
                    <Link href={href} className={`${baseClasses} ${variantClasses}`}>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-medium">
                            {dateLabel}
                            {isToday ? <span className="ml-2 rounded bg-background px-1 text-xs font-semibold">Today</span> : null}
                          </p>
                          {timeLabel ? <p className="text-xs opacity-80">{timeLabel}</p> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {session.room ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{session.room}</span>
                          </span>
                        ) : null}
                        {session.students ? (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>
                              {Array.isArray(session.students) ? session.students.length : 'Classmates'}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </UcatPagePlaceholder>
  )
}

