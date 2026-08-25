'use client'

import { Fragment, useCallback, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui'
import { cn } from '@/shared/utils'
import type { Json } from '@altitutor/shared'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { BulkImportDecision } from '@/features/ucat/questions/hooks/useBulkImportDecisions'
import type { BulkImportDeterministicStemReview } from '@/features/ucat/questions/hooks/useBulkImportReviewController'
import type { BulkImportDuplicateFinding } from '@/features/ucat/questions/server/bulk-import-duplicate-analysis'
import { BulkImportRichTextPreview } from '@/features/ucat/questions/components/bulk-import/BulkImportRichTextPreview'
import { BulkImportReviewStemEditor } from '@/features/ucat/questions/components/bulk-import/BulkImportReviewStemEditor'
import { BulkImportDuplicatePreviewDialog } from '@/features/ucat/questions/components/bulk-import/BulkImportDuplicatePreviewDialog'
import type { CategoryOption, TagOption, UcatSectionOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'

type ReviewStem = BulkImportStemDraft & { aiGenerationMetadata?: Json | null }

type Row = {
  stem: ReviewStem
  stemIndex: number
  questionIndex: number
  questionId: string | null
  questionNumber: number
}

export function BulkImportReadinessReview({
  stems,
  readinessByStemId,
  decisions,
  sections,
  categories,
  tags,
  onDecisionChange,
  onSetAll,
  duplicateFindings,
  duplicateStatus,
  duplicateError,
  duplicateSimilarityThreshold,
  onDuplicateSimilarityThresholdChange,
  onRetryDuplicateAnalysis,
  onUpdateStem,
  onNewImageFileIds,
  onActiveTextEditorChange,
}: {
  stems: ReviewStem[]
  readinessByStemId: Record<string, BulkImportDeterministicStemReview>
  decisions: Record<string, BulkImportDecision>
  sections: UcatSectionOption[]
  categories: CategoryOption[]
  tags: TagOption[]
  onDecisionChange: (stemId: string, decision: BulkImportDecision) => void
  onSetAll: (decision: BulkImportDecision) => void
  duplicateFindings: BulkImportDuplicateFinding[]
  duplicateStatus: 'idle' | 'running'
  duplicateError: string | null
  duplicateSimilarityThreshold: number
  onDuplicateSimilarityThresholdChange: (threshold: number) => void
  onRetryDuplicateAnalysis: () => void
  onUpdateStem: (stemId: string, values: UcatQuestionStemFormValues) => void
  onNewImageFileIds?: (fileIds: string[]) => void
  onActiveTextEditorChange?: (editor: Editor | null) => void
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [previewFinding, setPreviewFinding] = useState<BulkImportDuplicateFinding | null>(null)
  const rows = useMemo(() => {
    let questionNumber = 0
    return stems.flatMap((stem, stemIndex) => stem.values.questions.map((question, questionIndex) => {
      questionNumber += 1
      return { stem, stemIndex, questionIndex, questionId: question.id ?? null, questionNumber } satisfies Row
    }))
  }, [stems])
  const duplicateFindingsByStemId = useMemo(() => {
    const byStemId = new Map<string, BulkImportDuplicateFinding[]>()
    for (const finding of duplicateFindings) {
      const current = byStemId.get(finding.draft.stemId) ?? []
      current.push(finding)
      byStemId.set(finding.draft.stemId, current)
    }
    return byStemId
  }, [duplicateFindings])

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKey((current) => current === key ? null : key)
    onActiveTextEditorChange?.(null)
  }, [onActiveTextEditorChange])

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No parsed questions to review.</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Review import destinations</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Eligible stems default to In review. Incomplete stems default to Draft; duplicate candidates default to Don&apos;t import but can be overridden.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Duplicate threshold
            <select
              aria-label="Duplicate similarity threshold"
              className="h-9 rounded-md border bg-background px-2 text-xs text-foreground"
              value={duplicateSimilarityThreshold}
              onChange={(event) => onDuplicateSimilarityThresholdChange(Number(event.target.value))}
            >
              <option value={1}>100%</option>
              <option value={0.95}>95%</option>
              <option value={0.9}>90%</option>
              <option value={0.85}>85%</option>
            </select>
          </label>
          <Button type="button" size="sm" variant="outline" onClick={() => onSetAll('in_review')}>Eligible to In review</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onSetAll('draft')}>All to Draft</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onSetAll('exclude')}>Don&apos;t import any</Button>
        </div>
      </div>

      {duplicateStatus === 'running' ? (
        <p className="text-xs text-muted-foreground">Checking for duplicates in the background…</p>
      ) : null}
      {duplicateError ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          <span>Duplicate check failed. You can still import, or retry the check.</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetryDuplicateAnalysis}>Retry</Button>
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table className="w-full table-fixed text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[3rem]">Stem</TableHead>
              <TableHead className="w-[3rem]">Q</TableHead>
              <TableHead>Stem text</TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="w-[30%]">Readiness</TableHead>
              <TableHead className="w-[10rem]">Import as</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const key = `${row.stem.id}:${row.questionIndex}`
              const expanded = expandedKey === key
              const review = readinessByStemId[row.stem.id]
              const issues = (review?.issues ?? []).filter((issue) => (
                issue.scope.type === 'stem'
                  ? row.questionIndex === 0
                  : issue.scope.questionIndex === row.questionIndex
              ))
              const eligible = review?.hasHardFailures !== true
              const decision = decisions[row.stem.id] ?? (eligible ? 'in_review' : 'draft')
              const firstQuestion = row.questionIndex === 0
              const duplicates = firstQuestion
                ? duplicateFindingsByStemId.get(row.stem.id) ?? []
                : []
              return (
                <Fragment key={key}>
                  <TableRow
                    className={cn('cursor-pointer', expanded && 'bg-muted/30', decision === 'exclude' && 'opacity-50')}
                    onClick={() => toggleExpanded(key)}
                  >
                    <TableCell className="font-mono text-muted-foreground">{row.stemIndex + 1}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{row.questionNumber}</TableCell>
                    <TableCell className="max-w-0 overflow-hidden">
                      <BulkImportRichTextPreview json={row.stem.values.stemText} singleLine />
                    </TableCell>
                    <TableCell className="max-w-0 overflow-hidden">
                      <BulkImportRichTextPreview json={row.stem.values.questions[row.questionIndex]?.questionText ?? null} singleLine />
                    </TableCell>
                    <TableCell className="align-top">
                      {issues.length === 0 ? (
                        firstQuestion ? <span className="text-emerald-700 dark:text-emerald-300">Ready for review</span> : <span className="text-muted-foreground">—</span>
                      ) : (
                        <ul className="space-y-1 text-amber-800 dark:text-amber-200">
                          {issues.map((issue, index) => <li key={`${issue.code}:${index}`}>{issue.message}</li>)}
                        </ul>
                      )}
                      {duplicates.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {duplicates.map((finding) => (
                            <button
                              key={finding.id}
                              type="button"
                              className="block text-left font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"
                              onClick={(event) => {
                                event.stopPropagation()
                                setPreviewFinding(finding)
                              }}
                            >
                              {Math.round(finding.similarity * 100)}% stem match — compare
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {firstQuestion ? (
                        <select
                          aria-label={`Import stem ${row.stemIndex + 1} as`}
                          className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                          value={decision}
                          onChange={(event) => onDecisionChange(row.stem.id, event.target.value as BulkImportDecision)}
                        >
                          <option value="in_review" disabled={!eligible}>In review{eligible ? '' : ' (not ready)'}</option>
                          <option value="draft">Draft</option>
                          <option value="exclude">Don&apos;t import</option>
                        </select>
                      ) : <span className="text-muted-foreground">Same stem</span>}
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={6} className="p-0">
                        <div className="h-[min(75vh,900px)] min-h-[32rem] overflow-hidden border-t" onClick={(event) => event.stopPropagation()}>
                          <BulkImportReviewStemEditor
                            stemId={row.stem.id}
                            values={row.stem.values}
                            initialQuestionIndex={row.questionIndex}
                            sections={sections}
                            categories={categories}
                            tags={tags}
                            onUpdateStem={onUpdateStem}
                            onNewImageFileIds={onNewImageFileIds}
                            onActiveTextEditorChange={onActiveTextEditorChange}
                            sourceChannel="bulk_import"
                            aiGenerationMetadata={row.stem.aiGenerationMetadata ?? null}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <BulkImportDuplicatePreviewDialog
        finding={previewFinding}
        onOpenChange={(open) => {
          if (!open) setPreviewFinding(null)
        }}
      />
    </div>
  )
}
