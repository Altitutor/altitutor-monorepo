'use client'

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  Button,
  DataTable,
  DataTableToolbar,
  Input,
  SearchableSelect,
  Switch,
  useToast,
} from '@altitutor/ui'
import { Pencil } from 'lucide-react'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { applyRangeFilter, applySingleSelectFilter, applySort, useUcatTableState, useVisibleColumns } from '@/features/ucat/shared/hooks/useUcatTableState'
import { useCreateUcatSection, useUcatSections, useUpdateUcatSection } from '@/features/ucat/sections/hooks/useUcatSections'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import type { Json } from '@altitutor/shared'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { tutorDataTableProps } from '@/shared/lib/tutor-visual'
import { formatSecondsToDuration, minutesSecondsToTotal } from '@/features/ucat/shared/lib/time-utils'

type SectionRow = {
  id: string
  section_number: number
  name: string
  display_columns: number
  instructions_text: Json | null
  time_limit_seconds: number | null
  number_of_questions: number | null
  time_per_question: number | null
  instructions_time_limit_seconds: number | null
}

type SectionDraft = {
  sectionNumber: string
  name: string
  displayColumns: '1' | '2'
  instructionsText: Json | null
  isTimed: boolean
  timeLimitMinutes: string
  timeLimitSeconds: string
  numberOfQuestions: string
  instructionsTimeLimitMinutes: string
  instructionsTimeLimitSeconds: string
}

const filterDefinitions: DataTableFilterDefinition[] = [
  {
    key: 'display_columns',
    label: 'Columns',
    options: [
      { label: '1 Column', value: '1' },
      { label: '2 Columns', value: '2' },
    ],
  },
  {
    type: 'number-range',
    key: 'time_limit_seconds',
    label: 'Time limit',
    minKey: 'time_limit_seconds_min',
    maxKey: 'time_limit_seconds_max',
  },
  {
    type: 'number-range',
    key: 'number_of_questions',
    label: 'Number of questions',
    minKey: 'number_of_questions_min',
    maxKey: 'number_of_questions_max',
  },
  {
    type: 'number-range',
    key: 'time_per_question',
    label: 'Time per question',
    minKey: 'time_per_question_min',
    maxKey: 'time_per_question_max',
  },
]

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'section_number', label: 'Section #', visibleByDefault: true },
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'display_columns', label: 'Display', visibleByDefault: false },
  { key: 'time_limit_seconds', label: 'Time limit', visibleByDefault: true },
  { key: 'number_of_questions', label: 'Number of questions', visibleByDefault: true },
  { key: 'time_per_question', label: 'Time per question', visibleByDefault: true },
  { key: 'instructions_time_limit_seconds', label: 'Instructions time limit', visibleByDefault: false },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'section_number', label: 'Section #' },
  { key: 'name', label: 'Name' },
  { key: 'display_columns', label: 'Display' },
  { key: 'time_limit_seconds', label: 'Time limit' },
  { key: 'number_of_questions', label: 'Number of questions' },
  { key: 'time_per_question', label: 'Time per question' },
  { key: 'instructions_time_limit_seconds', label: 'Instructions time limit' },
]

const emptyDraft: SectionDraft = {
  sectionNumber: '',
  name: '',
  displayColumns: '2',
  instructionsText: null,
  isTimed: true,
  timeLimitMinutes: '',
  timeLimitSeconds: '',
  numberOfQuestions: '',
  instructionsTimeLimitMinutes: '',
  instructionsTimeLimitSeconds: '',
}

