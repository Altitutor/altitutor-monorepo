'use client'

import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui'
import { Info } from 'lucide-react'
import { cn } from '@/shared/utils'
import type { AnswerPasteStats, QuestionPasteStats } from './bulkImportPasteStats'

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  )
}

function YesDash({ ok }: { ok: boolean }) {
  return (
    <span className={cn('tabular-nums', ok ? 'text-foreground' : 'text-muted-foreground')}>
      {ok ? 'Yes' : '—'}
    </span>
  )
}

type QuestionsPanelProps = {
  variant: 'questions'
  stats: QuestionPasteStats
  sectionKnown: boolean
}

type AnswersPanelProps = {
  variant: 'answers'
  stats: AnswerPasteStats
  includeExplanationsOnImport: boolean
}

function QuestionsTooltipBody({ stats, sectionKnown }: Omit<QuestionsPanelProps, 'variant'>) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold text-foreground">Totals (parsed structure)</p>
        {!sectionKnown ? (
          <p className="mt-1 text-muted-foreground">
            Choose a supported UCAT section in step 1 to run the line parser and see counts.
          </p>
        ) : (
          <div className="mt-2 space-y-1">
            <StatRow label="Question stems" value={stats.totalStems} />
            <StatRow label="Questions" value={stats.totalQuestions} />
            <StatRow label="Answer options" value={stats.totalOptions} />
          </div>
        )}
      </div>
      {sectionKnown && stats.stemBreakdown.length > 0 && (
        <div>
          <p className="font-semibold text-foreground">Breakdown by stem</p>
          <div className="mt-2 max-h-40 overflow-y-auto overscroll-contain rounded-md border border-border/50 pr-1">
            <ul className="space-y-1.5 pl-0.5">
              {stats.stemBreakdown.map((row) => (
                <li key={row.stemIndex} className="text-[11px] leading-snug">
                  <span className="font-medium">Stem {row.stemIndex}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {row.questionCount} question{row.questionCount === 1 ? '' : 's'}
                    {' · '}
                    {row.optionCount} option{row.optionCount === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function AnswersTooltipBody({ stats }: { stats: AnswerPasteStats }) {
  const totalAnswerLines = stats.totalMcqAnswerRows + stats.totalSyllogismTokenRows
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold text-foreground">Totals</p>
        <div className="mt-2 space-y-1">
          <StatRow
            label="Answer lines (MCQ + syllogism)"
            value={totalAnswerLines}
          />
          <StatRow label="· MCQ letter rows" value={stats.totalMcqAnswerRows} />
          <StatRow label="· Syllogism Y/N rows" value={stats.totalSyllogismTokenRows} />
          <StatRow label="Question-level explanations" value={stats.totalQuestionExplanations} />
          <StatRow label="Option-level explanations" value={stats.totalOptionExplanations} />
        </div>
      </div>
      {stats.coverage.length > 0 && (
        <div>
          <p className="font-semibold text-foreground">By question (sheet)</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Rows without a leading question number are listed as #1, #2, … in paste order.
          </p>
          <div className="mt-2 max-h-48 overflow-y-auto overscroll-contain rounded-md border border-border/50">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left">
                  <th className="sticky top-0 bg-muted/30 px-2 py-1.5 font-medium">Q</th>
                  <th className="sticky top-0 bg-muted/30 px-2 py-1.5 font-medium">Answer</th>
                  <th className="sticky top-0 bg-muted/30 px-2 py-1.5 font-medium">Q expl</th>
                  <th className="sticky top-0 bg-muted/30 px-2 py-1.5 font-medium">Opt expl</th>
                </tr>
              </thead>
              <tbody>
                {stats.coverage.map((row) => (
                  <tr key={`${row.sortKey}-${row.label}`} className="border-b border-border/30 last:border-0">
                    <td className="px-2 py-1 font-medium tabular-nums">{row.label}</td>
                    <td className="px-2 py-1">
                      <YesDash ok={row.hasAnswer} />
                    </td>
                    <td className="px-2 py-1">
                      <YesDash ok={row.hasQuestionExplanation} />
                    </td>
                    <td className="px-2 py-1">
                      <YesDash ok={row.hasOptionExplanations} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export type BulkImportParseInfoButtonProps = QuestionsPanelProps | AnswersPanelProps

export function BulkImportParseInfoButton(props: BulkImportParseInfoButtonProps) {
  const label =
    props.variant === 'questions'
      ? 'Parse statistics for pasted questions'
      : 'Parse statistics for pasted answers'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={label}
          >
            <Info className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-sm max-h-[min(24rem,70vh)] overflow-y-auto p-3 text-xs leading-snug"
        >
          {props.variant === 'questions' ? (
            <QuestionsTooltipBody stats={props.stats} sectionKnown={props.sectionKnown} />
          ) : (
            <AnswersTooltipBody stats={props.stats} />
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
