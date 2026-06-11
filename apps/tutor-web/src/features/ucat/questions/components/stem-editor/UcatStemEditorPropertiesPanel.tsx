'use client'

import type { ReactNode } from 'react'
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
  useToast,
} from '@altitutor/ui'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { SegmentedControl } from '@/shared/components/segmented-control'
import { cn } from '@/shared/utils'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { DEFAULT_OPTIONS, EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
import {
  QuestionTagsSelect,
  type CategoryOption,
  type TagOption,
  type UcatSectionOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import { applyStemTypeSwitch } from '@/features/ucat/questions/components/stem-editor/stemEditorStemType'

export type StemEditorMode = 'edit' | 'view'

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

function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 w-[58%]">{children}</div>
    </div>
  )
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
}: UcatStemEditorPropertiesPanelProps) {
  const { toast } = useToast()
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'questions' })

  const sectionId = form.watch('sectionId')
  const stemType = (form.watch('questions.0.questionType') ?? 'multiple_choice') as
    | 'multiple_choice'
    | 'syllogism'
  const isSyllogism = stemType === 'syllogism'

  const categoriesFiltered = sectionId
    ? categories.filter((c) => (c.ucat_section_id ?? null) === sectionId)
    : []

  const safeQuestionIndex =
    fields.length > 0 ? Math.min(Math.max(0, currentQuestionIndex), fields.length - 1) : 0

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

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l bg-background p-4">
      <div className="space-y-4">
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

        <Accordion
          type="multiple"
          defaultValue={['questions', 'stem', 'question']}
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
                  if (isSyllogism) {
                    toast({ description: 'Category is locked for syllogism stems.', variant: 'destructive' })
                    return
                  }
                  form.setValue('categoryId', item?.id === 'none' ? null : item?.id ?? null, {
                    shouldDirty: true,
                  })
                }}
                getItemLabel={(c) => taxonomyDisplayLabel(c)}
                getItemId={(c) => c.id}
                placeholder={!sectionId ? 'Select section first' : 'Select category'}
                disabled={!sectionId}
              />
            </PropertyRow>
            <PropertyRow label="Visibility">
              <SearchableSelect<{ value: 'public' | 'private'; label: string }>
                items={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                value={
                  form.watch('isPrivate')
                    ? { value: 'private', label: 'Private' }
                    : { value: 'public', label: 'Public' }
                }
                onValueChange={(item) =>
                  form.setValue('isPrivate', item?.value === 'private', { shouldDirty: true })
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

          {fields.length > 0 ? (
            <PropertiesCard value="question" title={`Question ${safeQuestionIndex + 1} properties`}>
              <PropertyRow label="Tags">
                <QuestionTagsSelect questionIndex={safeQuestionIndex} form={form} tags={tags} compact />
              </PropertyRow>
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
        </Accordion>
      </div>
    </aside>
  )
}
