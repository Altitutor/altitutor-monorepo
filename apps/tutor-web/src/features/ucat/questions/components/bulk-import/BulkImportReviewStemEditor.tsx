'use client'

import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { ucatQuestionStemSchema } from '@/features/ucat/questions/types/schema'
import { UcatStemEditorShell } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorShell'
import type { Json } from '@altitutor/shared'
import type {
  CategoryOption,
  TagOption,
  UcatSectionOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { UcatQuestionSourceChannel } from '@/features/ucat/questions/api/questions'
import type { BulkImportAiReviewResult } from '@/features/ucat/questions/lib/bulk-import-ai-review'
import type { BulkImportAiStemPhase } from '@/features/ucat/questions/hooks/useBulkImportReviewController'

type BulkImportReviewStemEditorProps = {
  stemId: string
  values: UcatQuestionStemFormValues
  initialQuestionIndex: number
  sections: UcatSectionOption[]
  categories: CategoryOption[]
  tags: TagOption[]
  onUpdateStem: (stemId: string, values: UcatQuestionStemFormValues) => void
  onNewImageFileIds?: (fileIds: string[]) => void
  onActiveTextEditorChange?: (editor: Editor | null) => void
  sourceChannel?: UcatQuestionSourceChannel | null
  aiGenerationMetadata?: Json | null
  aiReviewResult?: BulkImportAiReviewResult | null
  aiReviewPhase?: BulkImportAiStemPhase
  aiReviewStale?: boolean
  onApproveAiFinding?: (findingKey: string) => void
  onKeepAiFinding?: (findingKey: string) => void
}

function stemValuesFingerprint(values: UcatQuestionStemFormValues): string {
  return JSON.stringify(values)
}

export function BulkImportReviewStemEditor({
  stemId,
  values,
  initialQuestionIndex,
  sections,
  categories,
  tags,
  onUpdateStem,
  onNewImageFileIds,
  onActiveTextEditorChange,
  sourceChannel,
  aiGenerationMetadata,
  aiReviewResult = null,
  aiReviewPhase = 'idle',
  aiReviewStale = false,
  onApproveAiFinding,
  onKeepAiFinding,
}: BulkImportReviewStemEditorProps) {
  const createForm = useForm as unknown as (props: {
    resolver: unknown
    defaultValues: UcatQuestionStemFormValues
  }) => UseFormReturn<UcatQuestionStemFormValues>

  const form = createForm({
    resolver: zodResolver(ucatQuestionStemSchema),
    defaultValues: values,
  })

  /** Last values object we pushed to the parent (reference equality short-circuits echoes). */
  const lastEmittedValuesRef = useRef<UcatQuestionStemFormValues>(values)
  const lastFingerprintRef = useRef(stemValuesFingerprint(values))
  /** Blocks watch→parent while applying an external parent→form reset. */
  const syncingFromParentRef = useRef(false)
  const syncClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onUpdateStemRef = useRef(onUpdateStem)
  onUpdateStemRef.current = onUpdateStem

  useEffect(() => {
    // Echo of our own watch emission — keep refs fresh, never reset (reset remounts TipTap).
    if (values === lastEmittedValuesRef.current) {
      return
    }

    const fingerprint = stemValuesFingerprint(values)
    if (fingerprint === lastFingerprintRef.current) {
      lastEmittedValuesRef.current = values
      return
    }

    // Same content as the live form (AI tools already wrote via setValue).
    if (fingerprint === stemValuesFingerprint(form.getValues())) {
      lastEmittedValuesRef.current = values
      lastFingerprintRef.current = fingerprint
      return
    }

    let cancelled = false
    syncingFromParentRef.current = true
    if (syncClearTimeoutRef.current) {
      clearTimeout(syncClearTimeoutRef.current)
      syncClearTimeoutRef.current = null
    }

    form.reset(values)
    lastEmittedValuesRef.current = values
    lastFingerprintRef.current = fingerprint

    // TipTap prop-sync runs after paint; keep watch suppressed until editors settle.
    syncClearTimeoutRef.current = setTimeout(() => {
      syncClearTimeoutRef.current = null
      if (cancelled) return
      const settled = form.getValues()
      const settledFp = stemValuesFingerprint(settled)
      lastFingerprintRef.current = settledFp
      lastEmittedValuesRef.current = settled
      syncingFromParentRef.current = false
      if (settledFp !== fingerprint) {
        onUpdateStemRef.current(stemId, settled)
      }
    }, 0)

    return () => {
      cancelled = true
      if (syncClearTimeoutRef.current) {
        clearTimeout(syncClearTimeoutRef.current)
        syncClearTimeoutRef.current = null
      }
      syncingFromParentRef.current = false
    }
  }, [form, stemId, values])

  useEffect(() => {
    const watchAll = form.watch as (
      callback: (values: UcatQuestionStemFormValues) => void
    ) => { unsubscribe: () => void }

    const subscription = watchAll((nextValues) => {
      if (syncingFromParentRef.current) return
      const fingerprint = stemValuesFingerprint(nextValues)
      if (fingerprint === lastFingerprintRef.current) return
      lastFingerprintRef.current = fingerprint
      lastEmittedValuesRef.current = nextValues
      onUpdateStemRef.current(stemId, nextValues)
    })
    return () => subscription.unsubscribe()
  }, [form, stemId])

  const sectionMeta = sections.find((section) => section.id === values.sectionId)
  const questionCount = values.questions?.length ?? 0
  const aiReviewAvailable = Boolean(
    aiReviewResult ||
    aiReviewPhase !== 'idle' ||
    onApproveAiFinding ||
    onKeepAiFinding
  )

  return (
    <UcatStemEditorShell
      flush
      form={form}
      sections={sections}
      categories={categories}
      tags={tags}
      stemId={stemId}
      enableImages
      sectionTitleOverride={sectionMeta?.name ?? undefined}
      displayColumnsFallback={sectionMeta?.display_columns ?? undefined}
      initialQuestionIndex={initialQuestionIndex}
      showQuestionNavigator={questionCount > 1}
      onNewImageFileIds={onNewImageFileIds}
      onActiveTextEditorChange={onActiveTextEditorChange}
      sourceChannel={sourceChannel ?? null}
      aiGenerationMetadata={aiGenerationMetadata ?? null}
      aiReviewAvailable={aiReviewAvailable}
      bulkImportAiReview={aiReviewAvailable ? {
        result: aiReviewResult,
        phase: aiReviewPhase,
        stale: aiReviewStale,
        onApproveFinding: onApproveAiFinding,
        onKeepFinding: onKeepAiFinding,
      } : undefined}
      className="flex h-full min-h-0 overflow-hidden"
    />
  )
}
