'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition, DataTableFilterDefinition } from '@altitutor/shared'
import { Button, DataTable, DataTableToolbar } from '@altitutor/ui'
import { Pencil, Trash2 } from 'lucide-react'
import {
  useCreateUcatQuestionStem,
  useDeleteUcatQuestionStem,
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatQuestions,
  useUcatSections,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatQuestionStemDialog } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@altitutor/shared'
import { applyBooleanTextFilter, applySingleSelectFilter, useUcatTableState, useVisibleColumns } from '@/features/ucat/shared/hooks/useUcatTableState'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'

type QuestionRow = {
  id: string
  section_name: string
  section_id: string | null
  category_name: string | null
  question_stem_category_id: string | null
  question_count: number
  is_private: boolean
  updated_at: string | null
  type_summary: string
  stem_text: string
}

const filterDefinitions: DataTableFilterDefinition[] = [
  { key: 'section_id', label: 'Section' },
  { key: 'question_stem_category_id', label: 'Category' },
  {
    key: 'visibility',
    label: 'Visibility',
    options: [
      { label: 'Public', value: 'public' },
      { label: 'Private', value: 'private' },
    ],
  },
  {
    key: 'question_type',
    label: 'Type',
    options: [
      { label: 'Multiple Choice', value: 'multiple_choice' },
      { label: 'Syllogism', value: 'syllogism' },
    ],
  },
]

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'section_name', label: 'Section', visibleByDefault: true },
  { key: 'category_name', label: 'Category', visibleByDefault: true },
  { key: 'question_count', label: 'Questions', visibleByDefault: true },
  { key: 'type_summary', label: 'Type', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
  { key: 'updated_at', label: 'Updated', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

export function UcatQuestionsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingStemId, setEditingStemId] = useState<string | null>(null)
  const [stemTypes, setStemTypes] = useState<Record<string, Set<'multiple_choice' | 'syllogism'>>>({})

  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key))

  const access = useUcatAccess()
  const questions = useUcatQuestions()
  const sections = useUcatSections()
  const categories = useUcatCategories()
  const detail = useUcatQuestionDetail(editingStemId)

  const createMutation = useCreateUcatQuestionStem()
  const updateMutation = useUpdateUcatQuestionStem()
  const deleteMutation = useDeleteUcatQuestionStem()

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>
      const { data } = await supabase.from('vtutor_ucat_question_stem_detail').select('id,questions')

      const map: Record<string, Set<'multiple_choice' | 'syllogism'>> = {}
      ;(data ?? []).forEach((row: any) => {
        const types = new Set<'multiple_choice' | 'syllogism'>()
        ;(row.questions ?? []).forEach((question: any) => {
          if (question.question_type === 'multiple_choice' || question.question_type === 'syllogism') {
            types.add(question.question_type)
          }
        })
        map[row.id] = types
      })

      setStemTypes(map)
    }

    void run()
  }, [])

  const rows: QuestionRow[] = (questions.data ?? []).map((row) => {
    const summary = row.id ? Array.from(stemTypes[row.id] ?? []).join(', ') : ''
    return {
      id: row.id ?? '',
      section_name: row.section_name ?? '-',
      section_id: row.section_id,
      category_name: row.category_name,
      question_stem_category_id: row.question_stem_category_id,
      question_count: row.question_count ?? 0,
      is_private: !!row.is_private,
      updated_at: row.updated_at,
      type_summary: summary || '-',
      stem_text: row.stem_text ? JSON.stringify(row.stem_text) : '',
    }
  })

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()

    return rows.filter((row) => {
      const searchHit =
        search.length === 0 ||
        row.stem_text.toLowerCase().includes(search) ||
        row.section_name.toLowerCase().includes(search) ||
        (row.category_name ?? '').toLowerCase().includes(search)

      const sectionHit = applySingleSelectFilter(tableState.state, 'section_id', row.section_id)
      const categoryHit = applySingleSelectFilter(tableState.state, 'question_stem_category_id', row.question_stem_category_id)
      const visibilityHit = applyBooleanTextFilter(tableState.state, 'visibility', row.is_private)

      const typeSelected = (tableState.state.filters.question_type?.[0] as string | undefined) ?? 'all'
      const typeHit =
        typeSelected === 'all' ||
        (typeSelected === 'multiple_choice' && row.type_summary.includes('multiple_choice')) ||
        (typeSelected === 'syllogism' && row.type_summary.includes('syllogism'))

      return searchHit && sectionHit && categoryHit && visibilityHit && typeHit
    })
  }, [rows, tableState.state])

  const allColumns: Array<{ key: string; column: ColumnDef<QuestionRow> }> = [
    { key: 'section_name', column: { accessorKey: 'section_name', header: 'Section' } },
    {
      key: 'category_name',
      column: { accessorKey: 'category_name', header: 'Category', cell: ({ row }) => row.original.category_name ?? '-' },
    },
    { key: 'question_count', column: { accessorKey: 'question_count', header: 'Questions' } },
    { key: 'type_summary', column: { accessorKey: 'type_summary', header: 'Type' } },
    {
      key: 'visibility',
      column: { accessorKey: 'is_private', header: 'Visibility', cell: ({ row }) => (row.original.is_private ? 'Private' : 'Public') },
    },
    {
      key: 'updated_at',
      column: {
        accessorKey: 'updated_at',
        header: 'Updated',
        cell: ({ row }) => (row.original.updated_at ? new Date(row.original.updated_at).toLocaleString() : '-'),
      },
    },
    {
      key: 'actions',
      column: {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <UcatRowActions
              actions={[
                { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => setEditingStemId(row.original.id) },
                {
                  label: 'Delete',
                  icon: <Trash2 className="h-4 w-4" />,
                  onClick: () => deleteMutation.mutate(row.original.id),
                  destructive: true,
                },
              ]}
            />
          </div>
        ),
      },
    },
  ]

  const visibleColumns = useVisibleColumns(allColumns, tableState.state.visibleColumns)

  async function handleCreate(payload: any) {
    const mapped: UcatQuestionStemBundlePayload = {
      sectionId: payload.sectionId,
      categoryId: payload.categoryId || null,
      stemText: payload.stemText,
      isPrivate: payload.isPrivate,
      questions: payload.questions.map((question: any, index: number) => ({
        index: index + 1,
        questionText: question.questionText,
        questionType: question.questionType,
        difficulty: question.difficulty,
        timeBurdenSeconds: question.timeBurdenSeconds,
        tagIds: question.tagIds ?? [],
        options: question.options.map((option: any, optionIndex: number) => ({
          index: optionIndex + 1,
          answerText: option.answerText,
          answerExplanation: option.answerExplanation,
          isAnswer: option.isAnswer,
        })),
      })),
    }

    await createMutation.mutateAsync(mapped)
    setCreateOpen(false)
  }

  async function handleUpdate(payload: any) {
    if (!editingStemId) return

    const mapped: UcatQuestionStemBundlePayload = {
      stemId: editingStemId,
      sectionId: payload.sectionId,
      categoryId: payload.categoryId || null,
      stemText: payload.stemText,
      isPrivate: payload.isPrivate,
      questions: payload.questions.map((question: any, index: number) => ({
        index: index + 1,
        questionText: question.questionText,
        questionType: question.questionType,
        difficulty: question.difficulty,
        timeBurdenSeconds: question.timeBurdenSeconds,
        tagIds: question.tagIds ?? [],
        options: question.options.map((option: any, optionIndex: number) => ({
          index: optionIndex + 1,
          answerText: option.answerText,
          answerExplanation: option.answerExplanation,
          isAnswer: option.isAnswer,
        })),
      })),
    }

    await updateMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
    setEditingStemId(null)
  }

  if (access.isLoading || questions.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  const sectionFilterDefs: DataTableFilterDefinition[] = [
    {
      ...filterDefinitions[0],
      options: (sections.data ?? []).map((s) => ({ label: s.name ?? 'Untitled', value: s.id ?? '' })),
    },
    {
      ...filterDefinitions[1],
      options: (categories.data ?? []).map((c) => ({ label: c.name ?? 'Untitled', value: c.id ?? '' })),
    },
    filterDefinitions[2],
    filterDefinitions[3],
  ]

  return (
    <div className="p-6">
      <UcatPageHeader
        title="UCAT Questions"
        description="Manage question stems and nested questions"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Questions' }]}
        actions={<Button onClick={() => setCreateOpen(true)}>Add Question Stem</Button>}
      />

      <DataTableToolbar
        state={tableState.state}
        onSearchChange={tableState.actions.onSearchChange}
        onFiltersChange={tableState.actions.onFiltersChange}
        onSortChange={tableState.actions.onSortChange}
        onGroupByChange={tableState.actions.onGroupByChange}
        onVisibleColumnsChange={tableState.actions.onVisibleColumnsChange}
        onQuickFilterApply={tableState.actions.onQuickFilterApply}
        onReset={tableState.actions.onReset}
        filterDefinitions={sectionFilterDefs}
        columnDefinitions={columnDefinitions}
        searchPlaceholder="Search questions"
      />

      <div className="pt-3">
        <DataTable columns={visibleColumns} data={filteredRows} pageSizeOptions={[10, 20, 50]} />
      </div>

      <UcatQuestionStemDialog
        open={createOpen}
        title="Create Question Stem"
        submitLabel="Create"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        sections={(sections.data ?? []).map((section) => ({ id: section.id, name: section.name }))}
        categories={(categories.data ?? []).map((category) => ({ id: category.id, name: category.name }))}
        loading={createMutation.isPending}
      />

      <UcatQuestionStemDialog
        open={!!editingStemId}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => setEditingStemId(null)}
        onSubmit={handleUpdate}
        sections={(sections.data ?? []).map((section) => ({ id: section.id, name: section.name }))}
        categories={(categories.data ?? []).map((category) => ({ id: category.id, name: category.name }))}
        initial={detail.data}
        loading={updateMutation.isPending || detail.isLoading}
      />
    </div>
  )
}
