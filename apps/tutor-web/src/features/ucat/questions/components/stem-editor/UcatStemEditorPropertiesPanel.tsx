'use client'

import { useState, type ReactNode } from 'react'
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
  useToast,
} from '@altitutor/ui'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { SegmentedControl } from '@/shared/components/segmented-control'
import { cn } from '@/shared/utils'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { UcatQuestionSourceChannel } from '@/features/ucat/questions/api/questions'
import { formatSourceChannel, formatGeneratedTimestamp, formatStaffDisplayName, metadataString } from '@/features/ucat/questions/lib/source-display'
import { DEFAULT_OPTIONS, EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
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
  applyStemTypeSwitch,
  isSyllogismCategory,
} from '@/features/ucat/questions/components/stem-editor/stemEditorStemType'
import { UcatStemSetMembershipCard } from '@/features/ucat/questions/components/stem-editor/UcatStemSetMembershipCard'
import { UcatAuthoringAgentChat } from '@/features/ucat/authoring-agent/UcatAuthoringAgentChat'
import type { UcatAuthoringToolCall, UcatAuthoringToolResult } from '@/features/ucat/authoring-agent/types'
import { appendImageNode, appendImageNodeToDoc, replaceFirstImageNode, replaceFirstImageNodeInDoc } from '@/features/ucat/authoring-agent/rich-text-image'
import { generatedVisualBlockToImageNode, getGeneratedVisualSpecIssue } from '@/features/ucat/questions/lib/ai-generation/content-blocks'
import type { GeneratedContentBlock } from '@/features/ucat/questions/lib/ai-generation/schema'
import type { UcatAuthoringWorkspaceTab } from '@/features/ucat/shared/components/UcatAuthoringWorkspaceTabs'
import type { SelectedVisualImage } from '@/features/ucat/shared/lib/selected-visual-image'

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
  className?: string
}

function trimTextParagraphs(text: string): string {
  return text
    .split(/\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/^\s*\n+/, '')
    .replace(/\n+\s*$/, '')
    .trim()
}

function PropertyRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 w-[58%]">{children}</div>
    </div>
  )
}

