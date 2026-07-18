'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Button } from '@altitutor/ui'
import { ChevronRight } from 'lucide-react'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatQuestionDetail } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatQuestionEnginePreview } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'
import { UcatTutorStemPreviewExamChrome } from '@/features/ucat/question-engine-preview/UcatTutorStemPreviewExamChrome'
import {
  resolveSectionDisplayColumns,
  stemFormValuesToEnginePreviewQuestion,
} from '@/features/ucat/question-engine-preview/mapStemFormToEnginePreview'
import { stemDetailToFormValues } from '@/features/ucat/questions/lib/stem-editor-form'
import { UcatStemEditorLoadingSkeleton } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorLoadingSkeleton'
import { cn } from '@/shared/utils'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import { SegmentedControl } from '@/shared/components/segmented-control'
import { ucatQuestionsApi, type StemDetailRow } from '@/features/ucat/questions/api/questions'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

type PreviewPosition = {
  stemId: string
  stemIndex: number
  questionIndex: number
}

export type UcatPreviewNavigatorGroup = {
  id: string
  label: string
  stemIds: string[]
}

type DistributionRow = {
  label: string
  count: number
}

function sortDistribution(rows: DistributionRow[]): DistributionRow[] {
  return rows.sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

export function UcatSetPreviewContent({
  stemIds,
  stemCatalog,
  showAnswer,
  isLoading = false,
  emptyMessage = 'Add a question stem to preview this set.',
  navigatorGroups,
  showDistribution = false,
}: {
  stemIds: string[]
  stemCatalog: UcatStemCatalogItem[]
  showAnswer: boolean
  isLoading?: boolean
  emptyMessage?: string
  navigatorGroups?: UcatPreviewNavigatorGroup[]
  showDistribution?: boolean
}) {
  const positions = useMemo<PreviewPosition[]>(
    () => stemIds.flatMap((stemId, stemIndex) => {
      const questionCount = stemCatalog.find((stem) => stem.id === stemId)?.questionsCount ?? 0
      return Array.from({ length: questionCount }, (_, questionIndex) => ({
        stemId,
        stemIndex,
        questionIndex,
      }))
    }),
    [stemCatalog, stemIds],
  )
  const [positionIndex, setPositionIndex] = useState(0)
  const [mobilePane, setMobilePane] = useState<'preview' | 'navigator'>('preview')
  const [sidebarView, setSidebarView] = useState<'navigator' | 'distribution'>('navigator')
  const safePositionIndex = positions.length > 0 ? Math.min(positionIndex, positions.length - 1) : 0
  const position = positions[safePositionIndex] ?? null
  const detailQuery = useUcatQuestionDetail(position?.stemId ?? null)
  const distributionQueries = useQueries({
    queries: showDistribution
      ? stemIds.map((stemId) => ({
          queryKey: ucatKeys.question(stemId),
          queryFn: () => ucatQuestionsApi.getDetail(stemId),
        }))
      : [],
  })
  const distributionLoading = distributionQueries.some((query) => query.isLoading)
  const activeNavigatorGroup = navigatorGroups?.find((group) =>
    position ? group.stemIds.includes(position.stemId) : false,
  ) ?? navigatorGroups?.[0]
  const navigatorStemIds = activeNavigatorGroup?.stemIds ?? stemIds

  function handleNavigatorGroupChange(groupId: string) {
    const group = navigatorGroups?.find((candidate) => candidate.id === groupId)
    if (!group) return
    const firstPositionIndex = positions.findIndex((candidate) => group.stemIds.includes(candidate.stemId))
    if (firstPositionIndex >= 0) setPositionIndex(firstPositionIndex)
  }

  useEffect(() => {
    setPositionIndex((current) => Math.min(current, Math.max(positions.length - 1, 0)))
  }, [positions.length])

  const preview = useMemo(() => {
    const detail = detailQuery.data
    if (!detail || !position) return null
    const values = stemDetailToFormValues(detail, detail.section_id ?? '')
    const displayColumns = resolveSectionDisplayColumns(detail.display_columns, detail)
    return stemFormValuesToEnginePreviewQuestion(values, position.questionIndex, displayColumns)
  }, [detailQuery.data, position])
  const distributions = useMemo(() => {
    const categoryCounts = new Map<string, number>()
    const tagCounts = new Map<string, number>()

    for (const query of distributionQueries) {
      const detail = query.data as StemDetailRow | undefined
      if (!detail) continue
      const categoryLabel = detail.category_name?.trim() || 'Uncategorised'
      categoryCounts.set(categoryLabel, (categoryCounts.get(categoryLabel) ?? 0) + detail.questions.length)
      for (const question of detail.questions) {
        if (!question.tags || question.tags.length === 0) {
          tagCounts.set('Untagged', (tagCounts.get('Untagged') ?? 0) + 1)
          continue
        }
        for (const tag of question.tags) {
          const tagLabel = tag.name.trim() || 'Unnamed tag'
          tagCounts.set(tagLabel, (tagCounts.get(tagLabel) ?? 0) + 1)
        }
      }
    }

    return {
      categories: sortDistribution(Array.from(categoryCounts, ([label, count]) => ({ label, count }))),
      tags: sortDistribution(Array.from(tagCounts, ([label, count]) => ({ label, count }))),
    }
  }, [distributionQueries])

  if (isLoading) return <UcatStemEditorLoadingSkeleton />

  if (positions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background p-2 lg:hidden">
        <SegmentedControl
          fullWidth
          value={mobilePane}
          onValueChange={setMobilePane}
          options={[
            { value: 'preview', label: 'Preview' },
            { value: 'navigator', label: 'Navigator' },
          ]}
        />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <section className={cn(
        'min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex',
        mobilePane === 'navigator' && 'hidden',
        mobilePane === 'preview' && 'flex',
      )}>
        {detailQuery.isLoading || !preview ? (
          <UcatStemEditorLoadingSkeleton />
        ) : (
          <UcatTutorStemPreviewExamChrome
            sectionTitle={detailQuery.data?.section_name?.trim() || 'UCAT'}
            questionCount={positions.length}
            currentQuestionIndex={safePositionIndex}
            onQuestionIndexChange={setPositionIndex}
            showNavigator={false}
          >
            <UcatQuestionEnginePreview
              question={preview}
              showAnswerExplanations={showAnswer}
              interactive={false}
            />
          </UcatTutorStemPreviewExamChrome>
        )}
      </section>

      <aside className={cn(
        'h-full min-h-0 w-full shrink-0 flex-col overflow-hidden bg-background p-3 sm:p-4 lg:flex lg:w-80 lg:border-l',
        mobilePane === 'preview' && 'hidden',
        mobilePane === 'navigator' && 'flex',
      )}>
        {showDistribution ? (
          <div className="mb-3 shrink-0">
            <SegmentedControl
              fullWidth
              value={sidebarView}
              onValueChange={setSidebarView}
              options={[
                { value: 'navigator', label: 'Navigator' },
                { value: 'distribution', label: 'Question distribution' },
              ]}
            />
          </div>
        ) : null}
        {sidebarView === 'navigator' && navigatorGroups && navigatorGroups.length > 0 ? (
          <div className="mb-3 shrink-0 overflow-x-auto">
            <SegmentedControl
              fullWidth
              value={activeNavigatorGroup?.id ?? navigatorGroups[0]?.id ?? ''}
              onValueChange={handleNavigatorGroupChange}
              options={navigatorGroups.map((group) => ({
                value: group.id,
                label: group.label,
              }))}
            />
          </div>
        ) : null}
        {sidebarView === 'navigator' ? <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
          {navigatorStemIds.map((stemId) => {
            const stemIndex = stemIds.indexOf(stemId)
            const stem = stemCatalog.find((item) => item.id === stemId)
            const stemPositions = positions.filter((item) => item.stemId === stemId)
            return (
              <div key={stemId} className={tutorCardCn('overflow-hidden p-0')}>
                <div className="border-b px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground">Stem {stemIndex + 1}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm">{stem?.text || 'Untitled question stem'}</p>
                </div>
                <div className="p-1.5">
                  {stemPositions.map((item) => {
                    const itemIndex = positions.findIndex(
                      (candidate) => candidate.stemId === item.stemId && candidate.questionIndex === item.questionIndex,
                    )
                    const active = itemIndex === safePositionIndex
                    return (
                      <Button
                        key={`${stemId}:${item.questionIndex}`}
                        type="button"
                        variant="ghost"
                        className={cn('h-8 w-full justify-between px-2 text-sm', active && 'bg-muted font-medium')}
                        onClick={() => setPositionIndex(itemIndex)}
                      >
                        Question {item.questionIndex + 1}
                        {active ? <ChevronRight className="h-4 w-4" /> : null}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div> : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
            {distributionLoading ? (
              <div className="space-y-3" aria-label="Loading question distribution">
                <div className="h-32 animate-pulse rounded-xl bg-muted" />
                <div className="h-32 animate-pulse rounded-xl bg-muted" />
              </div>
            ) : (
              <>
                <DistributionCard title="Category distribution" rows={distributions.categories} />
                <DistributionCard title="Tag distribution" rows={distributions.tags} />
              </>
            )}
          </div>
        )}
      </aside>
      </div>
    </div>
  )
}

function DistributionCard({ title, rows }: { title: string; rows: DistributionRow[] }) {
  return (
    <section className={tutorCardCn('overflow-hidden p-0')}>
      <h3 className="border-b px-3 py-2 text-sm font-semibold">{title}</h3>
      {rows.length > 0 ? (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate" title={row.label}>{row.label}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-4 text-sm text-muted-foreground">No data available.</p>
      )}
    </section>
  )
}
