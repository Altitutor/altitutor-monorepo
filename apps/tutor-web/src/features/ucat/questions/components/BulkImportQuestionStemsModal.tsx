'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  isToastInteraction,
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
import { inferParsingIndicators } from '@/features/ucat/questions/components/bulk-import/bulkImportParsingIndicatorHints'
import { inferBulkImportCategoryIdForFormValues } from '@/features/ucat/questions/components/bulk-import/bulkImportMetadataInference'
import { collectLogicalLinesFromDoc } from '@/features/ucat/questions/lib/parsers/core'
import { hasRichTextContent } from '@/features/ucat/shared/lib/rich-text'
import { Step1ChooseSection } from '@/features/ucat/questions/components/bulk-import/Step1ChooseSection'
import {
  readBulkImportTutorSourceNoteDraft,
  writeBulkImportTutorSourceNoteDraft,
} from '@/features/ucat/questions/components/bulk-import/bulkImportTutorSourceNoteDraft'
import {
  Step2PasteDocument,
  type ParsingOptions,
  type PasteTableBehavior,
} from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'
import { BulkImportReadinessReview } from '@/features/ucat/questions/components/bulk-import/BulkImportReadinessReview'
import {
  Step4CreateSet,
  type AddToSetConfig,
} from '@/features/ucat/questions/components/bulk-import/Step4CreateSet'
import { StepPasteStems } from '@/features/ucat/questions/components/bulk-import/StepPasteStems'
import {
  StepPerStemQuestions,
  type PerStemQuestionPasteMode,
} from '@/features/ucat/questions/components/bulk-import/StepPerStemQuestions'
import {
  StepAnswers,
  DEFAULT_ANSWER_PARSING_OPTIONS,
  type AnswerParsingOptions,
  answerParsingOptionsToParseOptions,
} from '@/features/ucat/questions/components/bulk-import/StepAnswers'
import { BulkImportConfirmDialog } from '@/features/ucat/questions/components/bulk-import/BulkImportConfirmDialog'
import {
  getBulkImportStepKind,
  getBulkImportStepTitle,
  getBulkImportTotalSteps,
  isBulkImportFullHeightPasteStep,
} from '@/features/ucat/questions/components/bulk-import/bulkImportWizardSteps'
import {
  applySyllogismManualEntryTargets,
  collectSyllogismManualEntryTargets,
  syllogismManualEntryIsComplete,
  type SyllogismManualEntryTarget,
} from '@/features/ucat/questions/components/bulk-import/bulkImportSyllogismManual'
import { StepSyllogismManualEntry } from '@/features/ucat/questions/components/bulk-import/StepSyllogismManualEntry'
import {
  buildFormValuesFromSeparateStemDocuments,
  parseCombinedDocumentResultForSectionWithOcr,
  parseQuestionsOnlyForSection,
  mapParsedStemsToFormValues,
  splitStemDocumentFromDoc,
} from '@/features/ucat/questions/components/bulk-import/bulkImportParseSection'
import {
  DEFAULT_STEM_SPLIT_OPTIONS,
  splitQuestionDocumentFromDoc,
  type StemSplitOptions,
} from '@/features/ucat/questions/lib/parsers/splitStemDocument'
import {
  applyBulkAnswersToStems,
  validateBulkAnswersDocument,
} from '@/features/ucat/questions/components/bulk-import/bulkImportBulkAnswers'
import { filterTagsForImportSection } from '@/features/ucat/shared/lib/taxonomy-reparent'
import { mapCategoriesToOptions, mapTagsToOptions } from '@/features/ucat/shared/lib/taxonomy-paths'
import {
  StepStemCategories,
  everyStemHasCategory,
  type BulkImportCategoryOption,
} from '@/features/ucat/questions/components/bulk-import/StepStemCategories'
import {
  StepQuestionTags,
  type BulkImportTagOption,
} from '@/features/ucat/questions/components/bulk-import/StepQuestionTags'
import { UcatRichTextToolbar } from '@/features/ucat/shared/components/UcatRichTextToolbar'
import { BulkImportFormattingWarnings } from '@/features/ucat/questions/components/bulk-import/BulkImportFormattingWarnings'
import { lintBulkImportFormatting } from '@/features/ucat/questions/components/bulk-import/bulkImportFormattingLint'
import { runBulkImportDeterministicReview } from '@/features/ucat/questions/components/bulk-import/bulkImportDeterministicReview'
import { useBulkImportDecisions } from '@/features/ucat/questions/hooks/useBulkImportDecisions'
import { useBulkImportDuplicateAnalysis } from '@/features/ucat/questions/hooks/useBulkImportDuplicateAnalysis'

export type BulkImportSubmitArgs = {
  sectionId: string
  stems: Array<BulkImportStemDraft & { importStatus: 'draft' | 'in_review' }>
  tutorSourceNote: string | null
  addToSet: AddToSetConfig | null
}

type BulkImportQuestionStemsModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (args: BulkImportSubmitArgs) => Promise<void>
  onEditSet?: (setId: string) => void
}

type PendingConfirm =
  | { type: 'toggle_separate_stem'; nextValue: boolean }
  | { type: 'back_to_stems' }
  | { type: 'close_modal' }
  | null

