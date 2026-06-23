'use client'

import { Input, Label } from '@altitutor/ui'
import type { SyllogismManualEntryTarget } from '@/features/ucat/questions/components/bulk-import/bulkImportSyllogismManual'

type StepSyllogismManualEntryProps = {
  targets: SyllogismManualEntryTarget[]
  onTargetsChange: (targets: SyllogismManualEntryTarget[]) => void
}

const STATEMENT_LABELS = ['A', 'B', 'C', 'D', 'E']

export function StepSyllogismManualEntry({
  targets,
  onTargetsChange,
}: StepSyllogismManualEntryProps) {
  function updateStatement(targetId: string, statementIndex: number, value: string) {
    onTargetsChange(
      targets.map((target) => {
        if (target.targetId !== targetId) return target
        const statements = [...target.statements]
        statements[statementIndex] = value
        return { ...target, statements }
      })
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          OCR could not read every syllogism image. Enter the five statements for each question
          below so the rest of the import can continue.
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
        {targets.map((target) => (
          <section
            key={target.targetId}
            className="space-y-3 rounded-lg border border-border bg-muted/20 p-4"
          >
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Stem {target.stemIndex + 1} · Question {target.questionNumber}
              </p>
              <p className="text-sm leading-snug">{target.questionText}</p>
            </div>
            <div className="space-y-2">
              {STATEMENT_LABELS.map((label, index) => (
                <div key={`${target.targetId}-${label}`} className="space-y-1">
                  <Label htmlFor={`${target.targetId}-statement-${index}`} className="text-xs">
                    Statement {label}
                  </Label>
                  <Input
                    id={`${target.targetId}-statement-${index}`}
                    value={target.statements[index] ?? ''}
                    onChange={(event) => updateStatement(target.targetId, index, event.target.value)}
                    placeholder={`Enter statement ${label}`}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
