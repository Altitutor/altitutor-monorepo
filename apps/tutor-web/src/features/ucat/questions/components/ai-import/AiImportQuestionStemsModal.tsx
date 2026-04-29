'use client'

import { useMemo, useRef, useState } from 'react'
import type { Json } from '@altitutor/shared'
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useToast } from '@altitutor/ui'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import {
  useExtractAiImportQuestionDrafts,
  useGenerateMissingAiImportAnswers,
  useImportGeneratedUcatQuestionStems,
  useRunAiImportQc,
  useUcatCategories,
  useUcatSections,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type {
  AiImportDraftStemPayload,
  AiImportIssue,
  AiImportSectionKey,
} from '@/features/ucat/questions/lib/ai-import/schema'
import { Step1PasteAiImportDocument } from '@/features/ucat/questions/components/ai-import/Step1PasteAiImportDocument'
import { Step2ReviewAiImport } from '@/features/ucat/questions/components/ai-import/Step2ReviewAiImport'

type AiImportQuestionStemsModalProps = {
  open: boolean
  onClose: () => void
}

type DraftWithMetadata = BulkImportStemDraft & {
  aiGenerationMetadata: Json | null
}

function toFormValues(stem: AiImportDraftStemPayload): UcatQuestionStemFormValues {
  return {
    sectionId: stem.sectionId,
    categoryId: stem.categoryId ?? null,
    stemText: stem.stemText as Json,
    isPrivate: stem.isPrivate,
    questions: stem.questions.map((question) => ({
      questionText: question.questionText as Json,
      questionType: question.questionType,
      answerExplanation: (question.answerExplanation ?? null) as Json | null,
      difficulty: question.difficulty ?? null,
      timeBurdenSeconds:
        question.timeBurdenSeconds != null ? String(question.timeBurdenSeconds) : '',
      tagIds: question.tagIds ?? [],
      options: question.options.map((option) => ({
        answerText: option.answerText as Json,
        answerExplanation: (option.answerExplanation ?? null) as Json | null,
        isAnswer: option.isAnswer,
      })),
    })),
  }
}

function toAiDraftPayload(draft: DraftWithMetadata): AiImportDraftStemPayload {
  return {
    sectionId: draft.values.sectionId,
    categoryId: draft.values.categoryId ?? null,
    stemText: draft.values.stemText,
    isPrivate: draft.values.isPrivate,
    questions: draft.values.questions.map((question, questionIndex) => ({
      index: questionIndex + 1,
      questionText: question.questionText,
      answerExplanation: question.answerExplanation ?? null,
      difficulty: question.difficulty ?? null,
      timeBurdenSeconds:
        question.timeBurdenSeconds && question.timeBurdenSeconds.trim().length > 0
          ? Number(question.timeBurdenSeconds)
          : null,
      questionType: question.questionType,
      tagIds: question.tagIds ?? [],
      options: question.options.map((option, optionIndex) => ({
        index: optionIndex + 1,
        answerText: option.answerText,
        answerExplanation: option.answerExplanation ?? null,
        isAnswer: option.isAnswer,
      })),
    })),
    aiGenerationMetadata: draft.aiGenerationMetadata ?? null,
  }
}

function toImportPayload(draft: DraftWithMetadata): Record<string, unknown> {
  const payload = toAiDraftPayload(draft)
  return payload as unknown as Record<string, unknown>
}

function sectionNameToKey(name: string | null | undefined): AiImportSectionKey | null {
  if (name === 'Verbal Reasoning') return 'verbal_reasoning'
  if (name === 'Decision Making') return 'decision_making'
  if (name === 'Quantitative Reasoning') return 'quantitative_reasoning'
  if (name === 'Situational Judgement') return 'situational_judgement'
  return null
}

export function AiImportQuestionStemsModal({ open, onClose }: AiImportQuestionStemsModalProps) {
  const { toast } = useToast()
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const extractMutation = useExtractAiImportQuestionDrafts()
  const generateMissingMutation = useGenerateMissingAiImportAnswers()
  const runQcMutation = useRunAiImportQc()
  const importMutation = useImportGeneratedUcatQuestionStems()

  const [step, setStep] = useState<'config' | 'review'>('config')
  const [sectionId, setSectionId] = useState('')
  const [document, setDocument] = useState<Json | null>(null)
  const [expectedQuestionCount, setExpectedQuestionCount] = useState('')
  const [drafts, setDrafts] = useState<DraftWithMetadata[]>([])
  const [warnings, setWarnings] = useState<AiImportIssue[]>([])
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [importSucceeded, setImportSucceeded] = useState(false)
  const newImageFileIdsRef = useRef<Set<string>>(new Set())

  const sections = sectionsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const selectedSection = sections.find((section) => section.id === sectionId) ?? null

  function resetState() {
    setStep('config')
    setSectionId('')
    setDocument(null)
    setExpectedQuestionCount('')
    setDrafts([])
    setWarnings([])
    setRejectionReason(null)
    setImportSucceeded(false)
    newImageFileIdsRef.current = new Set()
  }

  function handleRequestClose() {
    const ids = Array.from(newImageFileIdsRef.current)
    if (ids.length > 0 && !importSucceeded) {
      void fetch('/api/ucat/images/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ids }),
      }).catch((error) => {
        console.error('Failed to cleanup AI import images:', error)
      })
    }
    resetState()
    onClose()
  }

  async function handleExtract() {
    if (!sectionId || !document) return
    try {
      const result = await extractMutation.mutateAsync({
        sectionId,
        document,
        expectedQuestionCount: expectedQuestionCount ? Number(expectedQuestionCount) : null,
      })
      if (result.status === 'rejected') {
        setRejectionReason(result.rejectionReason ?? 'Source does not appear to contain UCAT questions.')
        setWarnings(result.warnings ?? [])
        setDrafts([])
        return
      }
      const nextDrafts: DraftWithMetadata[] = result.stems.map((stem, index) => ({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `ai-import-${index + 1}`,
        values: toFormValues(stem),
        aiGenerationMetadata: (stem.aiGenerationMetadata ?? null) as Json | null,
      }))
      setDrafts(nextDrafts)
      setWarnings(result.warnings ?? [])
      setRejectionReason(null)
      setStep('review')
    } catch (error) {
      toast({
        title: 'AI extraction failed',
        description: error instanceof Error ? error.message : 'Unable to extract questions from document',
        variant: 'destructive',
      })
    }
  }

  async function handleGenerateMissing() {
    if (!selectedSection) return
    const sectionKey = sectionNameToKey(selectedSection.name)
    if (!sectionKey) return
    try {
      const result = await generateMissingMutation.mutateAsync({
        section: sectionKey,
        stems: drafts.map(toAiDraftPayload),
      })
      const nextDrafts = result.stems.map((stem, index) => ({
        id: drafts[index]?.id ?? `ai-import-${index + 1}`,
        values: toFormValues(stem),
        aiGenerationMetadata: (stem.aiGenerationMetadata ?? null) as Json | null,
      }))
      setDrafts(nextDrafts)
      toast({
        title: 'Missing answers generated',
        description: `${result.updates.length} update${result.updates.length === 1 ? '' : 's'} applied.`,
      })
    } catch (error) {
      toast({
        title: 'Generate missing failed',
        description: error instanceof Error ? error.message : 'Unable to generate missing answers',
        variant: 'destructive',
      })
    }
  }

  async function handleRunQc() {
    if (!selectedSection) return
    const sectionKey = sectionNameToKey(selectedSection.name)
    if (!sectionKey) return
    try {
      const result = await runQcMutation.mutateAsync({
        section: sectionKey,
        stems: drafts.map(toAiDraftPayload),
      })
      const nextDrafts = result.stems.map((stem, index) => ({
        id: drafts[index]?.id ?? `ai-import-${index + 1}`,
        values: toFormValues(stem),
        aiGenerationMetadata: (stem.aiGenerationMetadata ?? null) as Json | null,
      }))
      setDrafts(nextDrafts)
      toast({
        title: 'QC completed',
        description: `${result.issues.length} issue${result.issues.length === 1 ? '' : 's'} reported.`,
      })
    } catch (error) {
      toast({
        title: 'QC failed',
        description: error instanceof Error ? error.message : 'Unable to run quality checks',
        variant: 'destructive',
      })
    }
  }

  async function handleImport() {
    if (!sectionId || drafts.length === 0) return
    try {
      await importMutation.mutateAsync({
        sectionId,
        stems: drafts.map(toImportPayload),
      })
      setImportSucceeded(true)
      toast({
        title: 'AI import drafts queued',
        description: `${drafts.length} stem${drafts.length === 1 ? '' : 's'} imported to generated queue.`,
      })
      handleRequestClose()
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unable to import AI drafts',
        variant: 'destructive',
      })
    }
  }

  const canExtract = useMemo(() => !!sectionId && !!document, [sectionId, document])
  const isPending =
    extractMutation.isPending ||
    generateMissingMutation.isPending ||
    runQcMutation.isPending ||
    importMutation.isPending

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? handleRequestClose() : undefined)}>
      <DialogContent className="w-full md:max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <div className="border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle>AI Import Questions</DialogTitle>
            <DialogDescription>
              {step === 'config'
                ? 'Paste one rich-text UCAT document for verbatim extraction into structured drafts.'
                : 'Review extraction results. Optionally generate missing answers or run QC, then import to generated queue.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'config' ? (
            <div className="space-y-4">
              <Step1PasteAiImportDocument
                sectionId={sectionId}
                sections={sections}
                document={document}
                expectedQuestionCount={expectedQuestionCount}
                onSectionIdChange={setSectionId}
                onDocumentChange={setDocument}
                onExpectedQuestionCountChange={setExpectedQuestionCount}
                onImageFileIdsChange={(ids) => ids.forEach((id) => newImageFileIdsRef.current.add(id))}
              />
              {rejectionReason ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {rejectionReason}
                </div>
              ) : null}
            </div>
          ) : (
            <Step2ReviewAiImport
              stems={drafts}
              categories={categories}
              warnings={warnings}
              onUpdateStem={(stemId, values) =>
                setDrafts((prev) =>
                  prev.map((draft) => (draft.id === stemId ? { ...draft, values } : draft))
                )
              }
            />
          )}
        </div>

        <div className="border-t px-6 py-4 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 'review') {
                setStep('config')
                return
              }
              handleRequestClose()
            }}
            disabled={isPending}
          >
            {step === 'review' ? 'Back' : 'Cancel'}
          </Button>

          {step === 'config' ? (
            <Button onClick={() => void handleExtract()} disabled={!canExtract || isPending}>
              {extractMutation.isPending ? 'Extracting...' : 'Extract with AI'}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void handleGenerateMissing()} disabled={isPending}>
                {generateMissingMutation.isPending ? 'Generating...' : 'Generate Missing Answers'}
              </Button>
              <Button variant="outline" onClick={() => void handleRunQc()} disabled={isPending}>
                {runQcMutation.isPending ? 'Running QC...' : 'Run QC'}
              </Button>
              <Button onClick={() => void handleImport()} disabled={isPending || drafts.length === 0}>
                {importMutation.isPending ? 'Importing...' : 'Import to generated queue'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