export function BulkImportQuestionStemsModal({
  open,
  onClose,
  onSubmit,
  onEditSet,
}: BulkImportQuestionStemsModalProps) {
  const wizard = useBulkImportWizard()

  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()

  const [step, setStep] = useState(0)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [tutorSourceNote, setTutorSourceNote] = useState('')
  const [separateStemDocument, setSeparateStemDocument] = useState(false)
  const [pastedContent, setPastedContent] = useState<Json | null>(null)
  const [stemSplitOptions, setStemSplitOptions] = useState<StemSplitOptions>(
    DEFAULT_STEM_SPLIT_OPTIONS
  )
  const [questionSplitOptions, setQuestionSplitOptions] = useState<StemSplitOptions>(
    DEFAULT_STEM_SPLIT_OPTIONS
  )
  const [pastedStemDoc, setPastedStemDoc] = useState<Json | null>(null)
  const [parsedStemTexts, setParsedStemTexts] = useState<string[]>([])
  const [perStemQuestionDocs, setPerStemQuestionDocs] = useState<Array<Json | null>>([])
  const [perStemQuestionPasteMode, setPerStemQuestionPasteMode] =
    useState<PerStemQuestionPasteMode>('separate')
  const [pastedAllQuestionsDoc, setPastedAllQuestionsDoc] = useState<Json | null>(null)
  const [pastedAnswersJson, setPastedAnswersJson] = useState<Json | null>(null)
  const [answerParsingOptions, setAnswerParsingOptions] = useState<AnswerParsingOptions>(
    DEFAULT_ANSWER_PARSING_OPTIONS
  )
  const [pasteTableBehavior, setPasteTableBehavior] = useState<PasteTableBehavior>('keep')
  const [addToSetEnabled, setAddToSetEnabled] = useState(false)
  const [addToSetConfig, setAddToSetConfig] = useState<AddToSetConfig | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [parsingOptions, setParsingOptions] = useState<ParsingOptions>({
    questionIndicator: 'dot',
    answerOptionIndicator: 'dot',
    questionNumberOnOwnLine: false,
    answerOptionOnOwnLine: false,
    requireConsecutiveQuestionNumbers: true,
    decisionMakingQuestionNumberPlacement: 'question',
    quantitativeReasoningQuestionNumberPlacement: 'question',
  })
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null)
  const [syllogismManualTargets, setSyllogismManualTargets] = useState<
    SyllogismManualEntryTarget[]
  >([])
  const [syllogismManualStepIncluded, setSyllogismManualStepIncluded] = useState(false)
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)
  const step2NewImageFileIdsRef = useRef<Set<string>>(new Set())
  /** Blocks parent Dialog close while a nested confirm is opening/open (Radix races onOpenChange). */
  const suppressDialogCloseRef = useRef(false)
  /** Once true, skip further auto-detect (initial paste done or tutor edited settings). */
  const indicatorsLockedRef = useRef(false)
  const questionSplitOptionsTouchedRef = useRef(false)

  function queueConfirm(confirm: PendingConfirm) {
    suppressDialogCloseRef.current = true
    setPendingConfirm(confirm)
  }

  function clearPendingConfirm() {
    setPendingConfirm(null)
    // Defer so Radix does not treat the alert dismiss as an outside click on the parent dialog.
    window.setTimeout(() => {
      suppressDialogCloseRef.current = false
    }, 0)
  }

  const handleTutorSourceNoteChange = useCallback((value: string) => {
    setTutorSourceNote(value)
    writeBulkImportTutorSourceNoteDraft(value)
  }, [])

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categoryOptions = useMemo(
    () => mapCategoriesToOptions(categoriesQuery.data ?? []),
    [categoriesQuery.data]
  )
  const categories = categoriesQuery.data ?? []
  const tagOptions = useMemo(() => mapTagsToOptions(tagsQuery.data ?? []), [tagsQuery.data])
  const selectableTagOptions = useMemo(
    () =>
      mapTagsToOptions(
        filterTagsForImportSection(tagsQuery.data ?? [], sectionId)
      ) as BulkImportTagOption[],
    [tagsQuery.data, sectionId]
  )

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === sectionId) ?? null,
    [sections, sectionId]
  )

  const resolvedBulkImportSection = useMemo(
    () => bulkImportSectionFromUcatName(selectedSection?.name),
    [selectedSection?.name]
  )

  const inferMissingCategoryId = useCallback(
    (values: UcatQuestionStemFormValues) => {
      if (!resolvedBulkImportSection || !sectionId) return null
      return inferBulkImportCategoryIdForFormValues({
        values,
        section: resolvedBulkImportSection,
        sectionId,
        categories: categoryOptions,
      })
    },
    [categoryOptions, resolvedBulkImportSection, sectionId]
  )

  const isDecisionMakingSection = resolvedBulkImportSection === 'decision_making'
  const isBulkParseSection = resolvedBulkImportSection != null

  const includeSyllogismManualStep =
    isDecisionMakingSection && (syllogismManualStepIncluded || syllogismManualTargets.length > 0)

  const totalStepsResolved = getBulkImportTotalSteps(
    separateStemDocument,
    includeSyllogismManualStep
  )
  const stepKind = getBulkImportStepKind(step, separateStemDocument, includeSyllogismManualStep)
  const readinessByStemId = useMemo(
    () =>
      Object.fromEntries(
        wizard.state.stems.map((stem) => {
          const review = runBulkImportDeterministicReview({
            values: stem.values,
            sectionName: sections.find((section) => section.id === stem.values.sectionId)?.name,
            categoryName: categoryOptions.find((category) => category.id === stem.values.categoryId)
              ?.name,
          })
          return [stem.id, { ...review, stemId: stem.id }]
        })
      ),
    [categoryOptions, sections, wizard.state.stems]
  )
  const importEligibilityByStemId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(readinessByStemId).map(([id, review]) => [
          id,
          { eligibleForInReview: !review.hasHardFailures },
        ])
      ),
    [readinessByStemId]
  )
  const duplicateAnalysis = useBulkImportDuplicateAnalysis(
    wizard.state.stems,
    stepKind === 'review'
  )
  const importDecisions = useBulkImportDecisions({
    stems: wizard.state.stems,
    readinessByStemId: importEligibilityByStemId,
    defaultExcludedStemIds: duplicateAnalysis.duplicateStemIds,
  })

  const wipeDownstreamFromStems = useCallback(() => {
    setParsedStemTexts([])
    setPerStemQuestionDocs([])
    setPerStemQuestionPasteMode('separate')
    setPastedAllQuestionsDoc(null)
    setQuestionSplitOptions(DEFAULT_STEM_SPLIT_OPTIONS)
    questionSplitOptionsTouchedRef.current = false
    setPastedAnswersJson(null)
    setSyllogismManualTargets([])
    setSyllogismManualStepIncluded(false)
    importDecisions.reset()
    duplicateAnalysis.reset()
    wizard.reset()
  }, [duplicateAnalysis, importDecisions, wizard])

  const wipeDownstreamFull = useCallback(() => {
    setPastedContent(null)
    setPastedStemDoc(null)
    indicatorsLockedRef.current = false
    wipeDownstreamFromStems()
  }, [wipeDownstreamFromStems])

  const handleParsingOptionsChange = useCallback((options: ParsingOptions) => {
    indicatorsLockedRef.current = true
    setParsingOptions(options)
  }, [])

  const maybeAutoDetectParsingIndicators = useCallback((doc: Json | null | undefined) => {
    if (indicatorsLockedRef.current) return
    if (!hasRichTextContent(doc)) return
    const lines = collectLogicalLinesFromDoc(doc, {
      detectNestedQuestionTables: true,
    })
    const inferred = inferParsingIndicators(lines)
    if (!inferred.questionIndicator && !inferred.answerOptionIndicator) return
    indicatorsLockedRef.current = true
    setParsingOptions((prev) => ({
      ...prev,
      ...(inferred.questionIndicator ? { questionIndicator: inferred.questionIndicator } : {}),
      ...(inferred.answerOptionIndicator
        ? { answerOptionIndicator: inferred.answerOptionIndicator }
        : {}),
    }))
  }, [])

  useEffect(() => {
    if (open) {
      setExpanded(true)
      setTutorSourceNote(readBulkImportTutorSourceNoteDraft())
      return
    }
    setStep(0)
    setStatus('idle')
    setSubmitError(null)
    setParseError(null)
    setIsParsing(false)
    setSectionId(null)
    setSeparateStemDocument(false)
    setPastedContent(null)
    setStemSplitOptions(DEFAULT_STEM_SPLIT_OPTIONS)
    setQuestionSplitOptions(DEFAULT_STEM_SPLIT_OPTIONS)
    setPastedStemDoc(null)
    setParsedStemTexts([])
    setPerStemQuestionDocs([])
    setPerStemQuestionPasteMode('separate')
    setPastedAllQuestionsDoc(null)
    setPastedAnswersJson(null)
    setAnswerParsingOptions(DEFAULT_ANSWER_PARSING_OPTIONS)
    setPasteTableBehavior('keep')
    setAddToSetEnabled(false)
    setAddToSetConfig(null)
    setParsingOptions({
      questionIndicator: 'dot',
      answerOptionIndicator: 'dot',
      questionNumberOnOwnLine: false,
      answerOptionOnOwnLine: false,
      requireConsecutiveQuestionNumbers: true,
      decisionMakingQuestionNumberPlacement: 'question',
      quantitativeReasoningQuestionNumberPlacement: 'question',
    })
    indicatorsLockedRef.current = false
    questionSplitOptionsTouchedRef.current = false
    suppressDialogCloseRef.current = false
    setPendingConfirm(null)
    setSyllogismManualTargets([])
    setSyllogismManualStepIncluded(false)
    setActiveTextEditor(null)
    step2NewImageFileIdsRef.current = new Set()
    importDecisions.reset()
    duplicateAnalysis.reset()
    wizard.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal closes
  }, [open])

  useEffect(() => {
    if (stepKind !== 'review') {
      setActiveTextEditor(null)
    }
  }, [stepKind])

  const handleStep2ImageFileIds = useCallback((fileIds: string[]) => {
    fileIds.forEach((id) => step2NewImageFileIdsRef.current.add(id))
  }, [])

  const hasDownstreamPasteWork = useMemo(
    () =>
      parsedStemTexts.length > 0 ||
      perStemQuestionDocs.some((d) => d != null) ||
      pastedAllQuestionsDoc != null ||
      pastedContent != null ||
      pastedStemDoc != null ||
      wizard.state.stems.length > 0 ||
      pastedAnswersJson != null,
    [
      parsedStemTexts.length,
      perStemQuestionDocs,
      pastedAllQuestionsDoc,
      pastedContent,
      pastedStemDoc,
      wizard.state.stems.length,
      pastedAnswersJson,
    ]
  )

  const hasUnsavedBulkImportWork = useMemo(() => {
    if (status === 'success') return false
    return (
      step > 0 ||
      sectionId != null ||
      tutorSourceNote.trim().length > 0 ||
      separateStemDocument ||
      addToSetEnabled ||
      hasDownstreamPasteWork
    )
  }, [
    status,
    step,
    sectionId,
    tutorSourceNote,
    separateStemDocument,
    addToSetEnabled,
    hasDownstreamPasteWork,
  ])

  const splitAllQuestionsDocument = useMemo(
    () => splitQuestionDocumentFromDoc(pastedAllQuestionsDoc, questionSplitOptions),
    [pastedAllQuestionsDoc, questionSplitOptions]
  )
  const effectivePerStemQuestionDocs =
    perStemQuestionPasteMode === 'single_document'
      ? splitAllQuestionsDocument.documents
      : perStemQuestionDocs

  const allPerStemQuestionsParsed = useMemo(() => {
    if (!resolvedBulkImportSection || parsedStemTexts.length === 0) return false
    if (
      perStemQuestionPasteMode === 'single_document' &&
      effectivePerStemQuestionDocs.length !== parsedStemTexts.length
    ) {
      return false
    }
    return parsedStemTexts.every((_, index) => {
      const { questions } = parseQuestionsOnlyForSection(
        effectivePerStemQuestionDocs[index],
        resolvedBulkImportSection,
        parsingOptions
      )
      return questions.length > 0
    })
  }, [
    parsedStemTexts,
    effectivePerStemQuestionDocs,
    resolvedBulkImportSection,
    parsingOptions,
    perStemQuestionPasteMode,
  ])

  const canGoPrevious = step > 0 && status !== 'submitting' && !isParsing

  const answerParseOptions = useMemo(
    () => answerParsingOptionsToParseOptions(answerParsingOptions),
    [answerParsingOptions]
  )

  const formattingSourceDocuments = useMemo(() => {
    if (separateStemDocument) {
      return [
        { label: 'Pasted stem document', value: pastedStemDoc },
        ...(perStemQuestionPasteMode === 'single_document'
          ? [
              {
                label: 'Pasted questions document',
                value: pastedAllQuestionsDoc,
              },
            ]
          : perStemQuestionDocs.map((value, index) => ({
              label: `Pasted questions for stem ${index + 1}`,
              value,
            }))),
        {
          label: 'Pasted answers document',
          value: pastedAnswersJson,
          compareTableCount: false,
        },
      ]
    }
    return [
      { label: 'Pasted questions document', value: pastedContent },
      {
        label: 'Pasted answers document',
        value: pastedAnswersJson,
        compareTableCount: false,
      },
    ]
  }, [
    separateStemDocument,
    pastedStemDoc,
    perStemQuestionDocs,
    perStemQuestionPasteMode,
    pastedAllQuestionsDoc,
    pastedAnswersJson,
    pastedContent,
  ])

  const formattingIssues = useMemo(
    () =>
      lintBulkImportFormatting({
        sourceDocuments: formattingSourceDocuments,
        stems: wizard.state.stems.map((stem) => stem.values),
        compareParsedOutput: wizard.state.stems.length > 0,
      }),
    [formattingSourceDocuments, wizard.state.stems]
  )

  const canGoNext = useMemo(() => {
    if (status === 'submitting' || isParsing) return false
    if (stepKind === 'section') return !!sectionId
    if (stepKind === 'paste_stems') {
      const split = splitStemDocumentFromDoc(pastedStemDoc, stemSplitOptions)
      return split.stems.length > 0
    }
    if (stepKind === 'per_stem_questions') return allPerStemQuestionsParsed
    if (stepKind === 'paste_document') return true
    if (stepKind === 'syllogism_manual')
      return syllogismManualEntryIsComplete(syllogismManualTargets)
    if (stepKind === 'answers') {
      if (wizard.state.stems.length === 0) return false
      const validation = validateBulkAnswersDocument(
        pastedAnswersJson,
        wizard.state.stems,
        isDecisionMakingSection,
        answerParseOptions
      )
      return validation.ok
    }
    if (stepKind === 'stem_categories') return everyStemHasCategory(wizard.state.stems)
    if (stepKind === 'question_tags') return wizard.state.stems.length > 0
    if (step >= totalStepsResolved - 1) return false
    return true
  }, [
    status,
    isParsing,
    stepKind,
    sectionId,
    pastedStemDoc,
    stemSplitOptions,
    allPerStemQuestionsParsed,
    syllogismManualTargets,
    wizard.state.stems,
    pastedAnswersJson,
    isDecisionMakingSection,
    answerParseOptions,
    step,
    totalStepsResolved,
  ])

  const isLoadingMeta = sectionsQuery.isLoading || categoriesQuery.isLoading || tagsQuery.isLoading
  const hasErrorMeta = sectionsQuery.isError || categoriesQuery.isError || tagsQuery.isError

  function performClose() {
    if (status === 'submitting' || isParsing) return
    const ids = Array.from(step2NewImageFileIdsRef.current)
    if (ids.length > 0 && status !== 'success') {
      void fetch('/api/ucat/images/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ids }),
      }).catch((error) => {
        console.error('Failed to cleanup UCAT images from bulk import:', error)
      })
    }
    onClose()
  }

  function handleRequestClose() {
    if (status === 'submitting' || isParsing) return
    if (suppressDialogCloseRef.current || pendingConfirm != null) return
    if (hasUnsavedBulkImportWork) {
      queueConfirm({ type: 'close_modal' })
      return
    }
    performClose()
  }

  function handleDismissAttempt(event: Event) {
    if (isToastInteraction(event)) {
      event.preventDefault()
      return
    }
    if (suppressDialogCloseRef.current || pendingConfirm != null) {
      event.preventDefault()
      return
    }
    if (status === 'submitting' || isParsing) {
      event.preventDefault()
      return
    }
    if (hasUnsavedBulkImportWork) {
      event.preventDefault()
      queueConfirm({ type: 'close_modal' })
    }
  }

  async function parseCombinedDocument(): Promise<
    { ok: true; drafts: BulkImportStemDraft[] } | { ok: false }
  > {
    if (!sectionId || !resolvedBulkImportSection) return { ok: false }
    try {
      const { parsed, ocr } = await parseCombinedDocumentResultForSectionWithOcr(
        pastedContent,
        resolvedBulkImportSection,
        parsingOptions
      )
      const forms = mapParsedStemsToFormValues(
        parsed,
        resolvedBulkImportSection,
        sectionId,
        categories,
        tagsQuery.data ?? []
      )
      if (forms.length === 0) {
        const ocrMessage =
          ocr != null && ocr.warnings.length > 0 ? ` ${ocr.warnings.join(' ')}` : ''
        setParseError(
          `No valid stems and questions were detected. Please check the formatting.${ocrMessage}`
        )
        importDecisions.reset()
        wizard.setStems([])
        setSyllogismManualTargets([])
        return { ok: false }
      }
      importDecisions.reset()
      const drafts = wizard.setStems(forms)
      const manualTargets = collectSyllogismManualEntryTargets(drafts)
      setSyllogismManualTargets(manualTargets)
      setSyllogismManualStepIncluded(manualTargets.length > 0)
      if (manualTargets.length > 0) {
        setParseError(
          `OCR could not read ${manualTargets.length} syllogism image(s). Enter the statements on the next step to continue.`
        )
      } else if (ocr != null && ocr.warnings.length > 0) {
        setParseError(ocr.warnings.join(' '))
      } else {
        setParseError(null)
      }
      return { ok: true, drafts }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse the pasted document.')
      importDecisions.reset()
      wizard.setStems([])
      return { ok: false }
    }
  }

  function buildStemsFromSeparateFlow():
    | { ok: true; drafts: BulkImportStemDraft[] }
    | { ok: false } {
    if (!sectionId || !resolvedBulkImportSection) return { ok: false }
    try {
      const forms = buildFormValuesFromSeparateStemDocuments(
        parsedStemTexts,
        effectivePerStemQuestionDocs,
        resolvedBulkImportSection,
        sectionId,
        parsingOptions,
        categories,
        tagsQuery.data ?? []
      )
      if (forms.length === 0) {
        setParseError('No valid stems and questions were detected.')
        importDecisions.reset()
        wizard.setStems([])
        return { ok: false }
      }
      importDecisions.reset()
      const drafts = wizard.setStems(forms)
      setParseError(null)
      return { ok: true, drafts }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse per-stem questions.')
      importDecisions.reset()
      wizard.setStems([])
      return { ok: false }
    }
  }

  async function handleNextClick() {
    if (!canGoNext) return

    if (stepKind === 'paste_document') {
      setIsParsing(true)
      try {
        const result = await parseCombinedDocument()
        if (!result.ok) return
      } finally {
        setIsParsing(false)
      }
    }

    if (stepKind === 'paste_stems') {
      const split = splitStemDocumentFromDoc(pastedStemDoc, stemSplitOptions)
      if (split.stems.length === 0) {
        setParseError('No stems detected. Adjust split settings or paste content.')
        return
      }
      setParsedStemTexts(split.stems)
      setPerStemQuestionDocs(split.stems.map(() => null))
      if (!questionSplitOptionsTouchedRef.current) {
        setQuestionSplitOptions(stemSplitOptions)
      }
      setParseError(null)
    }

    if (stepKind === 'per_stem_questions') {
      const result = buildStemsFromSeparateFlow()
      if (!result.ok) return
    }

    if (stepKind === 'syllogism_manual') {
      const updatedValues = applySyllogismManualEntryTargets(
        wizard.state.stems,
        syllogismManualTargets
      )
      updatedValues.forEach((values, index) => {
        const stem = wizard.state.stems[index]
        if (stem) wizard.updateStemForm(stem.id, values)
      })
      setSyllogismManualTargets([])
      setParseError(null)
    }

    if (stepKind === 'answers') {
      const stems = wizard.state.stems
      const validation = validateBulkAnswersDocument(
        pastedAnswersJson,
        stems,
        isDecisionMakingSection,
        answerParseOptions
      )
      if (!validation.ok) {
        setParseError(validation.message)
        return
      }
      applyBulkAnswersToStems(
        pastedAnswersJson,
        stems,
        isDecisionMakingSection,
        wizard.updateStemForm,
        answerParseOptions
      )
      setParseError(null)
    }

    if (stepKind === 'review') setParseError(null)

    setStep((current) => (current < totalStepsResolved - 1 ? current + 1 : current))
  }

  function handlePreviousClick() {
    if (!canGoPrevious) return
    if (stepKind === 'per_stem_questions') {
      queueConfirm({ type: 'back_to_stems' })
      return
    }
    setStep((current) => Math.max(0, current - 1))
  }

  function handleSeparateStemDocumentChange(nextValue: boolean) {
    if (nextValue === separateStemDocument) return
    if (step > 0 && hasDownstreamPasteWork) {
      queueConfirm({ type: 'toggle_separate_stem', nextValue })
      return
    }
    setSeparateStemDocument(nextValue)
    if (step > 0) {
      setStep(0)
      wipeDownstreamFull()
    }
  }

  function resolvePendingConfirm() {
    if (!pendingConfirm) return
    if (pendingConfirm.type === 'toggle_separate_stem') {
      setSeparateStemDocument(pendingConfirm.nextValue)
      setStep(0)
      wipeDownstreamFull()
    }
    if (pendingConfirm.type === 'back_to_stems') {
      wipeDownstreamFromStems()
      setStep((s) => Math.max(0, s - 1))
    }
    if (pendingConfirm.type === 'close_modal') {
      clearPendingConfirm()
      performClose()
      return
    }
    clearPendingConfirm()
  }

  async function handleImportAll() {
    if (!sectionId) return
    if (importDecisions.selectedStems.length === 0) {
      setParseError('No parsed stems available to import.')
      return
    }
    if (addToSetEnabled && !addToSetConfig) {
      setParseError('Please select a set or create a new one.')
      return
    }
    if (
      addToSetEnabled
      && addToSetConfig?.mode === 'create'
      && !addToSetConfig.referenceBlueprintId
    ) {
      setParseError('Please select a reference blueprint for the new set.')
      return
    }
    if (
      addToSetEnabled &&
      addToSetConfig?.mode === 'create' &&
      addToSetConfig.timingMode === 'fixed' &&
      (addToSetConfig.fixedTimeLimitSeconds == null || addToSetConfig.fixedTimeLimitSeconds <= 0)
    ) {
      setParseError('Please enter a time limit greater than 0 for fixed-time sets.')
      return
    }

    try {
      setStatus('submitting')
      setSubmitError(null)
      await onSubmit({
        sectionId,
        stems: importDecisions.selectedStems,
        tutorSourceNote: tutorSourceNote.trim() || null,
        addToSet: addToSetEnabled ? addToSetConfig : null,
      })
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setSubmitError(error instanceof Error ? error.message : 'Failed to import question stems')
    }
  }

  function renderBody() {
    if (status === 'success') {
      return (
        <div className="space-y-4 py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <svg
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-lg font-semibold">Bulk import completed</div>
          <p className="text-sm text-muted-foreground">
            Question stems were imported to their selected destinations.
          </p>
        </div>
      )
    }

    if (hasErrorMeta) {
      return (
        <div className="space-y-4 py-12 text-center">
          <div className="text-lg font-semibold">Failed to load UCAT metadata</div>
          <p className="text-sm text-muted-foreground">
            There was a problem loading sections, categories, or tags. Please close and try again.
          </p>
        </div>
      )
    }

    if (isLoadingMeta) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading UCAT sections and tags…</p>
        </div>
      )
    }

    if (stepKind === 'section') {
      return (
        <Step1ChooseSection
          sectionId={sectionId}
          sections={sections}
          onChangeSection={setSectionId}
          separateStemDocument={separateStemDocument}
          onSeparateStemDocumentChange={handleSeparateStemDocumentChange}
          tutorSourceNote={tutorSourceNote}
          onTutorSourceNoteChange={handleTutorSourceNoteChange}
        />
      )
    }

    if (stepKind === 'paste_stems' && resolvedBulkImportSection) {
      return (
        <StepPasteStems
          value={pastedStemDoc}
          onChange={setPastedStemDoc}
          stemSplitOptions={stemSplitOptions}
          onStemSplitOptionsChange={setStemSplitOptions}
          pasteTableBehavior={pasteTableBehavior}
          onPasteTableBehaviorChange={setPasteTableBehavior}
          onImageFileIdsChange={handleStep2ImageFileIds}
        />
      )
    }

    if (stepKind === 'per_stem_questions' && resolvedBulkImportSection) {
      return (
        <StepPerStemQuestions
          stemTexts={parsedStemTexts}
          perStemDocs={perStemQuestionDocs}
          onPerStemDocChange={(index, doc) => {
            maybeAutoDetectParsingIndicators(doc)
            setPerStemQuestionDocs((prev) => {
              const next = [...prev]
              next[index] = doc
              return next
            })
          }}
          section={resolvedBulkImportSection}
          parsingOptions={parsingOptions}
          onParsingOptionsChange={handleParsingOptionsChange}
          pasteTableBehavior={pasteTableBehavior}
          onPasteTableBehaviorChange={setPasteTableBehavior}
          pasteMode={perStemQuestionPasteMode}
          onPasteModeChange={setPerStemQuestionPasteMode}
          singleDocument={pastedAllQuestionsDoc}
          onSingleDocumentChange={(doc) => {
            maybeAutoDetectParsingIndicators(doc)
            setPastedAllQuestionsDoc(doc)
          }}
          singleDocumentSplit={splitAllQuestionsDocument}
          questionSplitOptions={questionSplitOptions}
          onQuestionSplitOptionsChange={(options) => {
            questionSplitOptionsTouchedRef.current = true
            setQuestionSplitOptions(options)
          }}
          onImageFileIdsChange={handleStep2ImageFileIds}
        />
      )
    }

    if (stepKind === 'paste_document' && resolvedBulkImportSection) {
      return (
        <Step2PasteDocument
          title="Paste document"
          layout="split"
          value={pastedContent}
          onChange={(value) => {
            maybeAutoDetectParsingIndicators(value)
            setPastedContent(value)
            setParseError(null)
            setSyllogismManualTargets([])
            setSyllogismManualStepIncluded(false)
          }}
          onImageFileIdsChange={handleStep2ImageFileIds}
          parsingOptions={parsingOptions}
          onParsingOptionsChange={handleParsingOptionsChange}
          pasteTableBehavior={pasteTableBehavior}
          onPasteTableBehaviorChange={setPasteTableBehavior}
          liveParseSection={resolvedBulkImportSection}
        />
      )
    }

    if (stepKind === 'syllogism_manual') {
      return (
        <StepSyllogismManualEntry
          targets={syllogismManualTargets}
          onTargetsChange={setSyllogismManualTargets}
        />
      )
    }

    if (stepKind === 'answers') {
      return (
        <StepAnswers
          bulkAnswersJson={pastedAnswersJson}
          onBulkAnswersChange={setPastedAnswersJson}
          onImageFileIdsChange={handleStep2ImageFileIds}
          stems={wizard.state.stems}
          isDecisionMakingSection={isDecisionMakingSection}
          answerParsingOptions={answerParsingOptions}
          onAnswerParsingOptionsChange={setAnswerParsingOptions}
        />
      )
    }

    if (stepKind === 'stem_categories') {
      return (
        <StepStemCategories
          stems={wizard.state.stems}
          sectionId={sectionId}
          categories={categoryOptions.flatMap((category) =>
            typeof category.id === 'string' && category.id.length > 0
              ? [
                  {
                    id: category.id,
                    name: category.name,
                    label: category.label,
                    ucat_section_id: category.ucat_section_id,
                  } satisfies BulkImportCategoryOption,
                ]
              : []
          )}
          onUpdateStem={wizard.updateStemForm}
          inferMissingCategoryId={
            resolvedBulkImportSection && sectionId ? inferMissingCategoryId : undefined
          }
        />
      )
    }

    if (stepKind === 'question_tags') {
      return (
        <StepQuestionTags
          stems={wizard.state.stems}
          tags={tagOptions as BulkImportTagOption[]}
          selectableTags={selectableTagOptions}
          onUpdateStem={wizard.updateStemForm}
        />
      )
    }

    if (stepKind === 'review') {
      return (
        <BulkImportReadinessReview
          stems={wizard.state.stems}
          categories={categoryOptions}
          sections={sections.map((s) => ({
            id: s.id,
            name: s.name,
            display_columns: s.display_columns,
          }))}
          tags={tagOptions}
          onUpdateStem={wizard.updateStemForm}
          onNewImageFileIds={handleStep2ImageFileIds}
          onActiveTextEditorChange={setActiveTextEditor}
          readinessByStemId={readinessByStemId}
          decisions={importDecisions.decisions}
          onDecisionChange={importDecisions.setDecision}
          onSetAll={importDecisions.setAll}
          duplicateFindings={duplicateAnalysis.findings}
          duplicateStatus={duplicateAnalysis.status}
          duplicateError={duplicateAnalysis.error}
          duplicateSimilarityThreshold={duplicateAnalysis.similarityThreshold}
          onDuplicateSimilarityThresholdChange={duplicateAnalysis.setSimilarityThreshold}
          onRetryDuplicateAnalysis={() => void duplicateAnalysis.run()}
        />
      )
    }

    if (stepKind === 'create_set') {
      return (
        <div className="space-y-4">
          <Step4CreateSet
            sectionId={sectionId ?? ''}
            questionCount={importDecisions.selectedStems.reduce(
              (total, stem) => total + stem.values.questions.length,
              0,
            )}
            addToSetEnabled={addToSetEnabled}
            onAddToSetEnabledChange={setAddToSetEnabled}
            addToSetConfig={addToSetConfig}
            onAddToSetConfigChange={setAddToSetConfig}
            onEditSet={onEditSet}
          />
        </div>
      )
    }

    return null
  }

  const confirmCopy = (() => {
    if (!pendingConfirm) return null
    if (pendingConfirm.type === 'toggle_separate_stem') {
      return {
        title: 'Change stem document mode?',
        description:
          'Changing this setting will clear all pasted content and parsed data. You will return to step 1.',
        confirmLabel: 'Continue',
      }
    }
    if (pendingConfirm.type === 'back_to_stems') {
      return {
        title: 'Go back to paste stems?',
        description:
          'Going back will clear per-stem questions and answers. Your stem document will be kept.',
        confirmLabel: 'Continue',
      }
    }
    if (pendingConfirm.type === 'close_modal') {
      return {
        title: 'Exit bulk import?',
        description: 'You have unsaved work. Exiting will discard your progress.',
        confirmLabel: 'Exit without saving',
      }
    }
    return null
  })()

  const description =
    status === 'success'
      ? 'Review completion details for this import.'
      : `Step ${step + 1} of ${totalStepsResolved}: ${getBulkImportStepTitle(stepKind)}`

  const useFullHeightLayout =
    isBulkImportFullHeightPasteStep(stepKind) &&
    status !== 'success' &&
    !isLoadingMeta &&
    !hasErrorMeta

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !suppressDialogCloseRef.current) handleRequestClose()
        }}
      >
        <DialogContent
          className={cn(
            // Lock shell height/overflow so only step bodies scroll (not header/footer).
            'flex h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:!h-[90vh] md:max-w-5xl [&>button]:hidden',
            EXPANDABLE_DIALOG_TRANSITION,
            expanded && EXPANDED_DIALOG_CONTENT_CLASS
          )}
          onInteractOutside={handleDismissAttempt}
          onEscapeKeyDown={handleDismissAttempt}
        >
          <div className="flex-shrink-0 border-b bg-background">
            <DialogHeader className="px-6 pb-4 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-1 items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRequestClose}
                    className="shrink-0"
                    disabled={status === 'submitting' || isParsing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <DialogTitle>Bulk import UCAT question stems</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                  </div>
                </div>
                <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
              </div>
            </DialogHeader>

            {status !== 'success' ? (
              <div className="px-6 pb-4">
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalStepsResolved }).map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'h-2 flex-1 rounded-full transition-colors',
                        index < step ? 'bg-primary' : index === step ? 'bg-primary/50' : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {useFullHeightLayout ? (
              <div className="flex h-full min-h-0 flex-col px-6 py-4">
                <div className="min-h-0 flex-1 overflow-hidden">{renderBody()}</div>
                {formattingIssues.length > 0 ? (
                  <div className="mt-3 shrink-0">
                    <BulkImportFormattingWarnings issues={formattingIssues} />
                  </div>
                ) : null}
                {parseError ? (
                  <div className="mt-3 shrink-0 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {parseError}
                  </div>
                ) : null}
                {status === 'error' && submitError ? (
                  <div className="mt-3 shrink-0 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {submitError}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="px-6 py-4">
                  {renderBody()}
                  {formattingIssues.length > 0 ? (
                    <div className="mt-4">
                      <BulkImportFormattingWarnings issues={formattingIssues} />
                    </div>
                  ) : null}
                  {parseError ? (
                    <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {parseError}
                    </div>
                  ) : null}
                  {status === 'error' && submitError ? (
                    <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {submitError}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={handlePreviousClick} disabled={!canGoPrevious}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>

            {stepKind === 'review' && activeTextEditor ? (
              <div className="min-w-0 flex-1 overflow-x-auto" data-rich-text-toolbar>
                <UcatRichTextToolbar editor={activeTextEditor} />
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {status === 'success' ? (
              <Button onClick={handleRequestClose}>Close</Button>
            ) : step < totalStepsResolved - 1 ? (
              <Button onClick={handleNextClick} disabled={!canGoNext}>
                {isParsing ? 'Parsing…' : 'Next'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : isBulkParseSection ? (
              <Button
                onClick={handleImportAll}
                disabled={
                  status === 'submitting' ||
                  importDecisions.selectedStems.length === 0 ||
                  (addToSetEnabled && !addToSetConfig) ||
                  (addToSetEnabled &&
                    addToSetConfig?.mode === 'create' &&
                    !addToSetConfig.referenceBlueprintId) ||
                  (addToSetEnabled &&
                    addToSetConfig?.mode === 'create' &&
                    addToSetConfig.timingMode === 'fixed' &&
                    (addToSetConfig.fixedTimeLimitSeconds == null ||
                      addToSetConfig.fixedTimeLimitSeconds <= 0))
                }
              >
                Import stems
              </Button>
            ) : (
              <Button onClick={handleRequestClose}>Close</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {confirmCopy ? (
        <BulkImportConfirmDialog
          open={pendingConfirm != null}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          onConfirm={resolvePendingConfirm}
          onCancel={clearPendingConfirm}
        />
      ) : null}
    </>
  )
}
