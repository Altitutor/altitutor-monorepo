import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@altitutor/shared'

type StudentSessionRow = Database['public']['Views']['vstudent_sessions']['Row']
type StudentSessionResourceRow = Database['public']['Views']['vstudent_ucat_sessions_resources']['Row']
type StudentClassRow = Database['public']['Tables']['classes']['Row']

export type StudentUcatSession = StudentSessionRow & {
  session_id: string
  class_id: string
  subject_name: string
}

export type StudentUcatClassWithSessions = {
  class_id: string
  class_level: string | null
  class_status: string | null
  subject_name: string
  subject_color: string | null
  sessions: StudentUcatSession[]
}

export type StudentUcatSessionResource =
  | {
      id: string
      type: 'set'
      question_set_id: string
    }
  | {
      id: string
      type: 'mock'
      ucat_mock_id: string
    }

type SupabaseClient = ReturnType<typeof getSupabaseBrowserClient>

function getClient(): SupabaseClient {
  return getSupabaseBrowserClient()
}

export async function getStudentUcatClassesWithSessions(): Promise<StudentUcatClassWithSessions[]> {
  const supabase = getClient()

  // 1) Fetch all sessions the student is in (all subjects), then filter to UCAT via subject_name
  const { data: sessionsData, error: sessionsError } = await supabase.from('vstudent_sessions').select('*')
  if (sessionsError) throw sessionsError

  const sessions = (sessionsData ?? []).filter(
    (s): s is StudentUcatSession =>
      !!s.session_id && !!s.class_id && (s.subject_name ?? '').toUpperCase() === 'UCAT'
  )

  if (sessions.length === 0) {
    return []
  }

  // 2) Group by class
  const byClass = new Map<string, StudentUcatClassWithSessions>()
  for (const session of sessions) {
    const classId = session.class_id
    if (!byClass.has(classId)) {
      byClass.set(classId, {
        class_id: classId,
        class_level: session.class_level,
        class_status: session.class_status,
        subject_name: session.subject_name ?? 'UCAT',
        subject_color: session.subject_color ?? null,
        sessions: [],
      })
    }
    byClass.get(classId)!.sessions.push(session)
  }

  // 3) Sort sessions within each class by start_at ascending
  const result: StudentUcatClassWithSessions[] = []
  for (const [, value] of byClass) {
    value.sessions.sort((a, b) => {
      const aTime = a.start_at ? new Date(a.start_at).getTime() : 0
      const bTime = b.start_at ? new Date(b.start_at).getTime() : 0
      return aTime - bTime
    })
    result.push(value)
  }

  // 4) Sort classes by the first session start time
  result.sort((a, b) => {
    const aFirst = a.sessions[0]
    const bFirst = b.sessions[0]
    const aTime = aFirst?.start_at ? new Date(aFirst.start_at).getTime() : 0
    const bTime = bFirst?.start_at ? new Date(bFirst.start_at).getTime() : 0
    return aTime - bTime
  })

  return result
}

export async function getStudentUcatSessionResources(sessionId: string): Promise<StudentUcatSessionResource[]> {
  const supabase = getClient()

  const { data, error } = await supabase
    .from('vstudent_ucat_sessions_resources')
    .select('id, session_id, question_set_id, ucat_mock_id, index')
    .eq('session_id', sessionId)
    .order('index', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as StudentSessionResourceRow[]

  return rows
    .map((row): StudentUcatSessionResource | null => {
      if (row.question_set_id) {
        return {
          id: row.id ?? '',
          type: 'set',
          question_set_id: row.question_set_id,
        }
      }
      if (row.ucat_mock_id) {
        return {
          id: row.id ?? '',
          type: 'mock',
          ucat_mock_id: row.ucat_mock_id,
        }
      }
      return null
    })
    .filter((item): item is StudentUcatSessionResource => item !== null)
}

