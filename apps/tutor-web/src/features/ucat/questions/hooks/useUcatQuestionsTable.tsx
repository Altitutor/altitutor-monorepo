import { useMemo } from 'react'
import type { DataTableState, Json } from '@altitutor/shared'
import type { UcatQuestionSourceChannel } from '@/features/ucat/questions/api/questions'
import type { UcatAccessScope, UcatContentStatus } from '@/features/ucat/shared/types'
import { buildStemSourceDisplay, type StemSourceDisplay } from '@/features/ucat/questions/lib/source-display'
import {
  applyBooleanTextFilter,
  applyCategoryFilter,
  applyMultiSelectFilter,
  applySort,
  applyTagFilter,
  getFilterValues,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { parseJsonUuidArray } from '@/features/ucat/shared/lib/parse-json-uuid-array'
import { resolveCategoryPathLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import { UCAT_FILTER_NO_CATEGORY, UCAT_FILTER_NOT_IN_ANY_SET } from '@/features/ucat/shared/lib/table-filter-sentinel'
import {
  CREATED_AT_WINDOW_FILTER_KEY,
  rowMatchesCreatedAtWindow,
} from '@/features/ucat/questions/lib/find-similar-question-stems'

export type QuestionSearchScope =
  | 'stem_text'
  | 'question_text'
  | 'answer_option_text'
  | 'tutor_source_note'

export type QuestionRow = {
  id: string
  section_name: string
  section_id: string | null
  category_name: string | null
  question_stem_category_id: string | null
  question_count: number
  access_scope: UcatAccessScope
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  created_by_name: string
  tag_ids: string[]
  type_summary: string
  stem_text: string
  question_text: string
  answer_option_text: string
  tutor_source_note: string
  set_names: string
  sets: Array<{ id: string; name: string }>
  set_ids: string[]
  deleted_at: string | null
  status: UcatContentStatus
  source_channel: UcatQuestionSourceChannel | null
  source: StemSourceDisplay
  is_available_in_question_pool: boolean
}

type QuestionListRowInput = {
  id?: string | null
  section_name?: string | null
  section_id?: string | null
  category_name?: string | null
  question_stem_category_id?: string | null
  question_count?: number | null
  access_scope?: UcatAccessScope | null
  created_at?: string | null
  updated_at?: string | null
  created_by?: string | null
  stem_text?: unknown
  set_names?: unknown
  set_ids?: unknown
  deleted_at?: string | null
  status?: UcatContentStatus | null
  is_available_in_question_pool?: boolean | null
  source_channel?: UcatQuestionSourceChannel | null
  ai_generation_metadata?: unknown
  tutor_source_note?: string | null
  created_by_first_name?: string | null
  created_by_last_name?: string | null
  status_changed_at?: string | null
  status_changed_by_first_name?: string | null
  status_changed_by_last_name?: string | null
}

function parseStemSets(setNamesRaw: unknown, setIds: string[]): Array<{ id: string; name: string }> {
  const namesArr = Array.isArray(setNamesRaw) ? (setNamesRaw as Json[]) : []
  return setIds.map((id, index) => ({
    id,
    name: proseMirrorToPlainText(namesArr[index]) || 'Untitled',
  }))
}

export function countStemsInSets(stemIds: string[], rows: QuestionRow[]): number {
  return stemIds.filter((id) => (rows.find((row) => row.id === id)?.set_ids.length ?? 0) > 0).length
}

type UseUcatQuestionsTableParams<T extends QuestionListRowInput> = {
  data: T[] | undefined
  stemTypes: Record<string, Iterable<string>>
  stemTagIds: Record<string, string[]>
  questionSearchTexts: Record<string, { questionText: string; answerOptionText: string }> | undefined
  categoryPathLookup: Map<string, string>
  tableState: DataTableState
  showDeleted: boolean
  status: UcatContentStatus
  searchScopes: QuestionSearchScope[]
}

export function useUcatQuestionsTable<T extends QuestionListRowInput>({
  data,
  stemTypes,
  stemTagIds,
  questionSearchTexts,
  categoryPathLookup,
  tableState,
  showDeleted,
  status,
  searchScopes,
}: UseUcatQuestionsTableParams<T>) {
  const rows = useMemo(
    () =>
      (data ?? []).map((row) => {
        const summary = row.id ? Array.from(stemTypes[row.id] ?? []).join(', ') : ''
        const searchTexts = row.id ? questionSearchTexts?.[row.id] : null
        const setIds = parseJsonUuidArray(row.set_ids)
        const sets = parseStemSets(row.set_names, setIds)
        const setsDisplay = sets.length > 0 ? sets.map((set) => set.name).join(', ') : '—'
        const creatorName = [row.created_by_first_name, row.created_by_last_name]
          .filter(Boolean)
          .join(' ')
        return {
          id: row.id ?? '',
          section_name: row.section_name ?? '-',
          section_id: row.section_id ?? null,
          category_name: row.category_name ?? null,
          question_stem_category_id: row.question_stem_category_id ?? null,
          question_count: row.question_count ?? 0,
          access_scope: row.access_scope ?? 'public',
          created_at: row.created_at ?? null,
          updated_at: row.updated_at ?? null,
          created_by: row.created_by ?? null,
          created_by_name: creatorName || (row.created_by ? 'Unknown staff' : ''),
          tag_ids: row.id ? (stemTagIds[row.id] ?? []) : [],
          type_summary: summary || '-',
          stem_text: row.stem_text ? proseMirrorToPlainText(row.stem_text as Json) : '',
          question_text: searchTexts?.questionText ?? '',
          answer_option_text: searchTexts?.answerOptionText ?? '',
          tutor_source_note: (row.tutor_source_note ?? '').trim(),
          set_names: setsDisplay,
          sets,
          set_ids: setIds,
          deleted_at: row.deleted_at ?? null,
          status: row.status ?? 'draft',
          source_channel: row.source_channel ?? 'individual',
          source: buildStemSourceDisplay({
            sourceChannel: row.source_channel,
            aiGenerationMetadata: row.ai_generation_metadata as Json | null | undefined,
            tutorSourceNote: row.tutor_source_note,
            createdByFirstName: row.created_by_first_name,
            createdByLastName: row.created_by_last_name,
            statusChangedByFirstName: row.status_changed_by_first_name,
            statusChangedByLastName: row.status_changed_by_last_name,
            statusChangedAt: row.status_changed_at,
          }),
          is_available_in_question_pool: row.is_available_in_question_pool ?? false,
        }
      }),
    [data, stemTypes, stemTagIds, questionSearchTexts],
  )

  const filteredRows = useMemo(() => {
    const byDeleted = showDeleted
      ? rows.filter((row) => row.deleted_at != null)
      : rows.filter((row) => row.deleted_at == null && row.status === status)
    const search = tableState.search.trim().toLowerCase()

    return byDeleted.filter((row) => {
      const searchHit =
        search.length === 0 || searchScopes.some((scope) => row[scope].toLowerCase().includes(search))

      const sectionHit = applyMultiSelectFilter(tableState, 'section_id', row.section_id)
      const categoryHit = applyCategoryFilter(
        tableState,
        row.question_stem_category_id,
        UCAT_FILTER_NO_CATEGORY,
      )
      const tagHit = applyTagFilter(tableState, row.tag_ids)
      const visibilityHit = applyBooleanTextFilter(
        tableState,
        'visibility',
        row.access_scope === 'private',
      )

      const sourceHit = applyMultiSelectFilter(tableState, 'source_channel', row.source_channel)
      const createdByHit = applyMultiSelectFilter(tableState, 'created_by', row.created_by)

      const createdAtWindows = getFilterValues(tableState, CREATED_AT_WINDOW_FILTER_KEY)
      const createdAtWindowHit =
        createdAtWindows.length === 0 ||
        createdAtWindows.some((windowRaw) => rowMatchesCreatedAtWindow(row.created_at, windowRaw))

      const typeSelected = (tableState.filters.question_type?.[0] as string | undefined) ?? 'all'
      const typeHit =
        typeSelected === 'all' ||
        (typeSelected === 'multiple_choice' && row.type_summary.includes('multiple_choice')) ||
        (typeSelected === 'syllogism' && row.type_summary.includes('syllogism'))

      const selectedSetIds = getFilterValues(tableState, 'question_set_id').map(String)
      const wantsNotInAnySet = selectedSetIds.includes(UCAT_FILTER_NOT_IN_ANY_SET)
      const specificSetIds = selectedSetIds.filter((id) => id !== UCAT_FILTER_NOT_IN_ANY_SET)
      const setHit =
        selectedSetIds.length === 0 ||
        (wantsNotInAnySet && row.set_ids.length === 0) ||
        specificSetIds.some((sid) => row.set_ids.includes(sid))

      return (
        searchHit &&
        sectionHit &&
        categoryHit &&
        tagHit &&
        visibilityHit &&
        typeHit &&
        setHit &&
        sourceHit &&
        createdByHit &&
        createdAtWindowHit
      )
    })
  }, [rows, tableState, showDeleted, status, searchScopes])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.sortBy, tableState.sortDirection, {
        section_name: (row) => row.section_name,
        category_name: (row) =>
          resolveCategoryPathLabel(categoryPathLookup, row.question_stem_category_id, row.category_name),
        stem_text: (row) => row.stem_text,
        question_count: (row) => row.question_count,
        sets: (row) => row.set_names,
        type_summary: (row) => row.type_summary,
        visibility: (row) => (row.access_scope === 'private' ? 'Private' : 'Public'),
        source: (row) => row.source.channelLabel,
        created_at: (row) => row.created_at,
        status: (row) => row.status,
      }),
    [filteredRows, tableState.sortBy, tableState.sortDirection, categoryPathLookup],
  )

  return { rows: sortedRows }
}
