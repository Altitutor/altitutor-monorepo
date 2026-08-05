'use client'

import { useCallback, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useFieldArray } from 'react-hook-form'
import { Button } from '@altitutor/ui'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/shared/utils'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { DEFAULT_OPTIONS, EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { stemEditorQuestionHasContent } from '@/features/ucat/questions/components/stem-editor/stemEditorQuestionContent'

type UcatStemQuestionNavigatorProps = {
  form: UseFormReturn<UcatQuestionStemFormValues>
  currentQuestionIndex: number
  onQuestionIndexChange: (index: number) => void
  /** When true, only one question is allowed and add/delete controls are hidden. */
  isSyllogism?: boolean
  className?: string
}

export function UcatStemQuestionNavigator({
  form,
  currentQuestionIndex,
  onQuestionIndexChange,
  isSyllogism = false,
  className,
}: UcatStemQuestionNavigatorProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'questions' })
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null)

  const safeQuestionIndex =
    fields.length > 0 ? Math.min(Math.max(0, currentQuestionIndex), fields.length - 1) : 0

  const stemType = (form.watch('questions.0.questionType') ?? 'multiple_choice') as
    | 'multiple_choice'
    | 'syllogism'

  const performDelete = useCallback(
    (questionIndex: number) => {
      remove(questionIndex)
      if (safeQuestionIndex >= questionIndex && safeQuestionIndex > 0) {
        onQuestionIndexChange(safeQuestionIndex - 1)
      }
    },
    [onQuestionIndexChange, remove, safeQuestionIndex],
  )

  const handleDeleteQuestion = useCallback(
    (questionIndex: number) => {
      const questions = form.getValues('questions') ?? []
      const question = questions[questionIndex]

      if (!stemEditorQuestionHasContent(question)) {
        performDelete(questionIndex)
        return
      }

      setDeleteConfirmIndex(questionIndex)
    },
    [form, performDelete],
  )

  const handleAddQuestion = useCallback(() => {
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
  }, [append, fields.length, isSyllogism, onQuestionIndexChange, stemType])

  if (fields.length === 0) return null

  return (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-border bg-background px-3 py-2',
          className,
        )}
      >
        <div
          className="relative inline-flex min-w-0 flex-1 overflow-x-auto overscroll-x-contain rounded-[var(--radius)] bg-muted/90 p-0.5 ring-1 ring-black/[0.06] dark:ring-white/10"
          role="tablist"
          aria-label="Questions"
        >
          {fields.map((field, index) => {
            const isActive = index === safeQuestionIndex
            const showDelete = fields.length > 1

            return (
              <div
                key={field.id}
                className={cn(
                  'relative z-10 inline-flex min-w-0 items-stretch rounded-[calc(var(--radius)_-_0.125rem)] text-xs',
                  isActive
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-black/[0.05] dark:ring-white/[0.07]'
                    : 'text-foreground hover:bg-muted/80',
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onQuestionIndexChange(index)}
                  className="inline-flex min-w-0 flex-1 items-center justify-center px-3 py-1.5"
                >
                  Question {index + 1}
                </button>
                {showDelete ? (
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center justify-center rounded-r-[calc(var(--radius)_-_0.125rem)] border-l px-2 py-1.5',
                      'text-destructive transition-colors hover:bg-destructive/10',
                      isActive ? 'border-foreground/12' : 'border-black/[0.06] dark:border-white/12',
                    )}
                    aria-label={`Delete question ${index + 1}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDeleteQuestion(index)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
        {!isSyllogism ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1"
            onClick={handleAddQuestion}
          >
            <Plus className="h-4 w-4" />
            Add question
          </Button>
        ) : null}
      </div>

      <UcatDeleteConfirmDialog
        open={deleteConfirmIndex != null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmIndex(null)
        }}
        title="Delete question?"
        description="This will delete a question with content. Changes will be lost."
        onConfirm={() => {
          if (deleteConfirmIndex == null) return
          performDelete(deleteConfirmIndex)
          setDeleteConfirmIndex(null)
        }}
      />
    </>
  )
}
