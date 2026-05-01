'use client'

import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import { Step3SetAnswers } from '@/features/ucat/questions/components/bulk-import/Step3SetAnswers'
import { AiImportIssueBadges } from '@/features/ucat/questions/components/ai-import/AiImportIssueBadges'
import type { AiImportIssue } from '@/features/ucat/questions/lib/ai-import/schema'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'

type CategoryOption = { id?: string | null; name?: string | null }

type Step2ReviewAiImportProps = {
  stems: BulkImportStemDraft[]
  categories: CategoryOption[]
  sections?: Array<{ id: string | null; display_columns?: number | null }>
  warnings: AiImportIssue[]
  onUpdateStem: (stemId: string, values: UcatQuestionStemFormValues) => void
}

export function Step2ReviewAiImport({
  stems,
  categories,
  sections = [],
  warnings,
  onUpdateStem,
}: Step2ReviewAiImportProps) {
  const questionCount = stems.reduce((sum, stem) => sum + (stem.values.questions?.length ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">Extraction summary</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Extracted {stems.length} stem{stems.length === 1 ? '' : 's'} and {questionCount} question
          {questionCount === 1 ? '' : 's'}. Review every row before importing.
        </div>
        {warnings.length > 0 ? (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Warnings</div>
            <AiImportIssueBadges issues={warnings} />
          </div>
        ) : null}
      </div>

      <Step3SetAnswers stems={stems} categories={categories} sections={sections} onUpdateStem={onUpdateStem} />
    </div>
  )
}