export function UcatSectionsPage() {
  const access = useUcatAccess()
  const queryClient = useQueryClient()
  const sections = useUcatSections()
  const { toast } = useToast()
  const createSection = useCreateUcatSection()
  const updateSection = useUpdateUcatSection()
  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key))

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<SectionRow | null>(null)
  const [draft, setDraft] = useState<SectionDraft>(emptyDraft)

  const rows: SectionRow[] = (sections.data ?? []).map((row) => {
    const r = row as typeof row & {
      time_limit_seconds?: number | null
      number_of_questions?: number | null
      time_per_question?: number | null
      instructions_time_limit_seconds?: number | null
      instructions_text?: Json | null
    }
    return {
      id: r.id ?? '',
      section_number: r.section_number ?? 0,
      name: r.name ?? '',
      display_columns: r.display_columns ?? 2,
      instructions_text: r.instructions_text ?? null,
      time_limit_seconds: r.time_limit_seconds ?? null,
      number_of_questions: r.number_of_questions ?? null,
      time_per_question: r.time_per_question ?? null,
      instructions_time_limit_seconds: r.instructions_time_limit_seconds ?? null,
    }
  })

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()

    return rows.filter((row) => {
      const searchHit =
        search.length === 0 ||
        row.name.toLowerCase().includes(search) ||
        String(row.section_number).includes(search)
      const columnsHit = applySingleSelectFilter(tableState.state, 'display_columns', String(row.display_columns))
      const timeLimitHit = applyRangeFilter(
        tableState.state,
        'time_limit_seconds_min',
        'time_limit_seconds_max',
        row.time_limit_seconds
      )
      const numQuestionsHit = applyRangeFilter(
        tableState.state,
        'number_of_questions_min',
        'number_of_questions_max',
        row.number_of_questions
      )
      const timePerQHit = applyRangeFilter(
        tableState.state,
        'time_per_question_min',
        'time_per_question_max',
        row.time_per_question
      )
      return searchHit && columnsHit && timeLimitHit && numQuestionsHit && timePerQHit
    })
  }, [rows, tableState.state])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.state.sortBy, tableState.state.sortDirection, {
        section_number: (r) => r.section_number,
        name: (r) => r.name,
        display_columns: (r) => r.display_columns,
        time_limit_seconds: (r) => r.time_limit_seconds ?? -1,
        number_of_questions: (r) => r.number_of_questions ?? -1,
        time_per_question: (r) => r.time_per_question ?? -1,
        instructions_time_limit_seconds: (r) => r.instructions_time_limit_seconds ?? -1,
      }),
    [filteredRows, tableState.state.sortBy, tableState.state.sortDirection]
  )

  const allColumns: Array<{ key: string; column: ColumnDef<SectionRow> }> = [
    { key: 'section_number', column: { accessorKey: 'section_number', header: 'Section #' } },
    { key: 'name', column: { accessorKey: 'name', header: 'Name' } },
    {
      key: 'display_columns',
      column: {
        accessorKey: 'display_columns',
        header: 'Display',
        cell: ({ row }) => `${row.original.display_columns} column${row.original.display_columns > 1 ? 's' : ''}`,
      },
    },
    {
      key: 'time_limit_seconds',
      column: {
        accessorKey: 'time_limit_seconds',
        header: 'Time limit',
        cell: ({ row }) => formatSecondsToDuration(row.original.time_limit_seconds),
      },
    },
    {
      key: 'number_of_questions',
      column: {
        accessorKey: 'number_of_questions',
        header: 'Number of questions',
        cell: ({ row }) => row.original.number_of_questions ?? '-',
      },
    },
    {
      key: 'time_per_question',
      column: {
        accessorKey: 'time_per_question',
        header: 'Time per question',
        cell: ({ row }) =>
          row.original.time_per_question != null
            ? formatSecondsToDuration(Math.round(Number(row.original.time_per_question)))
            : '-',
      },
    },
    {
      key: 'instructions_time_limit_seconds',
      column: {
        accessorKey: 'instructions_time_limit_seconds',
        header: 'Instructions time limit',
        cell: ({ row }) => formatSecondsToDuration(row.original.instructions_time_limit_seconds),
      },
    },
    {
      key: 'actions',
      column: {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <UcatRowActions
              actions={[
                {
                  label: 'Edit',
                  icon: <Pencil className="h-4 w-4" />,
                  onClick: () => {
                    setEditing(row.original)
                    const sec = row.original.time_limit_seconds ?? 0
                    const instrSec = row.original.instructions_time_limit_seconds ?? 0
                    setDraft({
                      sectionNumber: String(row.original.section_number),
                      name: row.original.name,
                      displayColumns: String(row.original.display_columns) as '1' | '2',
                      instructionsText: row.original.instructions_text,
                      isTimed: sec > 0,
                      timeLimitMinutes: String(Math.floor(sec / 60)),
                      timeLimitSeconds: String(Math.floor(sec % 60)),
                      numberOfQuestions: row.original.number_of_questions != null ? String(row.original.number_of_questions) : '',
                      instructionsTimeLimitMinutes: String(Math.floor(instrSec / 60)),
                      instructionsTimeLimitSeconds: String(Math.floor(instrSec % 60)),
                    })
                  },
                },
              ]}
            />
          </div>
        ),
      },
    },
  ]

  const visibleColumns = useVisibleColumns(allColumns, tableState.state.visibleColumns)

  if (access.isLoading || sections.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  async function create() {
    const timeLimitSeconds = draft.isTimed
      ? minutesSecondsToTotal(draft.timeLimitMinutes, draft.timeLimitSeconds)
      : null
    const result = await createSection.mutateAsync({
      sectionNumber: Number(draft.sectionNumber),
      name: draft.name,
      displayColumns: Number(draft.displayColumns) as 1 | 2,
      instructionsText: draft.instructionsText,
      timeLimitSeconds,
      numberOfQuestions: draft.numberOfQuestions.trim() === '' ? null : Number(draft.numberOfQuestions),
      instructionsTimeLimitSeconds: minutesSecondsToTotal(draft.instructionsTimeLimitMinutes, draft.instructionsTimeLimitSeconds),
    })
    const sectionName = draft.name.trim() || 'Untitled'
    const instructionsTimeLimitSeconds = minutesSecondsToTotal(draft.instructionsTimeLimitMinutes, draft.instructionsTimeLimitSeconds)
    const numberOfQuestions = draft.numberOfQuestions.trim() === '' ? null : Number(draft.numberOfQuestions)
    const createdRow: SectionRow = {
      id: result.id,
      section_number: Number(draft.sectionNumber),
      name: draft.name,
      display_columns: Number(draft.displayColumns) as 1 | 2,
      instructions_text: draft.instructionsText,
      time_limit_seconds: timeLimitSeconds,
      number_of_questions: numberOfQuestions,
      time_per_question:
        timeLimitSeconds != null && numberOfQuestions != null && numberOfQuestions > 0
          ? timeLimitSeconds / numberOfQuestions
          : null,
      instructions_time_limit_seconds: instructionsTimeLimitSeconds,
    }
    setCreateOpen(false)
    setDraft(emptyDraft)
    toast({
      title: `Section ${sectionName} created`,
      description: (
        <button
          type="button"
          onClick={() => {
            setEditing(createdRow)
            setDraft({
              sectionNumber: String(createdRow.section_number),
              name: createdRow.name,
              displayColumns: String(createdRow.display_columns) as '1' | '2',
              instructionsText: createdRow.instructions_text,
              isTimed: (createdRow.time_limit_seconds ?? 0) > 0,
              timeLimitMinutes: String(Math.floor((createdRow.time_limit_seconds ?? 0) / 60)),
              timeLimitSeconds: String(Math.floor((createdRow.time_limit_seconds ?? 0) % 60)),
              numberOfQuestions: createdRow.number_of_questions != null ? String(createdRow.number_of_questions) : '',
              instructionsTimeLimitMinutes: String(Math.floor((createdRow.instructions_time_limit_seconds ?? 0) / 60)),
              instructionsTimeLimitSeconds: String(Math.floor((createdRow.instructions_time_limit_seconds ?? 0) % 60)),
            })
          }}
          className="underline font-medium hover:no-underline text-left"
        >
          View section
        </button>
      ),
    })
  }

  async function saveEdit() {
    if (!editing) return
    const timeLimitSeconds = draft.isTimed
      ? minutesSecondsToTotal(draft.timeLimitMinutes, draft.timeLimitSeconds)
      : null
    await updateSection.mutateAsync({
      id: editing.id,
      payload: {
        sectionNumber: Number(draft.sectionNumber),
        name: draft.name,
        displayColumns: Number(draft.displayColumns) as 1 | 2,
        instructionsText: draft.instructionsText,
        timeLimitSeconds,
        numberOfQuestions: draft.numberOfQuestions.trim() === '' ? null : Number(draft.numberOfQuestions),
        instructionsTimeLimitSeconds: minutesSecondsToTotal(draft.instructionsTimeLimitMinutes, draft.instructionsTimeLimitSeconds),
      },
    })
    await queryClient.refetchQueries({ queryKey: ucatKeys.sections() })
    setEditing(null)
    setDraft(emptyDraft)
  }

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="UCAT Sections"
        description="Create and manage UCAT sections"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Sections' }]}
        actions={<Button onClick={() => setCreateOpen(true)}>Add Section</Button>}
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
        filterDefinitions={filterDefinitions}
        columnDefinitions={columnDefinitions}
        sortOptions={sortOptions}
        searchPlaceholder="Search sections"
      />

      <div className="pt-3">
        <DataTable {...tutorDataTableProps} columns={visibleColumns} data={sortedRows} pageSizeOptions={[10, 20, 50]} />
      </div>

      <UcatDialogShell
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setDraft(emptyDraft)
        }}
        title="Create Section"
        subtitle="Add a new UCAT section"
        onSave={create}
        saveLabel="Create"
        saveDisabled={
          createSection.isPending ||
          (draft.isTimed &&
            ((t) => t == null || t <= 0)(minutesSecondsToTotal(draft.timeLimitMinutes, draft.timeLimitSeconds)))
        }
        isSaving={createSection.isPending}
      >
        <div className="p-6 overflow-y-auto h-full">
          <SectionForm draft={draft} setDraft={setDraft} />
        </div>
      </UcatDialogShell>

      <UcatDialogShell
        open={!!editing}
        onClose={() => {
          setEditing(null)
          setDraft(emptyDraft)
        }}
        title="Edit Section"
        subtitle="Update section metadata"
        onSave={saveEdit}
        saveDisabled={
          updateSection.isPending ||
          (draft.isTimed &&
            ((t) => t == null || t <= 0)(minutesSecondsToTotal(draft.timeLimitMinutes, draft.timeLimitSeconds)))
        }
        isSaving={updateSection.isPending}
      >
        <div className="p-6 overflow-y-auto h-full">
          <SectionForm draft={draft} setDraft={setDraft} />
        </div>
      </UcatDialogShell>
    </div>
  )
}

