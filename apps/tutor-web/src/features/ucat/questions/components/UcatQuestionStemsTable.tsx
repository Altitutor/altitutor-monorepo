'use client'

import React from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  getUcatVisibilityColor,
} from '@altitutor/ui'
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import type { QuestionRow } from '@/features/ucat/questions/hooks/useUcatQuestionsTable'
import type { UcatRowAction } from '@/features/ucat/shared/row-actions'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatVisibilityBadge } from '@/features/ucat/shared/components/UcatVisibilityBadge'
import { UcatVisibilityTableHeaderLabel } from '@/features/ucat/shared/components/UcatVisibilityInfoTooltip'
import { stemSourceTooltip } from '@/features/ucat/questions/lib/source-display'
import {
  auditMembershipChipClassName,
  auditMembershipChipLabel,
} from '@/features/ucat/questions/lib/audit-catalog'
import { UCAT_AI_REVIEW_STATUS_COPY } from '@/features/ucat/questions/lib/ai-assessment/review-status'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { formatSecondsToDuration } from '@/features/ucat/shared/lib/time-utils'
import { resolveCategoryPathLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import { cn, formatDateTime } from '@/shared/utils'
import { tutorBtnIconOutline, tutorTableBodyRow, tutorTableHeaderRow, tutorTableShell } from '@/shared/lib/tutor-visual'

function truncateCatalogText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}…`
}

export function UcatQuestionStemsTable({
  rows,
  visibleColumns,
  visibleQuestionColumns,
  visibleAnswerOptionColumns,
  categoryPathLookup,
  expandedStemIds,
  expandedQuestionKeys,
  detailsMap,
  getRowActions,
  onToggleStemExpanded,
  onToggleQuestionExpanded,
  onEditSet,
  reorderEnabled = false,
  onReorder,
}: {
  rows: QuestionRow[]
  visibleColumns: string[]
  visibleQuestionColumns: string[]
  visibleAnswerOptionColumns: string[]
  categoryPathLookup: Map<string, string>
  expandedStemIds: Set<string>
  expandedQuestionKeys: Set<string>
  detailsMap: Record<string, StemDetailRow | null>
  getRowActions: (row: QuestionRow) => UcatRowAction[]
  onToggleStemExpanded: (stemId: string) => void
  onToggleQuestionExpanded: (stemId: string, questionId: string) => void
  onEditSet?: (setId: string) => void
  reorderEnabled?: boolean
  onReorder?: (ids: string[]) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const visible = (key: string) => visibleColumns.includes(key)
  const rowIds = rows.map((row) => row.id)
  const colCount =
    2 +
    (visible('section_category') ? 1 : 0) +
    (visible('stem_text') ? 1 : 0) +
    (visible('question_count') ? 1 : 0) +
    (visible('sets') ? 1 : 0) +
    (visible('visibility') ? 1 : 0) +
    (visible('source') ? 1 : 0) +
    (visible('created_at') ? 1 : 0) +
    (visible('status') ? 1 : 0) +
    (visible('review') ? 1 : 0) +
    (visible('type_summary') ? 1 : 0) +
    (visible('actions') ? 1 : 0)

  const table = (
    <div className={tutorTableShell}>
      <Table className="w-[1100px] table-fixed md:w-full">
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className={tutorTableHeaderRow}>
            <TableHead className="w-12" />
            <TableHead className="w-12" />
            {visible('section_category') && <TableHead>Section</TableHead>}
            {visible('stem_text') && <TableHead>Stem text</TableHead>}
            {visible('question_count') && <TableHead>Questions</TableHead>}
            {visible('sets') && <TableHead>Sets</TableHead>}
            {visible('visibility') && (
              <TableHead>
                <UcatVisibilityTableHeaderLabel />
              </TableHead>
            )}
            {visible('source') && <TableHead>Source</TableHead>}
            {visible('created_at') && <TableHead>Date created</TableHead>}
            {visible('status') && <TableHead>Status</TableHead>}
            {visible('review') && <TableHead>Review</TableHead>}
            {visible('type_summary') && <TableHead>Type</TableHead>}
            {visible('actions') && <TableHead className="w-16 shrink-0" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <MembershipStemRows
              key={row.id}
              row={row}
              visible={visible}
              visibleQuestionColumns={visibleQuestionColumns}
              visibleAnswerOptionColumns={visibleAnswerOptionColumns}
              categoryPathLookup={categoryPathLookup}
              isStemExpanded={expandedStemIds.has(row.id)}
              expandedQuestionKeys={expandedQuestionKeys}
              detail={detailsMap[row.id] ?? null}
              colCount={colCount}
              getRowActions={getRowActions}
              onToggleStemExpanded={onToggleStemExpanded}
              onToggleQuestionExpanded={onToggleQuestionExpanded}
              onEditSet={onEditSet}
              reorderEnabled={reorderEnabled}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => {
        if (!reorderEnabled || !onReorder) return
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = rowIds.indexOf(String(active.id))
        const newIndex = rowIds.indexOf(String(over.id))
        if (oldIndex < 0 || newIndex < 0) return
        onReorder(arrayMove(rowIds, oldIndex, newIndex))
      }}
    >
      <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
        {table}
      </SortableContext>
    </DndContext>
  )
}

function MembershipStemRows({
  row,
  visible,
  visibleQuestionColumns,
  visibleAnswerOptionColumns,
  categoryPathLookup,
  isStemExpanded,
  expandedQuestionKeys,
  detail,
  colCount,
  getRowActions,
  onToggleStemExpanded,
  onToggleQuestionExpanded,
  onEditSet,
  reorderEnabled,
}: {
  row: QuestionRow
  visible: (key: string) => boolean
  visibleQuestionColumns: string[]
  visibleAnswerOptionColumns: string[]
  categoryPathLookup: Map<string, string>
  isStemExpanded: boolean
  expandedQuestionKeys: Set<string>
  detail: StemDetailRow | null
  colCount: number
  getRowActions: (row: QuestionRow) => UcatRowAction[]
  onToggleStemExpanded: (stemId: string) => void
  onToggleQuestionExpanded: (stemId: string, questionId: string) => void
  onEditSet?: (setId: string) => void
  reorderEnabled: boolean
}) {
  const sortable = useSortable({ id: row.id, disabled: !reorderEnabled })
  const hasQuestions = (row.question_count ?? 0) > 0
  const categoryLabel = resolveCategoryPathLabel(
    categoryPathLookup,
    row.question_stem_category_id,
    row.category_name,
  )
  const visibleQuestion = (key: string) => visibleQuestionColumns.includes(key)
  const visibleAnswerOption = (key: string) => visibleAnswerOptionColumns.includes(key)
  const questionColCount =
    1 +
    (visibleQuestion('index') ? 1 : 0) +
    (visibleQuestion('question_text') ? 1 : 0) +
    (visibleQuestion('explanation') ? 1 : 0) +
    (visibleQuestion('difficulty') ? 1 : 0) +
    (visibleQuestion('time_burden') ? 1 : 0)

  return (
    <>
      <TableRow
        ref={sortable.setNodeRef}
        style={{
          transform: CSS.Transform.toString(sortable.transform),
          transition: sortable.transition,
        }}
        className={cn(
          tutorTableBodyRow,
          hasQuestions && 'cursor-pointer',
          sortable.isDragging && 'opacity-70',
        )}
        onClick={() => {
          if (hasQuestions) onToggleStemExpanded(row.id)
        }}
      >
        <TableCell className="w-12" onClick={(event) => event.stopPropagation()}>
          {reorderEnabled ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(tutorBtnIconOutline, 'cursor-grab active:cursor-grabbing')}
              aria-label="Reorder stem"
              {...sortable.attributes}
              {...sortable.listeners}
            >
              <GripVertical className="h-4 w-4" />
            </Button>
          ) : null}
        </TableCell>
        <TableCell className="w-12" onClick={(event) => event.stopPropagation()}>
          {hasQuestions ? (
            <span className="inline-flex rounded-lg p-1">
              {isStemExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          ) : null}
        </TableCell>
        {visible('section_category') && (
          <TableCell className="max-w-[180px]">
            <div className="space-y-0.5">
              <div className="text-sm">{row.section_name}</div>
              <div className="truncate text-xs text-muted-foreground" title={categoryLabel}>
                {categoryLabel || '—'}
              </div>
            </div>
          </TableCell>
        )}
        {visible('stem_text') && (
          <TableCell className="max-w-[200px]" title={row.stem_text}>
            {truncateCatalogText(row.stem_text, 80)}
          </TableCell>
        )}
        {visible('question_count') && <TableCell>{row.question_count}</TableCell>}
        {visible('sets') && (
          <TableCell className="max-w-[180px]">
            {row.sets.length === 0 ? (
              <Badge
                variant="outline"
                className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(false))}
              >
                {row.is_available_in_question_pool ? 'Practice pool' : 'Not in practice pool'}
              </Badge>
            ) : (
              <div className="space-y-1">
                <div className="space-y-0.5">
                  {row.sets.map((set) =>
                    onEditSet ? (
                      <button
                        key={set.id}
                        type="button"
                        className="block max-w-full truncate text-left text-sm text-brand-darkBlue underline-offset-2 hover:underline dark:text-white"
                        title={set.name}
                        onClick={(event) => {
                          event.stopPropagation()
                          onEditSet(set.id)
                        }}
                      >
                        {set.name}
                      </button>
                    ) : (
                      <div key={set.id} className="truncate text-sm" title={set.name}>
                        {set.name}
                      </div>
                    ),
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(false))}
                >
                  {row.is_available_in_question_pool ? 'Practice pool' : 'Not in practice pool'}
                </Badge>
              </div>
            )}
          </TableCell>
        )}
        {visible('visibility') && (
          <TableCell>
            <UcatVisibilityBadge isPrivate={row.access_scope === 'private'} />
          </TableCell>
        )}
        {visible('source') && (
          <TableCell className="max-w-[200px]" title={stemSourceTooltip(row.source)}>
            <div className="space-y-0.5">
              <div className="text-sm">{row.source.channelLabel}</div>
              {row.source.generatedByName ? (
                <div className="truncate text-xs text-muted-foreground">{row.source.generatedByName}</div>
              ) : null}
              {row.source.sourceChannel === 'ai_generation' ? (
                <div className="truncate text-xs text-muted-foreground">
                  {[row.source.aiModel ?? 'Unknown model', row.source.generatedAtLabel ?? 'Unknown date']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              ) : null}
              {row.source.tutorSourceNote ? (
                <div className="truncate text-xs text-muted-foreground">{row.source.tutorSourceNote}</div>
              ) : null}
            </div>
          </TableCell>
        )}
        {visible('created_at') && <TableCell>{formatDateTime(row.created_at ?? '') || '—'}</TableCell>}
        {visible('status') && <TableCell className="capitalize">{row.status}</TableCell>}
        {visible('review') && (
          <TableCell>
            <div className="flex flex-col items-start gap-1">
              {row.ai_review_status ? (
                <Badge
                  variant="outline"
                  className={cn('whitespace-nowrap font-normal', UCAT_AI_REVIEW_STATUS_COPY[row.ai_review_status].className)}
                >
                  {UCAT_AI_REVIEW_STATUS_COPY[row.ai_review_status].shortLabel}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
              {row.audit_memberships.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {row.audit_memberships.map((membership) => (
                    <Badge
                      key={`${membership.runId}:${membership.targetStatus}:${membership.result ?? ''}`}
                      variant="outline"
                      title={membership.why ?? undefined}
                      className={cn('whitespace-nowrap font-normal', auditMembershipChipClassName(membership))}
                    >
                      {auditMembershipChipLabel(membership)}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </TableCell>
        )}
        {visible('type_summary') && <TableCell>{row.type_summary}</TableCell>}
        {visible('actions') && (
          <TableCell className="w-16 shrink-0" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-end">
              <UcatRowActions actions={getRowActions(row)} />
            </div>
          </TableCell>
        )}
      </TableRow>
      {isStemExpanded && detail?.questions ? (
        <TableRow>
          <TableCell colSpan={colCount} className="w-full bg-muted/30 p-0 align-top">
            <div className="w-full min-w-0 p-3">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 shrink-0" />
                    {visibleQuestion('index') && <TableHead className="w-16 shrink-0">Index</TableHead>}
                    {visibleQuestion('question_text') && <TableHead className="min-w-0">Question text</TableHead>}
                    {visibleQuestion('explanation') && <TableHead className="min-w-0">Explanation</TableHead>}
                    {visibleQuestion('difficulty') && <TableHead className="w-24 shrink-0">Difficulty</TableHead>}
                    {visibleQuestion('time_burden') && (
                      <TableHead className="w-32 shrink-0">Expected time to correct</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...detail.questions]
                    .sort((left, right) => left.index - right.index)
                    .map((question) => {
                      const questionKey = `${row.id}-${question.id}`
                      const isQuestionExpanded = expandedQuestionKeys.has(questionKey)
                      const questionText = proseMirrorToPlainText(question.question_text)
                      const explanation = proseMirrorToPlainText(question.answer_explanation)
                      const hasOptions = (question.answer_options?.length ?? 0) > 0
                      return (
                        <React.Fragment key={question.id}>
                          <TableRow
                            className={cn(hasOptions && 'cursor-pointer')}
                            onClick={() => {
                              if (hasOptions) onToggleQuestionExpanded(row.id, question.id)
                            }}
                          >
                            <TableCell className="w-12">
                              {hasOptions ? (
                                <span className="inline-flex rounded-lg p-1">
                                  {isQuestionExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </span>
                              ) : null}
                            </TableCell>
                            {visibleQuestion('index') && <TableCell>{question.index}</TableCell>}
                            {visibleQuestion('question_text') && (
                              <TableCell className="max-w-[240px]" title={questionText}>
                                {truncateCatalogText(questionText, 60)}
                              </TableCell>
                            )}
                            {visibleQuestion('explanation') && (
                              <TableCell className="max-w-[240px]" title={explanation}>
                                {explanation ? truncateCatalogText(explanation, 60) : '—'}
                              </TableCell>
                            )}
                            {visibleQuestion('difficulty') && <TableCell>{question.difficulty ?? '-'}</TableCell>}
                            {visibleQuestion('time_burden') && (
                              <TableCell>{formatSecondsToDuration(question.time_burden_seconds)}</TableCell>
                            )}
                          </TableRow>
                          {isQuestionExpanded && question.answer_options && question.answer_options.length > 0 ? (
                            <TableRow>
                              <TableCell colSpan={questionColCount} className="w-full bg-muted/20 p-0 align-top">
                                <div className="w-full min-w-0 p-2 pl-14">
                                  <Table className="w-full table-fixed">
                                    <TableHeader>
                                      <TableRow>
                                        {visibleAnswerOption('index') && (
                                          <TableHead className="w-16 shrink-0">Index</TableHead>
                                        )}
                                        {visibleAnswerOption('answer_text') && (
                                          <TableHead className="min-w-0">Answer text</TableHead>
                                        )}
                                        {visibleAnswerOption('answer_explanation') && (
                                          <TableHead className="min-w-0">Answer explanation</TableHead>
                                        )}
                                        {visibleAnswerOption('answer_key_value') && (
                                          <TableHead className="w-28 shrink-0">Answer key</TableHead>
                                        )}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {[...question.answer_options]
                                        .sort((left, right) => left.index - right.index)
                                        .map((option) => (
                                          <TableRow key={option.id}>
                                            {visibleAnswerOption('index') && <TableCell>{option.index}</TableCell>}
                                            {visibleAnswerOption('answer_text') && (
                                              <TableCell
                                                className="max-w-[200px]"
                                                title={proseMirrorToPlainText(option.answer_text)}
                                              >
                                                {truncateCatalogText(proseMirrorToPlainText(option.answer_text), 50)}
                                              </TableCell>
                                            )}
                                            {visibleAnswerOption('answer_explanation') && (
                                              <TableCell
                                                className="max-w-[200px]"
                                                title={proseMirrorToPlainText(option.answer_explanation)}
                                              >
                                                {truncateCatalogText(
                                                  proseMirrorToPlainText(option.answer_explanation),
                                                  50,
                                                )}
                                              </TableCell>
                                            )}
                                            {visibleAnswerOption('answer_key_value') && (
                                              <TableCell>{option.answer_key_value ?? 'Not keyed'}</TableCell>
                                            )}
                                          </TableRow>
                                        ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </React.Fragment>
                      )
                    })}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}
