'use client'

import type { Json } from '@altitutor/shared'
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@altitutor/ui'
import { cn } from '@/shared/utils'
import { UcatRichContentBlock } from '@/features/ucat/question-engine-preview/UcatRichContentBlock'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type {
  BulkImportDuplicateFinding,
  BulkImportDuplicateFindingSide,
} from '@/features/ucat/questions/server/bulk-import-duplicate-analysis'

function richJson(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function RichContent({ value }: { value: unknown }) {
  return (
    <UcatRichContentBlock
      json={richJson(value)}
      plainText={proseMirrorToPlainText(value as Json) ?? ''}
      preloadedContent={richJson(value)}
      textTone="theme"
      className="text-sm"
    />
  )
}

function SidePanel({ label, side }: { label: string; side: BulkImportDuplicateFindingSide }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold">{label}</p>
        <Badge variant="outline">
          {side.source === 'draft' ? 'This import' : side.status?.replace('_', ' ')}
        </Badge>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stem</p>
          <RichContent value={side.stemText} />
        </div>
        {[...side.questions]
          .sort((left, right) => left.questionIndex - right.questionIndex)
          .map((question, index) => (
            <div key={`${side.stemId}:${question.id ?? question.questionIndex}`} className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Question {index + 1}
              </p>
              <RichContent value={question.questionText} />
              {question.options.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {question.options.map((option, optionIndex) => (
                    <li
                      key={`${question.id ?? question.questionIndex}:option:${optionIndex}`}
                      className={cn(
                        'rounded-md border px-2 py-1.5',
                        option.answerKeyValue != null && 'border-emerald-500/40 bg-emerald-500/5',
                      )}
                    >
                      <span className="mr-1 text-muted-foreground">
                        {String.fromCharCode(65 + optionIndex)}.
                      </span>
                      <RichContent value={option.answerText} />
                      {option.answerKeyValue != null ? (
                        <span className="mt-1 block text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Correct answer
                        </span>
                      ) : null}
                      {proseMirrorToPlainText(option.answerExplanation as Json)?.trim() ? (
                        <div className="mt-2 rounded bg-muted/40 px-2 py-1.5">
                          <span className="text-xs font-medium text-muted-foreground">Explanation</span>
                          <RichContent value={option.answerExplanation} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {proseMirrorToPlainText(question.answerExplanation as Json)?.trim() ? (
                <div className="rounded bg-muted/40 px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground">Explanation</span>
                  <RichContent value={question.answerExplanation} />
                </div>
              ) : null}
            </div>
          ))}
      </div>
    </div>
  )
}

export function BulkImportDuplicatePreviewDialog({
  finding,
  onOpenChange,
}: {
  finding: BulkImportDuplicateFinding | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={finding != null} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-[min(95vw,110rem)] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Compare duplicate candidate</DialogTitle>
          {finding ? (
            <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
              <Badge variant="secondary">Stem match</Badge>
              <span>{Math.round(finding.similarity * 100)}% similar</span>
            </div>
          ) : null}
        </DialogHeader>
        {finding ? (
          <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
            <SidePanel label="Import candidate" side={finding.draft} />
            <SidePanel
              label={finding.match.source === 'catalog' ? 'Saved question' : 'Other import candidate'}
              side={finding.match}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
