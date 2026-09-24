'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useFieldArray } from 'react-hook-form'
import type { Json } from '@altitutor/shared'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Input,
  SearchableSelect,
  Tabs,
  TabsContent,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui'
import { Eye, EyeOff, Info } from 'lucide-react'
import { SegmentedControl } from '@/shared/components/segmented-control'
import { cn } from '@/shared/utils'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { UcatQuestionSourceChannel } from '@/features/ucat/questions/api/questions'
import { formatSourceChannel, formatGeneratedTimestamp, formatStaffDisplayName, metadataString } from '@/features/ucat/questions/lib/source-display'
import { DEFAULT_OPTIONS } from '@/features/ucat/questions/constants/stemFormConstants'
import {
  QuestionTagsSelect,
  type CategoryOption,
  type TagOption,
  type UcatSectionOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import {
  aiTextToProseMirror,
  plainTextToProseMirror,
  plainTextToProseMirrorWithLineBreaks,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'
import { taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import {
  authoredResponseContract,
  allowsResponseTypeChoice,
  responseContractForType,
  responseContractIssues,
  suggestedResponseContract,
  transformResponseContract,
} from '@/features/ucat/questions/lib/response-contract-authoring'
import { UcatStemSetMembershipCard } from '@/features/ucat/questions/components/stem-editor/UcatStemSetMembershipCard'
import { useUcatStemCatalog } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatStemLearningModuleMembershipCard } from '@/features/ucat/questions/components/stem-editor/UcatStemLearningModuleMembershipCard'
import { UcatAuthoringAgentChat } from '@/features/ucat/authoring-agent/UcatAuthoringAgentChat'
import type { UcatAuthoringToolCall, UcatAuthoringToolResult } from '@/features/ucat/authoring-agent/types'
import { appendImageNode, appendImageNodeToDoc, replaceFirstImageNode, replaceFirstImageNodeInDoc } from '@/features/ucat/authoring-agent/rich-text-image'
import { generatedVisualBlockToImageNode, getGeneratedVisualSpecIssue } from '@/features/ucat/questions/lib/ai-generation/content-blocks'
import type { GeneratedContentBlock } from '@/features/ucat/questions/lib/ai-generation/schema'
import type { UcatAuthoringWorkspaceTab } from '@/features/ucat/shared/components/UcatAuthoringWorkspaceTabs'
import type { SelectedVisualImage } from '@/features/ucat/shared/lib/selected-visual-image'
import { UcatPropertyRow } from '@/features/ucat/shared/components/UcatPropertyRow'
import { UcatAiAssessmentControl } from '@/features/ucat/questions/components/stem-editor/UcatAiAssessmentControl'
import {
  BulkImportAiReviewPanel,
  type BulkImportAiReviewPanelProps,
} from '@/features/ucat/questions/components/bulk-import/BulkImportAiReviewPanel'
import { trimTextParagraphs } from '@/features/ucat/questions/components/stem-editor/stemEditorQuestionContent'
import { UcatDetectedStemMetadataPill } from '@/features/ucat/questions/components/stem-editor/UcatDetectedStemMetadataControl'
import type { StemMetadataDetectionControls } from '@/features/ucat/questions/hooks/useManualStemMetadataDetection'

export type StemEditorMode = 'edit' | 'view'
export type StemEditorFocusTarget = 'category' | 'explanation' | 'tags' | 'sets'

type UcatStemEditorPropertiesPanelProps = {
  form: UseFormReturn<UcatQuestionStemFormValues>
  sections: UcatSectionOption[]
  categories: CategoryOption[]
  tags: TagOption[]
  currentQuestionIndex: number
  onQuestionIndexChange: (index: number) => void
  editorMode: StemEditorMode
  onEditorModeChange: (mode: StemEditorMode) => void
  showAnswer: boolean
  onShowAnswerChange: (show: boolean) => void
  showModeControls?: boolean
  stemId?: string | null
  focusTarget?: StemEditorFocusTarget | null
  focusMessage?: string | null
  sourceChannel?: UcatQuestionSourceChannel | null
  aiGenerationMetadata?: Json | null
  createdByFirstName?: string | null
  createdByLastName?: string | null
  statusChangedByFirstName?: string | null
  statusChangedByLastName?: string | null
  statusChangedAt?: string | null
  activeTab?: Exclude<UcatAuthoringWorkspaceTab, 'editor'>
  onActiveTabChange?: (value: UcatAuthoringWorkspaceTab) => void
  selectedImage?: SelectedVisualImage | null
  onAcceptSelectedImage?: (imageNode: Json) => Promise<{ ok: boolean; message: string }> | { ok: boolean; message: string }
  onNewImageFileIds?: (fileIds: string[]) => void
  aiReviewAvailable?: boolean
  bulkImportAiReview?: Omit<BulkImportAiReviewPanelProps, 'activeQuestionId' | 'activeQuestionIndex'> | null
  metadataDetection?: StemMetadataDetectionControls | null
  className?: string
}

function PropertyHint({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={`${label} info`}
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
            {hint}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  )
}

function ReadOnlyValue({ children }: { children: ReactNode }) {
  return <span className="block text-right text-sm text-foreground">{children}</span>
}

function humanizeDetectionToken(value: string): string {
  const text = value.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function PropertiesCard({
  value,
  title,
  children,
}: {
  value: string
  title: string
  children: ReactNode
}) {
  return (
    <AccordionItem value={value} className="border-0">
      <div className={tutorCardCn('overflow-hidden')}>
        <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&>svg]:text-muted-foreground">
          <span className="text-sm font-semibold">{title}</span>
        </AccordionTrigger>
        <AccordionContent className="space-y-1 border-t border-black/[0.06] px-3 pb-4 pt-2 dark:border-white/10">
          {children}
        </AccordionContent>
      </div>
    </AccordionItem>
  )
}

export function UcatStemEditorPropertiesPanel({
  form,
  sections,
  categories,
  tags,
  currentQuestionIndex,
  onQuestionIndexChange,
  editorMode,
  onEditorModeChange,
  showAnswer,
  onShowAnswerChange,
  showModeControls = true,
  stemId,
  focusTarget,
  focusMessage,
  sourceChannel,
  aiGenerationMetadata,
  createdByFirstName,
  createdByLastName,
  statusChangedByFirstName,
  statusChangedByLastName,
  statusChangedAt,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  selectedImage = null,
  onAcceptSelectedImage,
  onNewImageFileIds,
  aiReviewAvailable = false,
  bulkImportAiReview = null,
  metadataDetection = null,
  className,
}: UcatStemEditorPropertiesPanelProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'questions' })
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<'properties' | 'ai' | 'review'>('properties')
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab
  const stemCatalogQuery = useUcatStemCatalog(Boolean(stemId))
  const sectionLocked = useMemo(() => {
    if (!stemId) return false
    const item = stemCatalogQuery.data?.find((stem) => stem.id === stemId)
    return (item?.setIds.length ?? 0) > 0
  }, [stemId, stemCatalogQuery.data])

  function handleActiveTabChange(value: string) {
    const next = value as 'properties' | 'ai' | 'review'
    setUncontrolledActiveTab(next)
    onActiveTabChange?.(next)
  }

  const sectionId = form.watch('sectionId')
  const watchedStem = form.watch()
  const aiModel = metadataString(aiGenerationMetadata, 'model')
  const generatedAtLabel = formatGeneratedTimestamp(metadataString(aiGenerationMetadata, 'generatedAt'))
  const generatedByName =
    formatStaffDisplayName(createdByFirstName, createdByLastName) ??
    metadataString(aiGenerationMetadata, 'generatedByName') ??
    metadataString(aiGenerationMetadata, 'generatedByEmail')
  const statusChangedByName = formatStaffDisplayName(statusChangedByFirstName, statusChangedByLastName)
  const statusChangedAtLabel = formatGeneratedTimestamp(statusChangedAt)


  const categoriesFiltered = sectionId
    ? categories.filter((c) => (c.ucat_section_id ?? null) === sectionId)
    : []

  const safeQuestionIndex =
    fields.length > 0 ? Math.min(Math.max(0, currentQuestionIndex), fields.length - 1) : 0
  const activeQuestion = watchedStem.questions?.[safeQuestionIndex]
  const selectedCategory = categories.find((category) => category.id === watchedStem.categoryId)
  const selectedSection = sections.find((section) => section.id === sectionId)
  const suggestedContract = suggestedResponseContract(selectedCategory?.name, selectedSection?.name)
  const contractIssues = activeQuestion ? responseContractIssues(activeQuestion) : []
  const currentContract = activeQuestion
    ? authoredResponseContract(activeQuestion)
    : suggestedContract
  const currentResponseType = currentContract.responseType
  const responseTypeChoiceAllowed = allowsResponseTypeChoice(selectedCategory?.name)
  const detectedSectionId = metadataDetection?.pendingDiff?.sectionId ?? null
  const detectedCategoryId = metadataDetection?.pendingDiff?.categoryId ?? null
  const detectedResponse = metadataDetection?.pendingDiff?.responseContractsByQuestionIndex[safeQuestionIndex]
  const detectedTagIds = metadataDetection?.pendingDiff?.tagIdsByQuestionIndex[safeQuestionIndex] ?? []
  const detectedSectionLabel = detectedSectionId
    ? sections.find((section) => section.id === detectedSectionId)?.name ?? 'Unknown section'
    : null
  const detectedCategoryLabel = detectedCategoryId
    ? taxonomyDisplayLabel(
        categories.find((category) => category.id === detectedCategoryId) ?? { name: 'Unknown category' },
      )
    : null
  const detectedResponseLabel = detectedResponse
    ? [detectedResponse.responseType.value, detectedResponse.answerScheme.value]
        .flatMap((value) => typeof value === 'string' ? [humanizeDetectionToken(value)] : [])
        .join(' / ') || 'Review interaction'
    : null
  const detectedTagsLabel = detectedTagIds.length > 0
    ? detectedTagIds
        .map((tagId) => taxonomyDisplayLabel(tags.find((tag) => tag.id === tagId) ?? { name: 'Unknown tag' }))
        .join(', ')
    : null
  const currentResponseLabel = [currentContract.responseType, currentContract.answerScheme]
    .map(humanizeDetectionToken)
    .join(' / ')
  const currentTagsLabel = (activeQuestion?.tagIds ?? []).length > 0
    ? (activeQuestion?.tagIds ?? [])
        .map((tagId) => taxonomyDisplayLabel(tags.find((tag) => tag.id === tagId) ?? { name: 'Unknown tag' }))
        .join(', ')
    : 'No tags'
  const detectedResponseEvidence = detectedResponse
    ? [...new Set([
        ...detectedResponse.responseType.evidence,
        ...detectedResponse.answerScheme.evidence,
      ])].map(humanizeDetectionToken)
    : []
  const detectedResponseConflicts = detectedResponse
    ? [...new Set([
        ...detectedResponse.responseType.conflicts,
        ...detectedResponse.answerScheme.conflicts,
      ])].map(humanizeDetectionToken)
    : []
  const detectedResponseConfidence = detectedResponse
    ? [...new Set([
        detectedResponse.responseType.confidence,
        detectedResponse.answerScheme.confidence,
      ])].join(' / ')
    : null
  const detectedResponseExplanation = detectedResponse?.reviewState === 'prefilled'
    ? 'The question structure and answer pattern agree with this interaction. Accepting will replace the current interaction settings.'
    : detectedResponse?.reviewState === 'confirmation_required'
      ? 'The content contains a likely interaction pattern, but the parser found signals that need your confirmation before changing it.'
      : detectedResponse?.reviewState === 'blocked'
        ? 'The parser found conflicting signals and cannot safely change the interaction. Review it manually, then reject this prompt.'
        : 'The parser could not confidently infer a different interaction from the question structure. Accepting keeps the current interaction; rejecting hides this prompt.'

  function handleCategoryChange(nextCategoryId: string | null): void {
    form.setValue('categoryId', nextCategoryId, {
      shouldDirty: true,
    })
    if (nextCategoryId == null) return

    const nextCategory = categories.find((category) => category.id === nextCategoryId)
    const defaultContract = suggestedResponseContract(nextCategory?.name, selectedSection?.name)
    form.setValue(
      'questions',
      form.getValues('questions').map((question) => transformResponseContract(question, defaultContract)),
      { shouldDirty: true },
    )
  }

  const executeStemAgentTool = async (toolCall: UcatAuthoringToolCall): Promise<UcatAuthoringToolResult> => {
    const input = toolCall.input
    const text = typeof input.text === 'string' ? input.text : ''
    const questionIndex = typeof input.questionIndex === 'number' ? input.questionIndex : safeQuestionIndex
    const optionIndex = typeof input.optionIndex === 'number' ? input.optionIndex : null
    const current = form.getValues()
    const target = typeof input.target === 'string' ? input.target : 'stem'

    switch (toolCall.name) {
      case 'reviseSelectedImage': {
        const instructions = typeof input.instructions === 'string' ? input.instructions.trim() : ''
        if (!selectedImage?.fileId || !selectedImage.src) {
          return { toolCallId: toolCall.id, ok: false, message: 'The selected image does not have an editable source file.' }
        }
        if (!instructions) return { toolCallId: toolCall.id, ok: false, message: 'No image revision instructions were provided.' }
        const response = await fetch('/api/ucat/authoring-agent/images/revise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: selectedImage.fileId,
            instructions,
            alt: selectedImage.visualAltText,
            context: current,
          }),
        })
        const image = await response.json() as { fileId?: string; signedUrl?: string; alt?: string | null; error?: string }
        if (!response.ok || !image.fileId || !image.signedUrl) {
          return { toolCallId: toolCall.id, ok: false, message: image.error ?? 'Image revision failed.' }
        }
        onNewImageFileIds?.([image.fileId])
        return {
          toolCallId: toolCall.id,
          ok: true,
          message: 'AI revision is ready to review.',
          output: {
            kind: 'image_preview',
            originalSrc: selectedImage.src,
            instructions,
            imageNode: {
              type: 'image',
              attrs: { src: image.signedUrl, fileId: image.fileId, alt: image.alt ?? '' },
            },
          } as Json,
        }
      }

      case 'previewSelectedImageConversion': {
        if (!selectedImage?.src) return { toolCallId: toolCall.id, ok: false, message: 'No legacy image is selected.' }
        const spec = input.spec && typeof input.spec === 'object' && !Array.isArray(input.spec)
          ? input.spec as Record<string, unknown>
          : null
        const visualType = input.visualType === 'vega_lite_chart' || input.visualType === 'set_diagram' || input.visualType === 'venn_diagram'
          ? input.visualType
          : null
        if (!spec || !visualType) return { toolCallId: toolCall.id, ok: false, message: 'The conversion did not include a valid visual specification.' }
        const visualBlock = {
          type: 'visual',
          visualType,
          spec,
          title: typeof input.title === 'string' ? input.title : null,
          altText: typeof input.altText === 'string' && input.altText.trim() ? input.altText : selectedImage.visualAltText || 'Converted deterministic visual',
        } as Extract<GeneratedContentBlock, { type: 'visual' }>
        const issue = getGeneratedVisualSpecIssue(visualBlock)
        if (issue) return { toolCallId: toolCall.id, ok: false, message: issue }
        let imageNode: Json
        if (visualType === 'vega_lite_chart') {
          const response = await fetch('/api/ucat/authoring-agent/visuals/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(visualBlock),
          })
          const body = await response.json() as { imageNode?: Json; error?: string }
          if (!response.ok || !body.imageNode) return { toolCallId: toolCall.id, ok: false, message: body.error ?? 'Chart rendering failed.' }
          imageNode = body.imageNode
        } else {
          imageNode = generatedVisualBlockToImageNode(visualBlock)
        }
        return {
          toolCallId: toolCall.id,
          ok: true,
          message: 'Editable deterministic visual is ready to review.',
          output: {
            kind: 'image_preview',
            originalSrc: selectedImage.src,
            instructions: typeof input.instructions === 'string' ? input.instructions : '',
            imageNode,
          } as Json,
        }
      }

      case 'bulkParaphraseStem': {
        const stemText = typeof input.stemText === 'string' ? input.stemText : ''
        if (!stemText.trim()) return { toolCallId: toolCall.id, ok: false, message: 'No rewritten stem text provided.' }

        const questionInputs = Array.isArray(input.questions) ? input.questions : []
        if (questionInputs.length !== current.questions.length) {
          return {
            toolCallId: toolCall.id,
            ok: false,
            message: `Expected rewritten content for ${current.questions.length} questions.`,
          }
        }

        const patches: Array<{
          questionIndex: number
          questionText: string
          answerExplanation?: string
          options: Array<{
            optionIndex: number
            answerText: string
            answerExplanation?: string
          }>
        }> = []

        for (const questionInput of questionInputs) {
          const questionRecord =
            questionInput && typeof questionInput === 'object' && !Array.isArray(questionInput)
              ? questionInput as Record<string, Json | undefined>
              : null
          const qIndex = typeof questionRecord?.questionIndex === 'number' ? questionRecord.questionIndex : null
          const questionText = typeof questionRecord?.questionText === 'string' ? questionRecord.questionText : ''
          if (qIndex == null || !current.questions[qIndex] || !questionText.trim()) {
            return { toolCallId: toolCall.id, ok: false, message: 'Invalid rewritten question payload.' }
          }
          const existingQuestionExplanation = trimTextParagraphs(
            proseMirrorToPlainText((current.questions[qIndex].answerExplanation as Json | null) ?? null) ?? '',
          )
          if (
            existingQuestionExplanation &&
            (typeof questionRecord?.answerExplanation !== 'string' || !questionRecord.answerExplanation.trim())
          ) {
            return {
              toolCallId: toolCall.id,
              ok: false,
              message: `Expected rewritten explanation for question ${qIndex + 1}.`,
            }
          }

          const optionInputs = Array.isArray(questionRecord?.options) ? questionRecord.options : []
          if (optionInputs.length !== current.questions[qIndex].options.length) {
            return {
              toolCallId: toolCall.id,
              ok: false,
              message: `Expected rewritten content for ${current.questions[qIndex].options.length} options in question ${qIndex + 1}.`,
            }
          }

          const optionPatches: Array<{ optionIndex: number; answerText: string; answerExplanation?: string }> = []
          for (const optionInput of optionInputs) {
            const optionRecord =
              optionInput && typeof optionInput === 'object' && !Array.isArray(optionInput)
                ? optionInput as Record<string, Json | undefined>
                : null
            const oIndex = typeof optionRecord?.optionIndex === 'number' ? optionRecord.optionIndex : null
            const answerText = typeof optionRecord?.answerText === 'string' ? optionRecord.answerText : ''
            if (oIndex == null || !current.questions[qIndex].options[oIndex] || !answerText.trim()) {
              return { toolCallId: toolCall.id, ok: false, message: `Invalid rewritten option payload for question ${qIndex + 1}.` }
            }
            const existingOptionExplanation = trimTextParagraphs(
              proseMirrorToPlainText((current.questions[qIndex].options[oIndex].answerExplanation as Json | null) ?? null) ?? '',
            )
            if (
              existingOptionExplanation &&
              (typeof optionRecord?.answerExplanation !== 'string' || !optionRecord.answerExplanation.trim())
            ) {
              return {
                toolCallId: toolCall.id,
                ok: false,
                message: `Expected rewritten explanation for question ${qIndex + 1}, option ${oIndex + 1}.`,
              }
            }
            optionPatches.push({
              optionIndex: oIndex,
              answerText,
              answerExplanation: typeof optionRecord?.answerExplanation === 'string' ? optionRecord.answerExplanation : undefined,
            })
          }

          patches.push({
            questionIndex: qIndex,
            questionText,
            answerExplanation: typeof questionRecord?.answerExplanation === 'string' ? questionRecord.answerExplanation : undefined,
            options: optionPatches,
          })
        }

        form.setValue('stemText', aiTextToProseMirror(stemText), { shouldDirty: true })
        for (const patch of patches) {
          form.setValue(`questions.${patch.questionIndex}.questionText`, plainTextToProseMirrorWithLineBreaks(patch.questionText), { shouldDirty: true })
          if (patch.answerExplanation !== undefined) {
            form.setValue(`questions.${patch.questionIndex}.answerExplanation`, aiTextToProseMirror(patch.answerExplanation), { shouldDirty: true })
          }
          for (const optionPatch of patch.options) {
            form.setValue(
              `questions.${patch.questionIndex}.options.${optionPatch.optionIndex}.answerText`,
              plainTextToProseMirror(optionPatch.answerText),
              { shouldDirty: true },
            )
            if (optionPatch.answerExplanation !== undefined) {
              form.setValue(
                `questions.${patch.questionIndex}.options.${optionPatch.optionIndex}.answerExplanation`,
                aiTextToProseMirror(optionPatch.answerExplanation),
                { shouldDirty: true },
              )
            }
          }
        }

        return {
          toolCallId: toolCall.id,
          ok: true,
          message: `Paraphrased the full draft stem package across ${patches.length} questions.`,
        }
      }

      case 'updateStemText':
        if (!text.trim()) return { toolCallId: toolCall.id, ok: false, message: 'No stem text provided.' }
        form.setValue('stemText', aiTextToProseMirror(text), { shouldDirty: true })
        return { toolCallId: toolCall.id, ok: true, message: 'Updated draft stem text.' }

      case 'updateStemProperties': {
        if (typeof input.sectionId === 'string' && !sectionLocked) {
          form.setValue('sectionId', input.sectionId, { shouldDirty: true })
        }
        if (typeof input.categoryId === 'string' || input.categoryId === null) {
          form.setValue('categoryId', input.categoryId ?? null, { shouldDirty: true })
        }
        if (typeof input.isPrivate === 'boolean') {
          form.setValue('accessScope', input.isPrivate ? 'private' : 'public', { shouldDirty: true })
        }
        if (input.status === 'published' || input.status === 'in_review' || input.status === 'draft') {
          form.setValue('status', input.status, { shouldDirty: true })
        }
        if (typeof input.tutorSourceNote === 'string') {
          form.setValue('tutorSourceNote', input.tutorSourceNote, { shouldDirty: true })
        }
        return { toolCallId: toolCall.id, ok: true, message: 'Updated draft stem properties.' }
      }

      case 'updateQuestionText':
        if (questionIndex == null || !current.questions[questionIndex]) {
          return { toolCallId: toolCall.id, ok: false, message: 'Question not found.' }
        }
        form.setValue(`questions.${questionIndex}.questionText`, plainTextToProseMirrorWithLineBreaks(text), { shouldDirty: true })
        onQuestionIndexChange(questionIndex)
        return { toolCallId: toolCall.id, ok: true, message: `Updated draft question ${questionIndex + 1}.` }

      case 'insertQuestion': {
        const options = Array.isArray(input.options) ? input.options : []
        const nextQuestion = {
          questionText: plainTextToProseMirrorWithLineBreaks(
            typeof input.questionText === 'string' ? input.questionText : 'New question',
          ),
          responseType: 'multiple_choice' as const,
          answerScheme: 'single_choice' as const,
          answerExplanation:
            typeof input.answerExplanation === 'string' && input.answerExplanation.trim()
              ? aiTextToProseMirror(input.answerExplanation)
              : null,
          difficulty: typeof input.difficulty === 'number' ? input.difficulty : null,
          timeBurdenSeconds: typeof input.timeBurdenSeconds === 'string' ? input.timeBurdenSeconds : '',
          tagIds: Array.isArray(input.tagIds) ? input.tagIds.filter((id): id is string => typeof id === 'string') : [],
          sourceChannel: 'ai_generation' as const,
          aiGenerationMetadata: null,
          options: options.length > 0
            ? options.map((option) => {
                const record = option && typeof option === 'object' && !Array.isArray(option)
                  ? option as Record<string, unknown>
                  : {}
                return {
                  answerText: plainTextToProseMirror(typeof record.answerText === 'string' ? record.answerText : ''),
                  answerExplanation: null,
                  answerKeyValue: record.answerKeyValue === 'correct' ? 'correct' as const : null,
                }
              })
            : [...DEFAULT_OPTIONS],
        }
        append(nextQuestion)
        onQuestionIndexChange(fields.length)
        return { toolCallId: toolCall.id, ok: true, message: `Inserted draft question ${fields.length + 1}.` }
      }

      case 'updateQuestionProperties':
        if (questionIndex == null || !current.questions[questionIndex]) {
          return { toolCallId: toolCall.id, ok: false, message: 'Question not found.' }
        }
        if (typeof input.difficulty === 'number' || input.difficulty === null) {
          form.setValue(`questions.${questionIndex}.difficulty`, input.difficulty, { shouldDirty: true })
        }
        if (typeof input.timeBurdenSeconds === 'string') {
          form.setValue(`questions.${questionIndex}.timeBurdenSeconds`, input.timeBurdenSeconds, { shouldDirty: true })
        }
        if (Array.isArray(input.tagIds)) {
          form.setValue(
            `questions.${questionIndex}.tagIds`,
            input.tagIds.filter((id): id is string => typeof id === 'string'),
            { shouldDirty: true },
          )
        }
        return { toolCallId: toolCall.id, ok: true, message: `Updated draft question ${questionIndex + 1} properties.` }

      case 'updateQuestionTags':
        if (questionIndex == null || !current.questions[questionIndex] || !Array.isArray(input.tagIds)) {
          return { toolCallId: toolCall.id, ok: false, message: 'Question or tags not found.' }
        }
        form.setValue(
          `questions.${questionIndex}.tagIds`,
          input.tagIds.filter((id): id is string => typeof id === 'string'),
          { shouldDirty: true },
        )
        return { toolCallId: toolCall.id, ok: true, message: `Updated draft tags for question ${questionIndex + 1}.` }

      case 'insertAnswerOption':
        if (questionIndex == null || !current.questions[questionIndex]) {
          return { toolCallId: toolCall.id, ok: false, message: 'Question not found.' }
        }
        form.setValue(
          `questions.${questionIndex}.options`,
          [
            ...current.questions[questionIndex].options,
            {
              answerText: plainTextToProseMirror(typeof input.answerText === 'string' ? input.answerText : ''),
              answerExplanation: null,
              answerKeyValue:
                input.answerKeyValue === 'correct' ||
                input.answerKeyValue === 'yes' ||
                input.answerKeyValue === 'no' ||
                input.answerKeyValue === 'most' ||
                input.answerKeyValue === 'least'
                  ? input.answerKeyValue
                  : null,
            },
          ],
          { shouldDirty: true },
        )
        return { toolCallId: toolCall.id, ok: true, message: `Inserted answer option for question ${questionIndex + 1}.` }

      case 'updateAnswerOption':
        if (questionIndex == null || optionIndex == null || !current.questions[questionIndex]?.options[optionIndex]) {
          return { toolCallId: toolCall.id, ok: false, message: 'Answer option not found.' }
        }
        if (typeof input.answerText === 'string') {
          form.setValue(`questions.${questionIndex}.options.${optionIndex}.answerText`, plainTextToProseMirror(input.answerText), { shouldDirty: true })
        }
        if (typeof input.answerExplanation === 'string') {
          form.setValue(`questions.${questionIndex}.options.${optionIndex}.answerExplanation`, aiTextToProseMirror(input.answerExplanation), { shouldDirty: true })
        }
        if (
          input.answerKeyValue === null ||
          input.answerKeyValue === 'correct' ||
          input.answerKeyValue === 'yes' ||
          input.answerKeyValue === 'no' ||
          input.answerKeyValue === 'most' ||
          input.answerKeyValue === 'least'
        ) {
          form.setValue(`questions.${questionIndex}.options.${optionIndex}.answerKeyValue`, input.answerKeyValue, { shouldDirty: true })
        }
        return { toolCallId: toolCall.id, ok: true, message: `Updated answer option ${optionIndex + 1}.` }

      case 'markCorrectAnswer':
        if (questionIndex == null || optionIndex == null || !current.questions[questionIndex]?.options?.[optionIndex]) {
          return { toolCallId: toolCall.id, ok: false, message: 'Answer option not found.' }
        }
        form.setValue(
          `questions.${questionIndex}.options`,
          (current.questions[questionIndex].options ?? []).map((option, index) => ({
            ...option,
            answerKeyValue: index === optionIndex ? 'correct' as const : null,
          })),
          { shouldDirty: true },
        )
        return { toolCallId: toolCall.id, ok: true, message: `Marked option ${optionIndex + 1} correct.` }

      case 'updateAnswerExplanation':
        if (questionIndex == null || !current.questions[questionIndex]) {
          return { toolCallId: toolCall.id, ok: false, message: 'Question not found.' }
        }
        form.setValue(`questions.${questionIndex}.answerExplanation`, aiTextToProseMirror(text), { shouldDirty: true })
        return { toolCallId: toolCall.id, ok: true, message: `Updated explanation for question ${questionIndex + 1}.` }

      case 'deleteQuestion':
        if (questionIndex == null || !current.questions[questionIndex]) {
          return { toolCallId: toolCall.id, ok: false, message: 'Question not found.' }
        }
        if (current.questions.length <= 1) {
          return { toolCallId: toolCall.id, ok: false, message: 'Cannot delete the only question.' }
        }
        remove(questionIndex)
        if (safeQuestionIndex >= questionIndex && safeQuestionIndex > 0) onQuestionIndexChange(safeQuestionIndex - 1)
        return { toolCallId: toolCall.id, ok: true, message: `Deleted draft question ${questionIndex + 1}.` }

      case 'deleteAnswerOption':
        if (questionIndex == null || optionIndex == null || !current.questions[questionIndex]?.options[optionIndex]) {
          return { toolCallId: toolCall.id, ok: false, message: 'Answer option not found.' }
        }
        form.setValue(
          `questions.${questionIndex}.options`,
          current.questions[questionIndex].options.filter((_, index) => index !== optionIndex),
          { shouldDirty: true },
        )
        return { toolCallId: toolCall.id, ok: true, message: `Deleted draft answer option ${optionIndex + 1}.` }

      case 'insertImage':
      case 'replaceImageFromPrompt': {
        const prompt = typeof input.prompt === 'string' ? input.prompt : ''
        if (!prompt.trim()) return { toolCallId: toolCall.id, ok: false, message: 'No image prompt provided.' }
        const response = await fetch('/api/ucat/authoring-agent/images/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            alt: typeof input.alt === 'string' ? input.alt : null,
          }),
        })
        const image = (await response.json()) as {
          fileId?: string
          signedUrl?: string
          alt?: string | null
          error?: string
        }
        if (!response.ok || !image.fileId || !image.signedUrl) {
          return { toolCallId: toolCall.id, ok: false, message: image.error ?? 'Image generation failed.' }
        }
        const imageDoc = (value: Json | null | undefined) => {
          const nextImage = { src: image.signedUrl!, fileId: image.fileId!, alt: image.alt ?? null }
          return toolCall.name === 'replaceImageFromPrompt'
            ? replaceFirstImageNodeInDoc(value, nextImage)
            : appendImageNodeToDoc(value, nextImage)
        }
        const action = toolCall.name === 'replaceImageFromPrompt' ? 'Replaced' : 'Inserted'

        if (target === 'stem') {
          form.setValue('stemText', imageDoc(current.stemText as Json), { shouldDirty: true })
          return { toolCallId: toolCall.id, ok: true, message: `${action} generated image in draft stem.` }
        }
        const qIndex = questionIndex ?? safeQuestionIndex
        if (!current.questions[qIndex]) return { toolCallId: toolCall.id, ok: false, message: 'Question not found.' }
        if (target === 'question') {
          form.setValue(`questions.${qIndex}.questionText`, imageDoc(current.questions[qIndex].questionText as Json), { shouldDirty: true })
          return { toolCallId: toolCall.id, ok: true, message: `${action} generated image in question ${qIndex + 1}.` }
        }
        if (target === 'explanation') {
          form.setValue(`questions.${qIndex}.answerExplanation`, imageDoc(current.questions[qIndex].answerExplanation as Json | null), { shouldDirty: true })
          return { toolCallId: toolCall.id, ok: true, message: `${action} generated image in question ${qIndex + 1} explanation.` }
        }
        if (target === 'answerOption') {
          const oIndex = optionIndex ?? 0
          if (!current.questions[qIndex].options[oIndex]) return { toolCallId: toolCall.id, ok: false, message: 'Answer option not found.' }
          form.setValue(
            `questions.${qIndex}.options.${oIndex}.answerText`,
            imageDoc(current.questions[qIndex].options[oIndex].answerText as Json),
            { shouldDirty: true },
          )
          return { toolCallId: toolCall.id, ok: true, message: `${action} generated image in answer option ${oIndex + 1}.` }
        }
        return { toolCallId: toolCall.id, ok: false, message: `Unsupported image target: ${target}.` }
      }

      case 'replaceVisualSpec': {
        const spec = input.spec && typeof input.spec === 'object' && !Array.isArray(input.spec)
          ? input.spec as Record<string, unknown>
          : null
        if (!spec) return { toolCallId: toolCall.id, ok: false, message: 'No visual spec provided.' }
        const visualBlock = {
          type: 'visual',
          visualType: typeof input.visualType === 'string' ? input.visualType : 'venn_diagram',
          title: typeof input.title === 'string' ? input.title : null,
          altText: typeof input.altText === 'string' ? input.altText : '',
          spec,
        } as Extract<GeneratedContentBlock, { type: 'visual' }>
        const specIssue = getGeneratedVisualSpecIssue(visualBlock)
        if (specIssue) return { toolCallId: toolCall.id, ok: false, message: specIssue }
        const imageNode = generatedVisualBlockToImageNode(visualBlock)
        const writeVisual = (value: Json | null | undefined) =>
          input.mode === 'append' ? appendImageNode(value, imageNode) : replaceFirstImageNode(value, imageNode)
        const qIndex = questionIndex ?? safeQuestionIndex
        if (target === 'stem') {
          form.setValue('stemText', writeVisual(current.stemText as Json), { shouldDirty: true })
          return { toolCallId: toolCall.id, ok: true, message: 'Inserted deterministic visual in draft stem.' }
        }
        if (!current.questions[qIndex]) return { toolCallId: toolCall.id, ok: false, message: 'Question not found.' }
        if (target === 'question') {
          form.setValue(`questions.${qIndex}.questionText`, writeVisual(current.questions[qIndex].questionText as Json), { shouldDirty: true })
          return { toolCallId: toolCall.id, ok: true, message: `Inserted deterministic visual in question ${qIndex + 1}.` }
        }
        if (target === 'explanation') {
          form.setValue(`questions.${qIndex}.answerExplanation`, writeVisual(current.questions[qIndex].answerExplanation as Json | null), { shouldDirty: true })
          return { toolCallId: toolCall.id, ok: true, message: `Inserted deterministic visual in question ${qIndex + 1} explanation.` }
        }
        return { toolCallId: toolCall.id, ok: false, message: `Unsupported visual target: ${target}.` }
      }

      default:
        return { toolCallId: toolCall.id, ok: false, message: `${toolCall.name} is not available in the stem editor yet.` }
    }
  }

  return (
    <aside className={cn('flex h-full min-h-0 w-full flex-col overflow-hidden bg-background p-3 lg:p-4', className)}>
      <Tabs value={activeTab} onValueChange={handleActiveTabChange} className="flex h-full min-h-0 flex-1 flex-col">
        <div className="hidden lg:block">
          <SegmentedControl
            fullWidth
            value={activeTab}
            onValueChange={(value) => handleActiveTabChange(value)}
            options={[
              { value: 'properties', label: 'Properties' },
              { value: 'ai', label: 'AI tools' },
              ...(aiReviewAvailable ? [{ value: 'review', label: 'AI review' }] : []),
            ]}
          />
        </div>
        <TabsContent value="properties" className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-4">
        {showModeControls ? (
          <div className={tutorCardCn('space-y-4 p-3')}>
            <UcatPropertyRow label="Mode">
              <SegmentedControl
                fullWidth
                value={editorMode}
                onValueChange={onEditorModeChange}
                options={[
                  { value: 'edit', label: 'Edit' },
                  { value: 'view', label: 'View' },
                ]}
              />
            </UcatPropertyRow>
            {editorMode === 'view' ? (
              <UcatPropertyRow label="Answer">
                <Button
                  type="button"
                  variant={showAnswer ? 'secondary' : 'outline'}
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => onShowAnswerChange(!showAnswer)}
                >
                  {showAnswer ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Show
                    </>
                  )}
                </Button>
              </UcatPropertyRow>
            ) : null}
          </div>
        ) : null}

        {focusMessage ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {focusMessage}
          </div>
        ) : null}

        <Accordion
          type="multiple"
          defaultValue={['ai', 'stem', 'sets', 'learning-modules', 'question', 'source']}
          className="space-y-4"
        >
          <PropertiesCard value="stem" title="Stem properties">
            <UcatPropertyRow label="Section">
              <div className="space-y-1">
                <SearchableSelect<{ id: string | null; name: string | null }>
                  items={sections}
                  value={sections.find((s) => (s.id ?? '') === sectionId) ?? null}
                  onValueChange={(section) => {
                    form.setValue('sectionId', section?.id ?? '', { shouldDirty: true })
                    form.setValue('categoryId', null, { shouldDirty: true })
                  }}
                  getItemLabel={(s) => s.name ?? 'Untitled'}
                  getItemId={(s) => s.id ?? ''}
                  placeholder="Select section"
                  disabled={sectionLocked}
                  fullWidth
                />
                {sectionLocked ? (
                  <p className="text-xs text-muted-foreground">
                    Remove this stem from its set before changing section.
                  </p>
                ) : null}
                {detectedSectionLabel ? (
                  <UcatDetectedStemMetadataPill
                    propertyLabel="Section"
                    value={detectedSectionLabel}
                    currentValue={selectedSection?.name ?? 'No section'}
                    detectedValue={detectedSectionLabel}
                    explanation="The stem wording and structure matched content associated with this UCAT section. Accepting will replace the current section."
                    evidence={[`Matched the ${detectedSectionLabel} section pattern`]}
                    onAccept={() => metadataDetection?.onAccept('section')}
                    onDismiss={() => metadataDetection?.onDismiss('section')}
                  />
                ) : null}
              </div>
            </UcatPropertyRow>
            <UcatPropertyRow label="Category">
              <div className={cn(focusTarget === 'category' && 'rounded-md ring-2 ring-amber-400 ring-offset-2 ring-offset-background')}>
                <SearchableSelect<{ id: string; name: string; label: string }>
                  items={[
                    { id: 'none', name: 'No category', label: 'No category' },
                    ...categoriesFiltered.map((c) => ({
                      id: c.id ?? 'none',
                      name: c.name ?? 'Untitled',
                      label: taxonomyDisplayLabel(c),
                    })),
                  ]}
                  value={(() => {
                    const categoryId = form.watch('categoryId')
                    const opts = [
                      { id: 'none', name: 'No category', label: 'No category' },
                      ...categoriesFiltered.map((c) => ({
                        id: c.id ?? 'none',
                        name: c.name ?? 'Untitled',
                        label: taxonomyDisplayLabel(c),
                      })),
                    ]
                    return categoryId === null ? opts[0]! : opts.find((o) => o.id === categoryId) ?? null
                  })()}
                  onValueChange={(item) => {
                    const nextCategoryId = item?.id === 'none' ? null : item?.id ?? null
                    handleCategoryChange(nextCategoryId)
                  }}
                  getItemLabel={(c) => taxonomyDisplayLabel(c)}
                  getItemId={(c) => c.id}
                  placeholder={!sectionId ? 'Select section first' : 'Select category'}
                  disabled={!sectionId}
                  fullWidth
                />
                {detectedCategoryLabel ? (
                  <UcatDetectedStemMetadataPill
                    propertyLabel="Category"
                    value={detectedCategoryLabel}
                    currentValue={selectedCategory ? taxonomyDisplayLabel(selectedCategory) : 'No category'}
                    detectedValue={detectedCategoryLabel}
                    explanation="The parser matched the stem's wording and question structure to this category. Accepting will replace the current category."
                    evidence={[`Matched the ${detectedCategoryLabel} category pattern`]}
                    onAccept={() => metadataDetection?.onAccept('category')}
                    onDismiss={() => metadataDetection?.onDismiss('category')}
                  />
                ) : null}
              </div>
            </UcatPropertyRow>
            <UcatPropertyRow label="Access scope">
              <SearchableSelect<{ value: 'public' | 'private'; label: string }>
                items={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                value={
                  form.watch('accessScope') === 'private'
                    ? { value: 'private', label: 'Private' }
                    : { value: 'public', label: 'Public' }
                }
                onValueChange={(item) =>
                  form.setValue('accessScope', item?.value ?? 'public', { shouldDirty: true })
                }
                getItemLabel={(i) => i.label}
                getItemId={(i) => i.value}
                fullWidth
              />
            </UcatPropertyRow>
            <UcatPropertyRow label="Interaction">
              <div className="space-y-1">
                <SearchableSelect<{ value: 'multiple_choice' | 'drag_and_drop'; label: string }>
                items={[
                  { value: 'multiple_choice', label: 'Multiple Choice' },
                  { value: 'drag_and_drop', label: 'Drag and Drop' },
                ]}
                value={
                  currentResponseType === 'drag_and_drop'
                    ? { value: 'drag_and_drop' as const, label: 'Drag and Drop' }
                    : { value: 'multiple_choice', label: 'Multiple Choice' }
                }
                disabled={!responseTypeChoiceAllowed}
                onValueChange={(item) => {
                  if (!item || !activeQuestion) return
                  const target = responseContractForType(
                    item.value,
                    selectedCategory?.name,
                    selectedSection?.name,
                  )
                  const questions = form.getValues('questions').map((question, questionIndex) => (
                    questionIndex === safeQuestionIndex
                      ? transformResponseContract(question, target)
                      : question
                  ))
                  form.setValue('questions', questions, { shouldDirty: true })
                }}
                getItemLabel={(i) => i.label}
                getItemId={(i) => i.value}
                fullWidth
                />
                {detectedResponseLabel ? (
                  <UcatDetectedStemMetadataPill
                    propertyLabel="Interaction"
                    value={detectedResponseLabel}
                    currentValue={currentResponseLabel}
                    detectedValue={detectedResponseLabel === 'Review interaction'
                      ? 'No reliable alternative detected'
                      : detectedResponseLabel}
                    explanation={detectedResponseExplanation}
                    confidence={detectedResponseConfidence}
                    evidence={detectedResponseEvidence.length > 0
                      ? detectedResponseEvidence
                      : ['No decisive structural or answer-pattern evidence was found']}
                    conflicts={detectedResponseConflicts}
                    acceptLabel={detectedResponseLabel === 'Review interaction' ? 'Keep current' : 'Accept'}
                    onAccept={
                      detectedResponse?.reviewState === 'blocked'
                        ? undefined
                        : () => metadataDetection?.onAccept(`response:${safeQuestionIndex}`)
                    }
                    onDismiss={() => metadataDetection?.onDismiss(`response:${safeQuestionIndex}`)}
                  />
                ) : null}
              </div>
            </UcatPropertyRow>
            {contractIssues.length > 0 ? (
              <div className="space-y-2 rounded-md border border-black/10 p-2 dark:border-white/10">
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  {contractIssues[0]?.message}
                  {contractIssues.length > 1 ? ` (+${contractIssues.length - 1} more)` : ''}
                </div>
              </div>
            ) : null}
          </PropertiesCard>

          <PropertiesCard value="sets" title="Set membership">
            <UcatStemSetMembershipCard
              stemId={stemId}
              highlighted={focusTarget === 'sets'}
            />
          </PropertiesCard>

          <PropertiesCard value="learning-modules" title="Learning module membership">
            <UcatStemLearningModuleMembershipCard
              stemId={stemId}
              highlighted={focusTarget === 'sets'}
            />
          </PropertiesCard>

          {fields.length > 0 ? (
            <PropertiesCard value="question" title="Question properties">
              <UcatPropertyRow label="Tags">
                <div className={cn('space-y-1', focusTarget === 'tags' && 'rounded-md ring-2 ring-amber-400 ring-offset-2 ring-offset-background')}>
                  <QuestionTagsSelect questionIndex={safeQuestionIndex} form={form} tags={tags} compact />
                  {detectedTagsLabel ? (
                    <UcatDetectedStemMetadataPill
                      propertyLabel="Tags"
                      value={detectedTagsLabel}
                      currentValue={currentTagsLabel}
                      detectedValue={detectedTagsLabel}
                      explanation="The parser matched the active question's wording and structure to these tags. Accepting will replace the current tags for this question."
                      evidence={detectedTagIds.map((tagId) => {
                        const label = taxonomyDisplayLabel(
                          tags.find((tag) => tag.id === tagId) ?? { name: 'Unknown tag' },
                        )
                        return `Matched the ${label} tag pattern`
                      })}
                      onAccept={() => metadataDetection?.onAccept(`tags:${safeQuestionIndex}`)}
                      onDismiss={() => metadataDetection?.onDismiss(`tags:${safeQuestionIndex}`)}
                    />
                  ) : null}
                </div>
              </UcatPropertyRow>
              {focusTarget === 'explanation' ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  Add the missing explanation in the question editor on the left.
                </div>
              ) : null}
              {fields.length > 1 ? (
                <div className="text-xs font-medium text-muted-foreground">Question {safeQuestionIndex + 1}</div>
              ) : null}
              <UcatPropertyRow
                label={(
                  <PropertyHint
                    label="Difficulty"
                    hint="Expected proportion incorrect: 0 easiest, 1 hardest. Leave blank if unknown."
                  />
                )}
              >
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  placeholder="0.50"
                  aria-label="Difficulty"
                  className="h-9"
                  {...form.register(`questions.${safeQuestionIndex}.difficulty`, {
                    setValueAs: (value) => {
                      if (value === '' || value == null) return null
                      const parsed = typeof value === 'number' ? value : Number(value)
                      return Number.isFinite(parsed) ? parsed : null
                    },
                  })}
                />
              </UcatPropertyRow>
              <UcatPropertyRow
                label={(
                  <PropertyHint
                    label="Expected time"
                    hint="First-exposure working time in authored stem order. Leave blank if unknown."
                  />
                )}
              >
                <Input
                  type="text"
                  className="h-9"
                  placeholder="1:30 or 90"
                  aria-label="Expected time "
                  {...form.register(`questions.${safeQuestionIndex}.timeBurdenSeconds`)}
                />
              </UcatPropertyRow>
            </PropertiesCard>
          ) : null}

          <PropertiesCard value="source" title="Source">
            <UcatPropertyRow label="Stem">
              <ReadOnlyValue>{formatSourceChannel(sourceChannel)}</ReadOnlyValue>
            </UcatPropertyRow>
            {sourceChannel === 'ai_generation' ? (
              <>
                <UcatPropertyRow label="Model">
                  <ReadOnlyValue>{aiModel ?? 'Unknown'}</ReadOnlyValue>
                </UcatPropertyRow>
                <UcatPropertyRow label="Generated">
                  <ReadOnlyValue>{generatedAtLabel ?? 'Unknown'}</ReadOnlyValue>
                </UcatPropertyRow>
                <UcatPropertyRow label="Generated by">
                  <ReadOnlyValue>{generatedByName ?? 'Unknown'}</ReadOnlyValue>
                </UcatPropertyRow>
              </>
            ) : (
              <UcatPropertyRow label="Created by">
                <ReadOnlyValue>{generatedByName ?? 'Unknown'}</ReadOnlyValue>
              </UcatPropertyRow>
            )}
            <UcatPropertyRow label="Approved by">
              <ReadOnlyValue>{statusChangedByName ?? '—'}</ReadOnlyValue>
            </UcatPropertyRow>
            <UcatPropertyRow label="Approved at">
              <ReadOnlyValue>{statusChangedAtLabel ?? '—'}</ReadOnlyValue>
            </UcatPropertyRow>
            {fields.length > 0 ? (
              <>
                <div className="my-2 border-t border-black/[0.06] dark:border-white/10" />
                {fields.length > 1 ? (
                  <div className="text-xs font-medium text-muted-foreground">Question {safeQuestionIndex + 1}</div>
                ) : null}
                <UcatPropertyRow label="Question">
                  <ReadOnlyValue>
                    {formatSourceChannel(activeQuestion?.sourceChannel ?? sourceChannel ?? null)}
                  </ReadOnlyValue>
                </UcatPropertyRow>
                {(activeQuestion?.sourceChannel ?? sourceChannel) === 'ai_generation' ? (
                  <>
                    <UcatPropertyRow label="Model">
                      <ReadOnlyValue>
                        {metadataString(activeQuestion?.aiGenerationMetadata ?? null, 'model') ?? 'Unknown'}
                      </ReadOnlyValue>
                    </UcatPropertyRow>
                    <UcatPropertyRow label="Generated">
                      <ReadOnlyValue>
                        {formatGeneratedTimestamp(
                          metadataString(activeQuestion?.aiGenerationMetadata ?? null, 'generatedAt'),
                        ) ?? 'Unknown'}
                      </ReadOnlyValue>
                    </UcatPropertyRow>
                    <UcatPropertyRow label="Generated by">
                      <ReadOnlyValue>{generatedByName ?? 'Unknown'}</ReadOnlyValue>
                    </UcatPropertyRow>
                  </>
                ) : null}
              </>
            ) : null}
            <div className="my-2 border-t border-black/[0.06] dark:border-white/10" />
            <div className="space-y-1.5 py-1.5">
              <label className="text-sm text-muted-foreground" htmlFor="ucat-tutor-source-note">
                Tutor source note
              </label>
              <Textarea
                id="ucat-tutor-source-note"
                className="min-h-20 resize-y text-sm"
                placeholder="e.g. Altitutor mock 3, official practice bank, in-house worksheet"
                {...form.register('tutorSourceNote')}
              />
            </div>
          </PropertiesCard>
        </Accordion>
      </div>
        </TabsContent>
        <TabsContent
          forceMount
          value="ai"
          className={cn('h-full min-h-0 flex-1 overflow-hidden', activeTab !== 'ai' && 'hidden')}
        >
          <UcatAuthoringAgentChat
            contextType="question_stem"
            scope="current_stem"
            scopeLabel={`Question ${safeQuestionIndex + 1}`}
            conversationKey={stemId ? `question-stem:${stemId}` : null}
            snapshot={{
              currentQuestionIndex: safeQuestionIndex,
              currentQuestionNumber: safeQuestionIndex + 1,
              stem: form.getValues(),
              availableTags: tags.map((tag) => ({
                id: tag.id,
                name: tag.name,
                label: tag.label ?? tag.name,
              })),
              availableCategories: categories.map((category) => ({
                id: category.id,
                name: category.name,
                label: category.label ?? category.name,
                sectionId: category.ucat_section_id,
              })),
              availableSections: sections.map((section) => ({
                id: section.id,
                name: section.name,
              })),
            } as Json}
            selectedImage={selectedImage ? {
              label: selectedImage.label,
              src: selectedImage.src,
              fileId: selectedImage.fileId,
              location: selectedImage.location,
              visualType: selectedImage.visualType,
              visualSpec: selectedImage.visualSpec as Json | null,
              visualTitle: selectedImage.visualTitle,
              visualAltText: selectedImage.visualAltText,
            } : null}
            placeholder={selectedImage?.src?.startsWith('data:image/svg+xml')
              ? 'Describe how this SVG should become an editable Venn, set, or Vega visual...'
              : selectedImage
                ? 'Describe how you want the selected image changed...'
                : 'Ask AI to edit this question stem...'}
            onExecuteTool={executeStemAgentTool}
            onAcceptImagePreview={onAcceptSelectedImage}
          />
        </TabsContent>
        {aiReviewAvailable && (stemId || bulkImportAiReview) ? (
          <TabsContent
            forceMount
            value="review"
            className={cn('flex h-full min-h-0 flex-1 flex-col overflow-hidden', activeTab !== 'review' && 'hidden')}
          >
            {bulkImportAiReview ? (
              <BulkImportAiReviewPanel
                {...bulkImportAiReview}
                activeQuestionId={activeQuestion?.id ?? null}
                activeQuestionIndex={safeQuestionIndex}
              />
            ) : stemId ? (
              <UcatAiAssessmentControl
                stemId={stemId}
                form={form}
                activeQuestionIndex={safeQuestionIndex}
                onActiveQuestionIndexChange={onQuestionIndexChange}
              />
            ) : null}
          </TabsContent>
        ) : null}
      </Tabs>
    </aside>
  )
}
