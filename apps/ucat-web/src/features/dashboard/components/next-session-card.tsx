'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { useStudentUcatSessions } from '@/features/sessions/hooks/use-sessions'
import type { StudentUcatSession } from '@/features/sessions/api/sessions-api'

const ADELAIDE_TZ = 'Australia/Adelaide'

function getAdelaideDayStatus(startAtIso: string | null | undefined): 'past' | 'today' | 'future' {
  if (!startAtIso) return 'future'
  const now = new Date()
  const todayParts = new Intl.DateTimeFormat('en-AU', {
    timeZone: ADELAIDE_TZ,
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
    timeZone: ADELAIDE_TZ,
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

function getNextSession(sessions: StudentUcatSession[]): StudentUcatSession | null {
  const now = new Date()
  const upcoming = sessions.filter((s) => {
    const status = getAdelaideDayStatus(s.start_at)
    if (status === 'future') return true
    if (status === 'today') {
      const endAt = s.end_at ? new Date(s.end_at) : null
      return endAt ? endAt >= now : true
    }
    return false
  })
  upcoming.sort((a, b) => {
    const aTime = a.start_at ? new Date(a.start_at).getTime() : 0
    const bTime = b.start_at ? new Date(b.start_at).getTime() : 0
    return aTime - bTime
  })
  return upcoming[0] ?? null
}

export function NextSessionCard() {
  const { data: classesWithSessions, isLoading } = useStudentUcatSessions()

  const nextSession = useMemo(() => {
    if (!classesWithSessions || classesWithSessions.length === 0) return null
    const allSessions = classesWithSessions.flatMap((c) => c.sessions)
    return getNextSession(allSessions)
  }, [classesWithSessions])

  const classInfo = useMemo(() => {
    if (!nextSession || !classesWithSessions) return null
    return classesWithSessions.find((c) => c.class_id === nextSession.class_id)
  }, [nextSession, classesWithSessions])

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Next UCAT session</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Next UCAT session</CardTitle>
        <Link
          href="/sessions"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {!nextSession ? (
          <p className="text-sm text-muted-foreground">No upcoming sessions</p>
        ) : (
          <Link
            href={`/sessions/${encodeURIComponent(nextSession.session_id)}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {nextSession.start_at
                  ? new Intl.DateTimeFormat('en-AU', {
                      timeZone: ADELAIDE_TZ,
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    }).format(new Date(nextSession.start_at))
                  : 'Date TBC'}
              </p>
              <p className="text-xs text-muted-foreground">
                {nextSession.start_at && nextSession.end_at
                  ? new Intl.DateTimeFormat('en-AU', {
                      timeZone: ADELAIDE_TZ,
                      hour: 'numeric',
                      minute: '2-digit',
                    }).formatRange(
                      new Date(nextSession.start_at),
                      new Date(nextSession.end_at)
                    )
                  : null}
                {classInfo?.class_level ? (
                  <span className="ml-1">· {classInfo.class_level}</span>
                ) : null}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
