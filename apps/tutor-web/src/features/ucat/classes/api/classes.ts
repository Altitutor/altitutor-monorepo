import type { Json } from '@altitutor/shared'
import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type SessionRow = Database['public']['Views']['vtutor_sessions']['Row']
type ResourceRow = Database['public']['Views']['vtutor_ucat_sessions_resources']['Row'] & {
  question_stem_id?: string | null
}

export type UcatSessionWithResources = (SessionRow & { session_id: string }) & {
  resources: Array<
    | { type: 'set'; id: string; set_id: string; name: string; section_index: number; section_name: string; question_count: number; index: number }
    | { type: 'mock'; id: string; mock_id: string; name: string; set_count: number; question_counts: number[]; index: number }
    | { type: 'stem'; id: string; stem_id: string; name: string; index: number }
    | { type: 'lesson'; id: string; lesson_id: string; name: string; block_count: number; index: number }
  >
}

export const ucatClassesApi = {
  /** Sessions for a class (all dates). Default date filter in the UI is today onward. */
  async sessionsForClass(classId: string): Promise<UcatSessionWithResources[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>

    const { data: sessionsData, error: sessionsError } = await supabase
      .from('vtutor_sessions')
      .select('*')
      .eq('class_id', classId)
      .order('start_at', { ascending: true })

    if (sessionsError) throw sessionsError
    const sessions = (sessionsData ?? []).filter(
      (s): s is SessionRow & { session_id: string } => s.session_id != null
    )
    if (sessions.length === 0) return []

    const sessionIds = sessions.map((s) => s.session_id)
    const { data: resourcesData, error: resourcesError } = await supabase
      .from('vtutor_ucat_sessions_resources')
      .select('*')
      .in('session_id', sessionIds)
      .order('index', { ascending: true })

    if (resourcesError) throw resourcesError
    const resources = (resourcesData ?? []) as ResourceRow[]

    const setIds = [...new Set(resources.map((r) => r.question_set_id).filter(Boolean))] as string[]
    const mockIds = [...new Set(resources.map((r) => r.ucat_mock_id).filter(Boolean))] as string[]
    const stemIds = [...new Set(resources.map((r) => r.question_stem_id).filter(Boolean))] as string[]
    const lessonIds = [...new Set(resources.map((r) => r.ucat_learning_module_id).filter(Boolean))] as string[]

    const setsMap: Record<string, { name: unknown; sections: unknown; question_count: number }> = {}
    const mocksMap: Record<string, { name: string | null; sets: unknown }> = {}
    const stemsMap: Record<string, { stem_text: unknown }> = {}
    const lessonsMap: Record<string, { title: string; block_count: number }> = {}

    if (setIds.length > 0) {
      const { data: setsData } = await supabase
        .from('vtutor_ucat_question_sets')
        .select('id, name, sections, question_count, deleted_at')
        .in('id', setIds)
      for (const row of setsData ?? []) {
        const r = row as { id: string; name: unknown; sections: unknown; question_count: number; deleted_at?: string | null }
        if (r.deleted_at != null) continue
        if (r.id) setsMap[r.id] = { name: r.name, sections: r.sections, question_count: r.question_count ?? 0 }
      }
    }

    if (mockIds.length > 0) {
      const { data: mocksData } = await supabase
        .from('vtutor_ucat_mock_detail')
        .select('id, name, sets, deleted_at')
        .in('id', mockIds)
      for (const row of mocksData ?? []) {
        const r = row as { id: string; name: string | null; sets: unknown; deleted_at?: string | null }
        if (r.deleted_at != null) continue
        if (r.id) mocksMap[r.id] = { name: r.name, sets: r.sets }
      }
    }

    if (stemIds.length > 0) {
      const { data: stemsData } = await supabase
        .from('vtutor_ucat_question_stems')
        .select('id, stem_text, deleted_at')
        .in('id', stemIds)
      for (const row of stemsData ?? []) {
        const r = row as { id: string; stem_text: unknown; deleted_at?: string | null }
        if (r.deleted_at != null) continue
        if (r.id) stemsMap[r.id] = { stem_text: r.stem_text }
      }
    }

    if (lessonIds.length > 0) {
      const { data: lessonsData } = await supabase
        .from('vtutor_ucat_learning_modules')
        .select('id, title, block_count, kind, deleted_at')
        .in('id', lessonIds)
      for (const row of lessonsData ?? []) {
        const r = row as {
          id: string
          title: string | null
          block_count: number | null
          kind: string | null
          deleted_at?: string | null
        }
        if (r.deleted_at != null || r.kind !== 'lesson') continue
        if (r.id) lessonsMap[r.id] = { title: r.title ?? 'Untitled lesson', block_count: r.block_count ?? 0 }
      }
    }

    const sectionInfo = (sections: unknown): { index: number; name: string } => {
      if (!sections || !Array.isArray(sections)) return { index: 1, name: '' }
      const first = sections[0]
      if (first && typeof first === 'object' && first !== null) {
        const name = 'name' in first ? proseMirrorToPlainText((first as { name: Json }).name) : ''
        const index = typeof (first as { section_number?: number }).section_number === 'number'
          ? (first as { section_number: number }).section_number
          : 1
        return { index, name }
      }
      return { index: 1, name: '' }
    }

    const resourcesBySession = sessions.map((s) => {
      const list = resources
        .filter((r) => r.session_id === s.session_id)
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      const mapped = list.map((r) => {
        if (r.question_set_id) {
          const setInfo = setsMap[r.question_set_id]
          const { index: section_index, name: section_name } = sectionInfo(setInfo?.sections)
          return {
            type: 'set' as const,
            id: r.id ?? '',
            set_id: r.question_set_id,
            name: proseMirrorToPlainText(setInfo?.name as Json | undefined),
            section_index,
            section_name,
            question_count: setInfo?.question_count ?? 0,
            index: r.index ?? 0,
          }
        }
        if (r.ucat_mock_id) {
          const mockInfo = mocksMap[r.ucat_mock_id]
          const setsArr = Array.isArray(mockInfo?.sets) ? mockInfo.sets as Array<{ question_count?: number }> : []
          const question_counts = setsArr.map((s) => s?.question_count ?? 0)
          return {
            type: 'mock' as const,
            id: r.id ?? '',
            mock_id: r.ucat_mock_id,
            name: mockInfo?.name ?? 'Untitled',
            set_count: setsArr.length,
            question_counts,
            index: r.index ?? 0,
          }
        }
        if (r.question_stem_id) {
          const stemInfo = stemsMap[r.question_stem_id]
          const name =
            proseMirrorToPlainText(stemInfo?.stem_text as Json | undefined).trim() || 'Question stem'
          return {
            type: 'stem' as const,
            id: r.id ?? '',
            stem_id: r.question_stem_id,
            name: name.length > 80 ? `${name.slice(0, 77)}…` : name,
            index: r.index ?? 0,
          }
        }
        if (r.ucat_learning_module_id) {
          const lessonInfo = lessonsMap[r.ucat_learning_module_id]
          return {
            type: 'lesson' as const,
            id: r.id ?? '',
            lesson_id: r.ucat_learning_module_id,
            name: lessonInfo?.title ?? 'Lesson',
            block_count: lessonInfo?.block_count ?? 0,
            index: r.index ?? 0,
          }
        }
        return null
      })
      return { session: s, resources: mapped.filter(Boolean) as UcatSessionWithResources['resources'] }
    })

    return resourcesBySession.map(({ session, resources: res }) => ({
      ...session,
      resources: res,
    }))
  },

  /**
   * Replace all session resources for the given assignments (batch save).
   * Payload: { assignments: Array<{ session_id, resources: Array<{ resource_type: 'set'|'mock'|'stem'|'lesson', resource_id, index }> }> }
   */
  async replaceSessionResources(assignments: Array<{
    session_id: string
    resources: Array<{ resource_type: 'set' | 'mock' | 'stem' | 'lesson'; resource_id: string; index: number }>
  }>): Promise<void> {
    const res = await fetch('/api/ucat/classes/sessions-resources', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to save session resources')
    }
  },
}
