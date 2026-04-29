'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog'
import { cn } from '@/shared/utils'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  useBulkImportWizard,
  type BulkImportStemDraft,
} from '@/features/ucat/questions/hooks/useBulkImportWizard'
import {
  useUcatCategories,
  useUcatSections,
  useUcatTags,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { bulkImportSectionFromUcatName } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import { Step1ChooseSection } from '@/features/ucat/questions/components/bulk-import/Step1ChooseSection'
import {
  Step2PasteDocument,
  type ParsingOptions,
  type PasteTableBehavior,
} from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'
import { Step2PasteAnswers } from '@/features/ucat/questions/components/bulk-import/Step2PasteAnswers'
import { Step3SetAnswers } from '@/features/ucat/questions/components/bulk-import/Step3SetAnswers'
import {
  Step4CreateSet,
  type AddToSetConfig,
} from '@/features/ucat/questions/components/bulk-import/Step4CreateSet'
import {
  parseVerbalReasoningFromDoc,
  mapParsedVerbalReasoningToFormValues,
  getVerbalReasoningStemCategoryName,
} from '@/features/ucat/questions/lib/parsers/verbalReasoning'
import {
  parseDecisionMakingFromDoc,
  mapParsedDecisionMakingToFormValues,
  getDecisionMakingStemCategoryName,
} from '@/features/ucat/questions/lib/parsers/decisionMaking'
import {
  parseQuantitativeReasoningFromDoc,
  mapParsedQuantitativeReasoningToFormValues,
} from '@/features/ucat/questions/lib/parsers/quantitativeReasoning'
import {
  parseSituationalJudgementFromDoc,
  mapParsedSituationalJudgementToFormValues,
  getSituationalJudgementStemCategoryName,
} from '@/features/ucat/questions/lib/parsers/situationalJudgement'
import {
  parseAnswersTable,
  letterToOptionIndex,
  parseDecisionMakingAnswers,
} from '@/features/ucat/questions/lib/parseAnswersTable'
import { answerDocToPlainTsv } from '@/features/ucat/questions/lib/pmAnswerLineRanges'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

export type BulkImportSubmitArgs = {
  sectionId: string
  stems: UcatQuestionStemFormValues[]
  addToSet: AddToSetConfig | null
}

type BulkImportQuestionStemsModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (args: BulkImportSubmitArgs) => Promise<void>
  onEditSet?: (setId: string) => void
}

