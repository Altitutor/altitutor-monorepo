'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import {
  UcatPageHeader,
  UcatPageSkeleton,
  UcatAccessDenied,
} from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatQuestionStemDialog } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { UcatMockEditorDialog } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { mapCategoriesToOptions, mapTagsToOptions } from '@/features/ucat/shared/lib/taxonomy-paths'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatSections,
  useUcatTags,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { filterOptionsWithContent } from '@/features/ucat/shared/lib/rich-text'
import { parseTimeToSeconds } from '@/features/ucat/shared/lib/time-utils'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { UcatReconciliationProvider } from '@/features/ucat/reconciliation/components/UcatReconciliationContext'
import { useReconciliationTabCounts } from '@/features/ucat/reconciliation/hooks/useReconciliationTabCounts'
import { cn } from '@/shared/utils'

const NAV = [
  { segment: 'questions', href: '/ucat/reconciliation/questions', label: 'Questions' },
  { segment: 'sets', href: '/ucat/reconciliation/sets', label: 'Sets' },
  { segment: 'mocks', href: '/ucat/reconciliation/mocks', label: 'Mocks' },
] as const

function toExplanationNull(value: unknown): import('@altitutor/shared').Json | null {
  if (value == null) return null
  if (typeof value === 'string' && value === 'null') return null
  return value as import('@altitutor/shared').Json
}

function mapFormValuesToBundlePayload(
  payload: UcatQuestionStemFormValues,
  stemId: string,
): UcatQuestionStemBundlePayload {
  return {
    stemId,
    sectionId: payload.sectionId,
    categoryId: payload.categoryId || null,
    stemText: payload.stemText,
    isPrivate: payload.isPrivate,
    questions: payload.questions.map((question, index) => ({
      index: index + 1,
      questionText: question.questionText,
      questionType: question.questionType,
      answerExplanation: toExplanationNull(question.answerExplanation),
      difficulty: question.difficulty,
      timeBurdenSeconds: parseTimeToSeconds(question.timeBurdenSeconds ?? '') ?? null,
      tagIds: question.tagIds ?? [],
      options: filterOptionsWithContent(question.options).map((option, optionIndex) => ({
        index: optionIndex + 1,
        answerText: option.answerText,
        answerExplanation: toExplanationNull(option.answerExplanation),
        isAnswer: option.isAnswer,
      })),
    })),
  }
}

function tabCountForSegment(
  segment: (typeof NAV)[number]['segment'],
  counts: { questions: number; sets: number; mocks: number } | undefined,
): number | undefined {
  if (!counts) return undefined
  if (segment === 'questions') return counts.questions
  if (segment === 'sets') return counts.sets
  return counts.mocks
}

export function UcatReconciliationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const access = useUcatAccess()
  const queryClient = useQueryClient()
  const tabCounts = useReconciliationTabCounts()

  const [editingStemId, setEditingStemId] = useState<string | null>(null)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editingMockId, setEditingMockId] = useState<string | null>(null)

  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const stemDetail = useUcatQuestionDetail(editingStemId)
  const updateStemMutation = useUpdateUcatQuestionStem()

  const handlers = useMemo(
    () => ({
      onOpenStemDialog: (stemId: string) => setEditingStemId(stemId),
      onEditSet: (setId: string) => setEditingSetId(setId),
      onEditMock: (mockId: string) => setEditingMockId(mockId),
    }),
    [],
  )

  const handleSetEditorClose = useCallback(() => {
    setEditingSetId(null)
    queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
  }, [queryClient])

  const handleMockEditorClose = useCallback(() => {
    setEditingMockId(null)
    queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
  }, [queryClient])

  const handleStemUpdate = useCallback(
    async (payload: UcatQuestionStemFormValues) => {
      if (!editingStemId) return
      const mapped = mapFormValuesToBundlePayload(payload, editingStemId)
      await updateStemMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
      setEditingStemId(null)
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
    },
    [editingStemId, updateStemMutation, queryClient],
  )

  if (access.isLoading) return <UcatPageSkeleton />
  if (!access.data) return <UcatAccessDenied />

  const counts = tabCounts.counts
  const activeSegment = NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )?.segment

  const formatBadge = (segment: (typeof NAV)[number]['segment']): string => {
    if (tabCounts.isLoading) return '…'
    if (tabCounts.isError) return '—'
    const count = tabCountForSegment(segment, counts)
    return count === undefined ? '—' : String(count)
  }

  const activeTabTotal = activeSegment ? tabCountForSegment(activeSegment, counts) : undefined

  return (
    <UcatReconciliationProvider value={handlers}>
      <div className="space-y-8 py-8 md:py-10">
        <UcatPageHeader
          title="Reconciliation"
          description="Identify and resolve UCAT content gaps across questions, sets, and mocks."
          backHref="/ucat"
          breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Reconciliation' }]}
        />

        {tabCounts.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Could not load tab counts. Navigation totals may be incomplete.</span>
          </div>
        )}

        <nav
          className="grid w-full max-w-3xl grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
          aria-label="Reconciliation sections"
        >
          {NAV.map(({ segment, href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            const badge = formatBadge(segment)
            return (
              <Link
                key={segment}
                href={href}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:bg-background/60 hover:text-foreground',
                )}
              >
                <span>{label}</span>
                <span
                  className={cn(
                    'rounded-md bg-muted-foreground/15 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground',
                    active && 'bg-primary/10 text-primary',
                  )}
                >
                  {badge}
                </span>
              </Link>
            )
          })}
        </nav>

        {children}

        {tabCounts.isSuccess && activeTabTotal === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-lg">No reconciliation items found</p>
            <p className="mt-2 text-sm">All data is consistent for this section.</p>
          </div>
        )}

        <UcatQuestionStemDialog
          open={!!editingStemId}
          title="Edit Question Stem"
          submitLabel="Save"
          onClose={() => setEditingStemId(null)}
          onSubmit={handleStemUpdate}
          sections={(sectionsQuery.data ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            display_columns: s.display_columns,
          }))}
          categories={mapCategoriesToOptions(categoriesQuery.data ?? []) as CategoryOption[]}
          tags={mapTagsToOptions(tagsQuery.data ?? []) as TagOption[]}
          initial={stemDetail.data}
          loading={updateStemMutation.isPending || stemDetail.isLoading}
        />

        <UcatSetEditorDialog open={!!editingSetId} setId={editingSetId} onClose={handleSetEditorClose} />

        <UcatMockEditorDialog open={!!editingMockId} mockId={editingMockId} onClose={handleMockEditorClose} />
      </div>
    </UcatReconciliationProvider>
  )
}