function ReadOnlyValue({ children }: { children: ReactNode }) {
  return <span className="block text-right text-sm text-foreground">{children}</span>
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
  className,
}: UcatStemEditorPropertiesPanelProps) {
  const { toast } = useToast()
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'questions' })
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<'properties' | 'ai'>('properties')
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab

  function handleActiveTabChange(value: string) {
    const next = value as 'properties' | 'ai'
    setUncontrolledActiveTab(next)
    onActiveTabChange?.(next)
  }

  const sectionId = form.watch('sectionId')
  const watchedStem = form.watch()
  const stemType = (form.watch('questions.0.questionType') ?? 'multiple_choice') as
    | 'multiple_choice'
    | 'syllogism'
  const isSyllogism = stemType === 'syllogism'
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

  function handleCategoryChange(nextCategoryId: string | null): void {
    const nextCategory = categories.find((category) => category.id === nextCategoryId)
    const nextIsSyllogismCategory = isSyllogismCategory(nextCategory)
    if (nextIsSyllogismCategory) {
      const ok = applyStemTypeSwitch(form, 'syllogism', sections, categories)
      if (!ok) return
      onQuestionIndexChange(0)
      return
    }
    if (isSyllogism) {
      const ok = applyStemTypeSwitch(form, 'multiple_choice', sections, categories)
      if (!ok) return
    }
    form.setValue('categoryId', nextCategoryId, {
      shouldDirty: true,
    })
  }

  const handleDeleteQuestion = (questionIndex: number) => {
    const questions = form.getValues('questions') ?? []
    const question = questions[questionIndex]

    const hasQuestionText =
      question &&
      trimTextParagraphs(proseMirrorToPlainText((question.questionText as Json) ?? EMPTY_DOC) ?? '') !==
        ''
    const hasOptionContent =
      question &&
      (question.options ?? []).some((opt) => {
        const answerText = trimTextParagraphs(
          proseMirrorToPlainText((opt.answerText as Json) ?? EMPTY_DOC) ?? ''
        )
        const answerExplanation = opt.answerExplanation
          ? trimTextParagraphs(proseMirrorToPlainText((opt.answerExplanation as Json) ?? EMPTY_DOC) ?? '')
          : ''
        return answerText !== '' || answerExplanation !== ''
      })

    if (!hasQuestionText && !hasOptionContent) {
      remove(questionIndex)
      if (safeQuestionIndex >= questionIndex && safeQuestionIndex > 0) {
        onQuestionIndexChange(safeQuestionIndex - 1)
      }
      return
    }

    if (
      window.confirm(
        'This will delete a question with content. Changes will be lost. Do you want to continue?'
      )
    ) {
      remove(questionIndex)
      if (safeQuestionIndex >= questionIndex && safeQuestionIndex > 0) {
        onQuestionIndexChange(safeQuestionIndex - 1)
      }
    }
  }

  const handleAddQuestion = () => {
    append({
      questionText: EMPTY_DOC,
      questionType: stemType,
      answerExplanation: null,
      difficulty: null,
      timeBurdenSeconds: '',
      tagIds: [],
      sourceChannel: 'individual',
      aiGenerationMetadata: null,
      options: isSyllogism
        ? Array.from({ length: 5 }, () => ({
            answerText: EMPTY_DOC,
            answerExplanation: null,
            isAnswer: false,
          }))
        : [...DEFAULT_OPTIONS],
    })
    onQuestionIndexChange(fields.length)
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
        if (typeof input.sectionId === 'string') form.setValue('sectionId', input.sectionId, { shouldDirty: true })
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
          questionType: 'multiple_choice' as const,
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
                  isAnswer: record.isAnswer === true,
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
              isAnswer: input.isAnswer === true,
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
        if (typeof input.isAnswer === 'boolean') {
          form.setValue(`questions.${questionIndex}.options.${optionIndex}.isAnswer`, input.isAnswer, { shouldDirty: true })
        }
        return { toolCallId: toolCall.id, ok: true, message: `Updated answer option ${optionIndex + 1}.` }

      case 'markCorrectAnswer':
        if (questionIndex == null || optionIndex == null || !current.questions[questionIndex]?.options[optionIndex]) {
          return { toolCallId: toolCall.id, ok: false, message: 'Answer option not found.' }
        }
        form.setValue(
          `questions.${questionIndex}.options`,
          current.questions[questionIndex].options.map((option, index) => ({
            ...option,
            isAnswer: index === optionIndex,
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
    <aside className={cn('flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden bg-background p-3 lg:w-80 lg:border-l lg:p-4', className)}>
      <Tabs value={activeTab} onValueChange={handleActiveTabChange} className="flex h-full min-h-0 flex-1 flex-col">
        <div className="hidden lg:block">
          <SegmentedControl
            fullWidth
            value={activeTab}
            onValueChange={(value) => handleActiveTabChange(value)}
            options={[
              { value: 'properties', label: 'Properties' },
              { value: 'ai', label: 'AI tools' },
            ]}
          />
        </div>
        <TabsContent value="properties" className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-4">
        {showModeControls ? (
          <div className={tutorCardCn('space-y-4 p-3')}>
            <PropertyRow label="Mode">
              <SegmentedControl
                fullWidth
                value={editorMode}
                onValueChange={onEditorModeChange}
                options={[
                  { value: 'edit', label: 'Edit' },
                  { value: 'view', label: 'View' },
                ]}
              />
            </PropertyRow>
            {editorMode === 'view' ? (
              <PropertyRow label="Answer">
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
              </PropertyRow>
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
          defaultValue={['questions', 'ai', 'stem', 'sets', 'question', 'source']}
          className="space-y-4"
        >
          <PropertiesCard value="questions" title="Questions">
            <ul className="space-y-1">
              {fields.map((field, index) => {
                const isActive = index === safeQuestionIndex
                return (
                  <li key={field.id}>
                    <div
                      className={cn(
                        'flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted/60',
                        isActive && 'bg-muted font-medium'
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => onQuestionIndexChange(index)}
                      >
                        Question {index + 1}
                      </button>
                      {fields.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 !text-destructive hover:!text-destructive hover:bg-destructive/10"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteQuestion(index)
                          }}
                          aria-label={`Delete question ${index + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
            {!isSyllogism ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1"
                onClick={handleAddQuestion}
              >
                <Plus className="h-4 w-4" />
                Add question
              </Button>
            ) : null}
          </PropertiesCard>

          <PropertiesCard value="stem" title="Stem properties">
            <PropertyRow label="Section">
              <SearchableSelect<{ id: string | null; name: string | null }>
                items={sections}
                value={sections.find((s) => (s.id ?? '') === sectionId) ?? null}
                onValueChange={(section) => {
                  if (isSyllogism) {
                    toast({ description: 'Section is locked for syllogism stems.', variant: 'destructive' })
                    return
                  }
                  form.setValue('sectionId', section?.id ?? '', { shouldDirty: true })
                  form.setValue('categoryId', null, { shouldDirty: true })
                }}
                getItemLabel={(s) => s.name ?? 'Untitled'}
                getItemId={(s) => s.id ?? ''}
                placeholder="Select section"
              />
            </PropertyRow>
            <PropertyRow label="Category">
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
                />
              </div>
            </PropertyRow>
            <PropertyRow label="Access scope">
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
              />
            </PropertyRow>
            <PropertyRow label="Type">
              <SearchableSelect<{ value: 'multiple_choice' | 'syllogism'; label: string }>
                items={[
                  { value: 'multiple_choice', label: 'Multiple Choice' },
                  { value: 'syllogism', label: 'Syllogism' },
                ]}
                value={
                  isSyllogism
                    ? { value: 'syllogism', label: 'Syllogism' }
                    : { value: 'multiple_choice', label: 'Multiple Choice' }
                }
                onValueChange={(item) => {
                  if (!item) return
                  const ok = applyStemTypeSwitch(form, item.value, sections, categories)
                  if (!ok) return
                  if (item.value === 'syllogism') {
                    onQuestionIndexChange(0)
                  }
                }}
                getItemLabel={(i) => i.label}
                getItemId={(i) => i.value}
              />
            </PropertyRow>
          </PropertiesCard>

          <PropertiesCard value="sets" title="Set membership">
            <UcatStemSetMembershipCard
              stemId={stemId}
              stemSectionId={sectionId}
              highlighted={focusTarget === 'sets'}
            />
          </PropertiesCard>

          {fields.length > 0 ? (
            <PropertiesCard value="question" title="Question properties">
              <PropertyRow label="Tags">
                <div className={cn(focusTarget === 'tags' && 'rounded-md ring-2 ring-amber-400 ring-offset-2 ring-offset-background')}>
                  <QuestionTagsSelect questionIndex={safeQuestionIndex} form={form} tags={tags} compact />
                </div>
              </PropertyRow>
              {focusTarget === 'explanation' ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  Add the missing explanation in the question editor on the left.
                </div>
              ) : null}
              {fields.length > 1 ? (
                <div className="text-xs font-medium text-muted-foreground">Question {safeQuestionIndex + 1}</div>
              ) : null}
              <PropertyRow label="Difficulty">
                <Input
                  type="number"
                  step="0.01"
                  className="h-9"
                  {...form.register(`questions.${safeQuestionIndex}.difficulty`)}
                />
              </PropertyRow>
              <PropertyRow label="Time burden">
                <Input
                  type="text"
                  className="h-9"
                  placeholder="1:30 or 90"
                  {...form.register(`questions.${safeQuestionIndex}.timeBurdenSeconds`)}
                />
              </PropertyRow>
            </PropertiesCard>
          ) : null}

          <PropertiesCard value="source" title="Source">
            <PropertyRow label="Stem">
              <ReadOnlyValue>{formatSourceChannel(sourceChannel)}</ReadOnlyValue>
            </PropertyRow>
            {sourceChannel === 'ai_generation' ? (
              <>
                <PropertyRow label="Model">
                  <ReadOnlyValue>{aiModel ?? 'Unknown'}</ReadOnlyValue>
                </PropertyRow>
                <PropertyRow label="Generated">
                  <ReadOnlyValue>{generatedAtLabel ?? 'Unknown'}</ReadOnlyValue>
                </PropertyRow>
                <PropertyRow label="Generated by">
                  <ReadOnlyValue>{generatedByName ?? 'Unknown'}</ReadOnlyValue>
                </PropertyRow>
              </>
            ) : (
              <PropertyRow label="Created by">
                <ReadOnlyValue>{generatedByName ?? 'Unknown'}</ReadOnlyValue>
              </PropertyRow>
            )}
            <PropertyRow label="Approved by">
              <ReadOnlyValue>{statusChangedByName ?? '—'}</ReadOnlyValue>
            </PropertyRow>
            <PropertyRow label="Approved at">
              <ReadOnlyValue>{statusChangedAtLabel ?? '—'}</ReadOnlyValue>
            </PropertyRow>
            {fields.length > 0 ? (
              <>
                <div className="my-2 border-t border-black/[0.06] dark:border-white/10" />
                {fields.length > 1 ? (
                  <div className="text-xs font-medium text-muted-foreground">Question {safeQuestionIndex + 1}</div>
                ) : null}
                <PropertyRow label="Question">
                  <ReadOnlyValue>
                    {formatSourceChannel(activeQuestion?.sourceChannel ?? sourceChannel ?? null)}
                  </ReadOnlyValue>
                </PropertyRow>
                {(activeQuestion?.sourceChannel ?? sourceChannel) === 'ai_generation' ? (
                  <>
                    <PropertyRow label="Model">
                      <ReadOnlyValue>
                        {metadataString(activeQuestion?.aiGenerationMetadata ?? null, 'model') ?? 'Unknown'}
                      </ReadOnlyValue>
                    </PropertyRow>
                    <PropertyRow label="Generated">
                      <ReadOnlyValue>
                        {formatGeneratedTimestamp(
                          metadataString(activeQuestion?.aiGenerationMetadata ?? null, 'generatedAt'),
                        ) ?? 'Unknown'}
                      </ReadOnlyValue>
                    </PropertyRow>
                    <PropertyRow label="Generated by">
                      <ReadOnlyValue>{generatedByName ?? 'Unknown'}</ReadOnlyValue>
                    </PropertyRow>
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
      </Tabs>
    </aside>
  )
}