export function BulkImportQuestionStemsModal({
  open,
  onClose,
  onSubmit,
  onEditSet,
}: BulkImportQuestionStemsModalProps) {
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()

  const wizard = useBulkImportWizard()

  const [step, setStep] = useState(0)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [pastedContent, setPastedContent] = useState<Json | null>(null)
  const [pastedAnswersJson, setPastedAnswersJson] = useState<Json | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [pasteTableBehavior, setPasteTableBehavior] = useState<PasteTableBehavior>('strip_outside')
  const [addToSetEnabled, setAddToSetEnabled] = useState(false)
  const [addToSetConfig, setAddToSetConfig] = useState<AddToSetConfig | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [parsingOptions, setParsingOptions] = useState<ParsingOptions>({
    questionIndicator: 'dot',
    answerOptionIndicator: 'paren',
    questionNumberOnOwnLine: false,
    answerOptionOnOwnLine: false,
  })
  const [includeAnswerExplanationsOnImport, setIncludeAnswerExplanationsOnImport] =
    useState(true)
  const step2NewImageFileIdsRef = useRef<Set<string>>(new Set())

  // Reset wizard and local state when modal closes.
  useEffect(() => {
    if (!open) {
      setExpanded(false)
      setStep(0)
      setStatus('idle')
      setSubmitError(null)
      setSectionId(null)
      setPastedContent(null)
      setPastedAnswersJson(null)
      setParseError(null)
      setPasteTableBehavior('strip_outside')
      setAddToSetEnabled(false)
      setAddToSetConfig(null)
      setParsingOptions({
        questionIndicator: 'dot',
        answerOptionIndicator: 'paren',
        questionNumberOnOwnLine: false,
        answerOptionOnOwnLine: false,
      })
      setIncludeAnswerExplanationsOnImport(true)
      step2NewImageFileIdsRef.current = new Set()
      wizard.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only when open changes; wizard.reset is stable
  }, [open])

  const handleStep2ImageFileIds = useCallback((fileIds: string[]) => {
    fileIds.forEach((id) => step2NewImageFileIdsRef.current.add(id))
  }, [])

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categories = categoriesQuery.data ?? []

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === sectionId) ?? null,
    [sections, sectionId]
  )

  /** Normalizes DB casing/spelling so parsers + in-editor highlights stay aligned. */
  const resolvedBulkImportSection = useMemo(
    () => bulkImportSectionFromUcatName(selectedSection?.name),
    [selectedSection?.name]
  )
  const isVerbalReasoningSection = resolvedBulkImportSection === 'verbal_reasoning'
  const isDecisionMakingSection = resolvedBulkImportSection === 'decision_making'
  const isQuantitativeReasoningSection =
    resolvedBulkImportSection === 'quantitative_reasoning'
  const isSituationalJudgementSection =
    resolvedBulkImportSection === 'situational_judgement'
  const isBulkParseSection =
    isVerbalReasoningSection ||
    isDecisionMakingSection ||
    isQuantitativeReasoningSection ||
    isSituationalJudgementSection

  const canGoPrevious = useMemo(() => step > 0 && status !== 'submitting', [step, status])
  const totalStepsResolved = 4
  const canGoNext = useMemo(() => {
    if (status === 'submitting') return false
    if (step === 0) return !!sectionId
    if (step === 1) return true
    if (step >= totalStepsResolved - 1) return false
    return true
  }, [step, status, sectionId, totalStepsResolved])

  const isLoadingMeta =
    sectionsQuery.isLoading || categoriesQuery.isLoading || tagsQuery.isLoading

  const hasErrorMeta =
    sectionsQuery.isError || categoriesQuery.isError || tagsQuery.isError

  function handleRequestClose() {
    if (status === 'submitting') return
    const ids = Array.from(step2NewImageFileIdsRef.current)
    if (ids.length > 0 && status !== 'success') {
      void fetch('/api/ucat/images/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ids }),
      }).catch((error) => {
        console.error('Failed to cleanup UCAT images from bulk import step 2:', error)
      })
    }
    onClose()
  }

  /** Parse pasted content according to the selected section; used when leaving the paste step. */
  function parseForCurrentSection():
    | { ok: true; drafts: BulkImportStemDraft[] }
    | { ok: false } {
    if (!sectionId) return { ok: false }
    if (isVerbalReasoningSection) {
      try {
        const parsed = parseVerbalReasoningFromDoc(pastedContent, parsingOptions)
        const forms = mapParsedVerbalReasoningToFormValues(parsed, {
          sectionId,
          isPrivate: false,
          getCategoryIdForStem: (stem) => {
            const name = getVerbalReasoningStemCategoryName(stem)
            const category = categories.find(
              (c) => (c.ucat_section_id ?? null) === sectionId && (c.name ?? '').trim() === name
            )
            return category?.id ?? null
          },
        })

        if (forms.length === 0) {
          setParseError('No valid stems and questions were detected. Please check the formatting.')
          wizard.setStems([])
          return { ok: false }
        }

        const drafts = wizard.setStems(forms)
        setParseError(null)
        return { ok: true, drafts }
      } catch (error) {
        setParseError(
          error instanceof Error
            ? `Failed to parse Verbal Reasoning passage: ${error.message}`
            : 'Failed to parse Verbal Reasoning passage.'
        )
        wizard.setStems([])
        return { ok: false }
      }
    }
    if (isDecisionMakingSection) {
      try {
        const parsed = parseDecisionMakingFromDoc(pastedContent, parsingOptions)
        const forms = mapParsedDecisionMakingToFormValues(parsed, {
          sectionId,
          isPrivate: false,
          getCategoryIdForStem: (stem) => {
            const name = getDecisionMakingStemCategoryName(stem)
            const category = categories.find(
              (c) => (c.ucat_section_id ?? null) === sectionId && (c.name ?? '').trim() === name
            )
            return category?.id ?? null
          },
        })

        if (forms.length === 0) {
          setParseError('No valid stems and questions were detected. Please check the formatting.')
          wizard.setStems([])
          return { ok: false }
        }

        const drafts = wizard.setStems(forms)
        setParseError(null)
        return { ok: true, drafts }
      } catch (error) {
        setParseError(
          error instanceof Error
            ? `Failed to parse Decision Making: ${error.message}`
            : 'Failed to parse Decision Making.'
        )
        wizard.setStems([])
        return { ok: false }
      }
    }
    if (isQuantitativeReasoningSection) {
      try {
        const result = parseQuantitativeReasoningFromDoc(pastedContent, parsingOptions)
        const forms = mapParsedQuantitativeReasoningToFormValues(result, {
          sectionId,
          isPrivate: false,
        })

        if (forms.length === 0) {
          setParseError('No valid stems and questions were detected. Please check the formatting.')
          wizard.setStems([])
          return { ok: false }
        }

        const drafts = wizard.setStems(forms)
        setParseError(null)
        return { ok: true, drafts }
      } catch (error) {
        setParseError(
          error instanceof Error
            ? `Failed to parse Quantitative Reasoning: ${error.message}`
            : 'Failed to parse Quantitative Reasoning.'
        )
        wizard.setStems([])
        return { ok: false }
      }
    }
    if (isSituationalJudgementSection) {
      try {
        const parsed = parseSituationalJudgementFromDoc(pastedContent, parsingOptions)
        const forms = mapParsedSituationalJudgementToFormValues(parsed, {
          sectionId,
          isPrivate: false,
          getCategoryIdForStem: (stem) => {
            const name = getSituationalJudgementStemCategoryName(stem)
            if (!name) return null
            const category = categories.find(
              (c) => (c.ucat_section_id ?? null) === sectionId && (c.name ?? '').trim() === name
            )
            return category?.id ?? null
          },
        })

        if (forms.length === 0) {
          setParseError('No valid stems and questions were detected. Please check the formatting.')
          wizard.setStems([])
          return { ok: false }
        }

        const drafts = wizard.setStems(forms)
        setParseError(null)
        return { ok: true, drafts }
      } catch (error) {
        setParseError(
          error instanceof Error
            ? `Failed to parse Situational Judgement: ${error.message}`
            : 'Failed to parse Situational Judgement.'
        )
        wizard.setStems([])
        return { ok: false }
      }
    }
    return { ok: false }
  }

  function getStepTitle(currentStep: number): string {
    switch (currentStep) {
      case 0:
        return 'Choose section'
      case 1:
        return 'Paste questions & answers'
      case 2:
        return 'Review'
      case 3:
        return 'Create set'
      default:
        return 'Bulk import'
    }
  }

  function applyParsedAnswersToStems(
    includeExplanations: boolean,
    stemDraftsOverride?: BulkImportStemDraft[]
  ): void {
    const stems = stemDraftsOverride ?? wizard.state.stems
    const flat: { stemId: string; questionIndex: number }[] = []
    stems.forEach((stem) => {
      const questions = stem.values.questions ?? []
      questions.forEach((_, qIdx) => flat.push({ stemId: stem.id, questionIndex: qIdx }))
    })
    if (flat.length === 0) return

    const updatesByStem = new Map<string, UcatQuestionStemFormValues>()

    if (isDecisionMakingSection) {
      const questionTypes = flat.map(({ stemId, questionIndex }) => {
        const stem = stems.find((s) => s.id === stemId)
        const q = stem?.values.questions?.[questionIndex] as { questionType?: string } | undefined
        return (q?.questionType === 'syllogism' ? 'syllogism' : 'multiple_choice') as
          | 'syllogism'
          | 'multiple_choice'
      })
      const pastedAnswersPlain = answerDocToPlainTsv(pastedAnswersJson)
      const dmParsed = parseDecisionMakingAnswers(pastedAnswersPlain, questionTypes)
      dmParsed.forEach((answer, i) => {
        if (i >= flat.length) return
        const { stemId, questionIndex } = flat[i]
        const stem = stems.find((s) => s.id === stemId)
        if (!stem) return
        let nextValues = updatesByStem.get(stemId)
        if (!nextValues) nextValues = { ...stem.values, questions: [...(stem.values.questions ?? [])] }
        const questions = [...(nextValues.questions ?? [])]
        const q = questions[questionIndex]
        if (!q || !q.options) return
        const qWithPattern = q as typeof q & { syllogismAnswerPattern?: string | null }
        if (answer.pattern && qWithPattern.questionType === 'syllogism') {
          const pattern = answer.pattern
          const options = (q.options ?? []).map((opt, j) => ({
            ...opt,
            // For syllogisms, treat 'Y' as "Yes" (isAnswer = true), anything else as "No".
            isAnswer: pattern.charAt(j).toUpperCase() === 'Y',
            answerExplanation:
              includeExplanations &&
              answer.optionExplanations?.[j]?.trim() &&
              answer.optionExplanations?.[j]
                ? (plainTextToProseMirror(answer.optionExplanations[j]!) as Json)
                : includeExplanations
                  ? opt.answerExplanation ?? null
                  : null,
          }))
          questions[questionIndex] = { ...q, syllogismAnswerPattern: pattern, options }
        } else if (answer.letter) {
          const optionIndex = letterToOptionIndex(answer.letter)
          const options = q.options.map((opt, j) => ({
            ...opt,
            isAnswer: j === optionIndex,
          }))
          const explanationText = includeExplanations ? (answer.explanation?.trim() ?? '') : ''
          questions[questionIndex] = {
            ...q,
            options,
            // For non-syllogism DM, treat explanation like VR: question-level explanation.
            answerExplanation: explanationText
              ? (plainTextToProseMirror(explanationText) as Json)
              : includeExplanations
                ? (q.answerExplanation ?? null)
                : null,
          }
        }
        nextValues = { ...nextValues, questions }
        updatesByStem.set(stemId, nextValues)
      })
    } else {
      const parsed = parseAnswersTable(answerDocToPlainTsv(pastedAnswersJson))
      if (parsed.length === 0) return
      parsed.forEach((row, i) => {
        if (i >= flat.length) return
        const { stemId, questionIndex } = flat[i]
        const stem = stems.find((s) => s.id === stemId)
        if (!stem) return
        let nextValues = updatesByStem.get(stemId)
        if (!nextValues) nextValues = { ...stem.values, questions: [...(stem.values.questions ?? [])] }
        const questions = [...(nextValues.questions ?? [])]
        const q = questions[questionIndex]
        if (!q || !q.options) return
        const optionIndex = letterToOptionIndex(row.letter)
        const options = q.options.map((opt, j) => ({
          ...opt,
          isAnswer: j === optionIndex,
        }))
        const explanationBody =
          includeExplanations && row.explanation.trim() ? row.explanation.trim() : ''
        questions[questionIndex] = {
          ...q,
          options,
          answerExplanation: explanationBody
            ? (plainTextToProseMirror(explanationBody) as Json)
            : includeExplanations
              ? (q.answerExplanation ?? null)
              : null,
        }
        nextValues = { ...nextValues, questions }
        updatesByStem.set(stemId, nextValues)
      })
    }

    updatesByStem.forEach((values, stemId) => wizard.updateStemForm(stemId, values))
  }

  function handleNextClick() {
    if (!canGoNext) return
    if (step === 1) {
      const parseResult = parseForCurrentSection()
      if (!parseResult.ok) return
      applyParsedAnswersToStems(includeAnswerExplanationsOnImport, parseResult.drafts)
    }
    setStep((current) => (current < totalStepsResolved - 1 ? current + 1 : current))
  }

  async function handleImportAllVerbalReasoning() {
    if (!sectionId) return
    if (wizard.state.stems.length === 0) {
      setParseError('No parsed stems available to import.')
      return
    }
    if (addToSetEnabled && !addToSetConfig) {
      setParseError('Please select a set or create a new one.')
      return
    }
    if (
      addToSetEnabled &&
      addToSetConfig?.mode === 'create' &&
      !addToSetConfig.name.trim()
    ) {
      setParseError('Please enter a name for the new set.')
      return
    }
    if (
      addToSetEnabled &&
      addToSetConfig?.mode === 'create' &&
      addToSetConfig.isTimed &&
      (addToSetConfig.timeLimitSeconds == null || addToSetConfig.timeLimitSeconds <= 0)
    ) {
      setParseError('Please enter a time limit greater than 0 for timed sets.')
      return
    }

    try {
      setStatus('submitting')
      setSubmitError(null)
      const stemsToSubmit: UcatQuestionStemFormValues[] = wizard.state.stems.map(
        (stem: BulkImportStemDraft) => stem.values
      )
      await onSubmit({
        sectionId,
        stems: stemsToSubmit,
        addToSet: addToSetEnabled ? addToSetConfig : null,
      })
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to import question stems'
      )
    }
  }

  function renderBody() {
    if (status === 'success') {
      return (
        <div className="py-12 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 mx-auto flex items-center justify-center">
            <svg
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <div className="text-lg font-semibold">Bulk import completed</div>
          <div className="text-sm text-muted-foreground">
            All question stems have been created successfully.
          </div>
        </div>
      )
    }

    if (hasErrorMeta) {
      return (
        <div className="py-12 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mx-auto flex items-center justify-center">
            <svg
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <div className="text-lg font-semibold">Failed to load UCAT metadata</div>
          <div className="text-sm text-muted-foreground">
            There was a problem loading sections, categories, or tags. Please close and try again.
          </div>
        </div>
      )
    }

    if (isLoadingMeta) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading UCAT sections and tags…</div>
        </div>
      )
    }

    if (step === 0) {
      return (
        <Step1ChooseSection
          sectionId={sectionId}
          sections={sections}
          onChangeSection={setSectionId}
        />
      )
    }

    if (step === 1) {
      return (
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-0">
            <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden md:pr-4">
              <Step2PasteDocument
                layout="split"
                value={pastedContent}
                onChange={(value) => {
                  setPastedContent(value)
                  setParseError(null)
                }}
                onImageFileIdsChange={handleStep2ImageFileIds}
                parsingOptions={parsingOptions}
                onParsingOptionsChange={setParsingOptions}
                pasteTableBehavior={pasteTableBehavior}
                onPasteTableBehaviorChange={setPasteTableBehavior}
                liveParseSection={resolvedBulkImportSection}
              />
            </div>
            <div
              className="hidden shrink-0 self-stretch md:block md:w-px md:bg-border"
              aria-hidden
            />
            <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden border-t pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-4">
              <Step2PasteAnswers
                layout="split"
                value={pastedAnswersJson}
                onChange={setPastedAnswersJson}
                includeExplanationsOnImport={includeAnswerExplanationsOnImport}
                onIncludeExplanationsOnImportChange={setIncludeAnswerExplanationsOnImport}
              />
            </div>
          </div>
          {parseError && (
            <div className="shrink-0 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {parseError}
            </div>
          )}
        </div>
      )
    }

    if (step === 2) {
      return (
        <Step3SetAnswers
          stems={wizard.state.stems}
          categories={categories}
          onUpdateStem={wizard.updateStemForm}
        />
      )
    }

    if (step === 3) {
      return (
        <Step4CreateSet
          addToSetEnabled={addToSetEnabled}
          onAddToSetEnabledChange={setAddToSetEnabled}
          addToSetConfig={addToSetConfig}
          onAddToSetConfigChange={setAddToSetConfig}
          onEditSet={onEditSet}
        />
      )
    }

    return null
  }

  const description =
    status === 'success'
      ? 'Review completion details for this import.'
      : `Step ${step + 1} of ${totalStepsResolved}: ${getStepTitle(step)}`

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? handleRequestClose() : undefined)}>
      <DialogContent
        className={cn(
          'w-full md:max-w-5xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b bg-background">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRequestClose}
                  className="shrink-0"
                  disabled={status === 'submitting'}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Bulk import UCAT question stems</DialogTitle>
                  <DialogDescription>{description}</DialogDescription>
                </div>
              </div>
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
          </DialogHeader>

          {/* Progress Indicator */}
          {status !== 'success' && (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2">
                {Array.from({ length: totalStepsResolved }).map((_, index) => (
                  <div
                    key={index}
                    className={`flex-1 h-2 rounded-full transition-colors ${
                      index < step
                        ? 'bg-primary'
                        : index === step
                          ? 'bg-primary/50'
                          : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {step === 1 && status !== 'success' && !isLoadingMeta && !hasErrorMeta ? (
            <div className="flex h-full min-h-0 flex-col px-6 py-6">
              <div className="min-h-0 flex-1 overflow-hidden">{renderBody()}</div>
              {status === 'error' && submitError && (
                <div className="mt-4 shrink-0 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {submitError}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="p-6">
                {renderBody()}
                {status === 'error' && submitError && (
                  <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {submitError}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-4 border-t bg-background">
          <>
            <Button
              variant="outline"
              onClick={() => canGoPrevious && setStep((current) => Math.max(0, current - 1))}
              disabled={!canGoPrevious}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {status === 'success' ? (
              <Button onClick={handleRequestClose}>Close</Button>
            ) : step < totalStepsResolved - 1 ? (
              <Button onClick={handleNextClick} disabled={!canGoNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : isBulkParseSection ? (
              <Button
                onClick={handleImportAllVerbalReasoning}
                disabled={
                  status === 'submitting' ||
                  wizard.state.stems.length === 0 ||
                  (addToSetEnabled && !addToSetConfig) ||
                  (addToSetEnabled &&
                    addToSetConfig?.mode === 'create' &&
                    !addToSetConfig.name.trim()) ||
                  (addToSetEnabled &&
                    addToSetConfig?.mode === 'create' &&
                    addToSetConfig.isTimed &&
                    (addToSetConfig.timeLimitSeconds == null ||
                      addToSetConfig.timeLimitSeconds <= 0))
                }
              >
                Import all stems
              </Button>
            ) : (
              <Button onClick={handleRequestClose}>Close</Button>
            )}
          </>
        </div>
      </DialogContent>
    </Dialog>
  )
}