function SectionForm({
  draft,
  setDraft,
}: {
  draft: SectionDraft
  setDraft: React.Dispatch<React.SetStateAction<SectionDraft>>
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Section Number</span>
        <Input
          type="number"
          value={draft.sectionNumber}
          onChange={(e) => setDraft((prev) => ({ ...prev, sectionNumber: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Display Columns</span>
        <SearchableSelect<{ value: '1' | '2'; label: string }>
          items={[
            { value: '1', label: '1 Column' },
            { value: '2', label: '2 Columns' },
          ]}
          value={
            draft.displayColumns === '1'
              ? { value: '1', label: '1 Column' }
              : { value: '2', label: '2 Columns' }
          }
          onValueChange={(item) => item && setDraft((prev) => ({ ...prev, displayColumns: item.value }))}
          getItemLabel={(i) => i.label}
          getItemId={(i) => i.value}
        />
      </label>
      <label className="block text-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium">Time limit</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Untimed</span>
            <Switch
              checked={draft.isTimed}
              onCheckedChange={(v) =>
                setDraft((prev) => ({
                  ...prev,
                  isTimed: v,
                  ...(v ? {} : { timeLimitMinutes: '', timeLimitSeconds: '' }),
                }))
              }
            />
            <span className="text-xs text-muted-foreground">Timed</span>
          </div>
        </div>
        {draft.isTimed && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              placeholder="0"
              className="w-20"
              value={draft.timeLimitMinutes}
              onChange={(e) => setDraft((prev) => ({ ...prev, timeLimitMinutes: e.target.value }))}
            />
            <span className="text-muted-foreground font-medium">:</span>
            <Input
              type="number"
              min={0}
              max={59}
              placeholder="0"
              className="w-20"
              value={draft.timeLimitSeconds}
              onChange={(e) => setDraft((prev) => ({ ...prev, timeLimitSeconds: e.target.value }))}
            />
            <span className="text-muted-foreground text-xs">min : sec</span>
          </div>
        )}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Number of questions</span>
        <Input
          type="number"
          min={0}
          placeholder="Optional"
          value={draft.numberOfQuestions}
          onChange={(e) => setDraft((prev) => ({ ...prev, numberOfQuestions: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Instructions time limit (mm:ss)</span>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="0"
            className="w-20"
            value={draft.instructionsTimeLimitMinutes}
            onChange={(e) => setDraft((prev) => ({ ...prev, instructionsTimeLimitMinutes: e.target.value }))}
          />
          <span className="text-muted-foreground font-medium">:</span>
          <Input
            type="number"
            min={0}
            max={59}
            placeholder="0"
            className="w-20"
            value={draft.instructionsTimeLimitSeconds}
            onChange={(e) => setDraft((prev) => ({ ...prev, instructionsTimeLimitSeconds: e.target.value }))}
          />
          <span className="text-muted-foreground text-xs">min : sec</span>
        </div>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Section instructions</span>
        <p className="mb-1 text-muted-foreground text-xs">
          Shown to students at the start of a timed set. Leave empty to hide.
        </p>
        <div className="rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background">
          <UcatRichTextEditor
            value={draft.instructionsText}
            onChange={(value) => setDraft((prev) => ({ ...prev, instructionsText: value }))}
            placeholder="Optional instructions..."
            minHeight="120px"
          />
        </div>
      </label>
    </div>
  )
}
