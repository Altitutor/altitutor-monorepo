'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { SearchableSelect } from '@altitutor/ui'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { BulkImportRichTextPreview } from '@/features/ucat/questions/components/bulk-import/BulkImportRichTextPreview'
import { taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import { cn } from '@/shared/utils'

export type BulkImportCategoryOption = {
  id: string
  name?: string | null
  label?: string | null
  ucat_section_id?: string | null
}

type StepStemCategoriesProps = {
  stems: BulkImportStemDraft[]
  sectionId: string | null
  categories: BulkImportCategoryOption[]
  onUpdateStem: (stemId: string, values: UcatQuestionStemFormValues) => void
  /** Fill missing categoryIds from stem/question wording (e.g. SJ How Important / How Appropriate). */
  inferMissingCategoryId?: (values: UcatQuestionStemFormValues) => string | null
}

function previewText(stem: BulkImportStemDraft): string {
  return proseMirrorToPlainText(stem.values.stemText)?.replace(/\s+/g, ' ').trim() ?? ''
}

export function everyStemHasCategory(stems: BulkImportStemDraft[]): boolean {
  return stems.length > 0 && stems.every((stem) => !!stem.values.categoryId)
}

export function StepStemCategories({
  stems,
  sectionId,
  categories,
  onUpdateStem,
  inferMissingCategoryId,
}: StepStemCategoriesProps) {
  const [expandedStemId, setExpandedStemId] = useState<string | null>(null)
  const inferredStemIdsRef = useRef<Set<string>>(new Set())
  const sectionCategories = useMemo(
    () => categories.filter((category) => (category.ucat_section_id ?? null) === sectionId),
    [categories, sectionId]
  )

  useEffect(() => {
    if (!inferMissingCategoryId || !sectionId) return

    for (const stem of stems) {
      if (stem.values.categoryId) {
        inferredStemIdsRef.current.add(stem.id)
        continue
      }
      if (inferredStemIdsRef.current.has(stem.id)) continue
      inferredStemIdsRef.current.add(stem.id)
      const categoryId = inferMissingCategoryId(stem.values)
      if (categoryId) {
        onUpdateStem(stem.id, {
          ...stem.values,
          categoryId,
        })
      }
    }
  }, [inferMissingCategoryId, onUpdateStem, sectionId, stems])

  if (stems.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Set question stem categories</h2>
        <p className="text-sm text-muted-foreground">No parsed stems are available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Set question stem categories</h2>
      <div className="space-y-3">
        {stems.map((stem, index) => {
          const expanded = expandedStemId === stem.id
          const category = sectionCategories.find((item) => item.id === stem.values.categoryId)
          const selected = category ?? null
          const text = previewText(stem)
          return (
            <div
              key={stem.id}
              className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-3"
            >
              <div
                className={cn(
                  'min-w-0 flex-1 rounded-md border bg-background',
                  !stem.values.categoryId && 'border-destructive/50'
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left"
                  onClick={() => setExpandedStemId(expanded ? null : stem.id)}
                >
                  {expanded ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">Stem {index + 1}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {text || 'No stem preview'}
                    </p>
                  </div>
                </button>
                {expanded ? (
                  <div className="border-t px-3 py-3">
                    <BulkImportRichTextPreview json={stem.values.stemText} />
                  </div>
                ) : null}
              </div>

              <div className="w-full shrink-0 lg:w-52">
                <SearchableSelect<BulkImportCategoryOption>
                  items={sectionCategories}
                  value={selected}
                  onValueChange={(item) => {
                    onUpdateStem(stem.id, {
                      ...stem.values,
                      categoryId: item?.id ?? null,
                    })
                  }}
                  getItemId={(item) => item.id}
                  getItemLabel={(item) => taxonomyDisplayLabel(item)}
                  getItemValue={(item) => taxonomyDisplayLabel(item)}
                  placeholder="Select category"
                  searchPlaceholder="Search categories..."
                  emptyMessage="No categories found"
                  triggerClassName="h-9 text-xs"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
