'use client'

import { UcatRichContentBlock } from '@/features/ucat/question-engine-preview/UcatRichContentBlock'
import { cn } from '@/shared/utils'
import {
  projectAttemptReview,
  type AttemptReviewQuestion,
} from '../lib/attempt-content-snapshot'
import type { ReviewContract } from '@altitutor/ucat-response-contract'

type AttemptQuestionViewerProps = {
  question: AttemptReviewQuestion
  selectedOptionId?: string | null
  syllogismSnapshot?: Record<string, boolean> | null
  result?: 'correct' | 'partial' | 'incorrect' | 'not_attempted'
  review?: ReviewContract
}

function OptionContent({
  text,
  json,
}: {
  text: string
  json?: Record<string, unknown> | null
}) {
  return (
    <UcatRichContentBlock
      json={json}
      plainText={text}
      textTone="theme"
      className="[&_.ProseMirror]:inline"
    />
  )
}

function SyllogismResults({
  question,
  review,
}: AttemptQuestionViewerProps) {
  const options = [...question.options].sort((a, b) => a.index - b.index)

  return (
    <div className="space-y-4 py-4 sm:py-5">
      <article className="space-y-3">
        <UcatRichContentBlock
          json={question.stemJson}
          plainText={question.stemText}
          textTone="theme"
          paragraphSpacing
        />
      </article>
      <section className="space-y-3">
        <div className="text-base font-medium">
          <UcatRichContentBlock
            json={question.questionJson}
            plainText={question.questionText}
            textTone="theme"
          />
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] gap-x-1 px-3 text-xs font-medium text-muted-foreground">
            <div>Statement</div>
            <div className="text-center">Your answers</div>
            <div className="text-center">Correct answers</div>
          </div>
          <div className="space-y-1">
            {options.map((option) => {
              const row =
                review?.kind === 'placement'
                  ? review.rows.find((candidate) => candidate.targetId === option.id)
                  : undefined
              const hasAnswer = row?.placedToken != null
              const studentAnswer = row?.placedToken === 'yes'
              const correctAnswer = row?.correctToken === 'yes'
              const isCorrect = row?.outcome === 'correct'

              return (
                <div
                  key={option.id}
                  className={cn(
                    'grid grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] items-stretch gap-x-1 rounded px-3 py-0.5',
                    hasAnswer &&
                      (isCorrect ? 'bg-green-500/10' : 'bg-red-500/10')
                  )}
                >
                  <div className="flex items-center">
                    <div
                      className={cn(
                        'flex min-h-[50px] w-full items-center justify-center rounded-md border px-4 text-center text-sm',
                        hasAnswer
                          ? isCorrect
                            ? 'border-green-600/50 bg-green-500/10 dark:border-green-700/50'
                            : 'border-red-600/50 bg-red-500/10 dark:border-red-700/50'
                          : 'border-border bg-card'
                      )}
                    >
                      <OptionContent text={option.text} json={option.answerJson} />
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div
                      className={cn(
                        'flex h-9 w-20 items-center justify-center rounded-md border text-sm font-medium',
                        !hasAnswer
                          ? 'border-dashed border-muted-foreground/50 text-muted-foreground'
                          : isCorrect
                            ? 'border-green-700 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300'
                            : 'border-red-700 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                      )}
                    >
                      {studentAnswer == null
                        ? '—'
                        : studentAnswer
                          ? 'Yes'
                          : 'No'}
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="flex h-9 w-20 items-center justify-center rounded-md border border-border bg-card text-sm font-medium">
                      {correctAnswer ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}

function MultipleChoiceResults({
  question,
  review,
}: AttemptQuestionViewerProps) {
  const projected = review?.kind === 'single_select' ? review : null
  const selectedOptionId = projected?.selectedOptionId
  const correctOptionId = projected?.correctOptionId
  const answeredIncorrectly =
    selectedOptionId != null && selectedOptionId !== correctOptionId

  return (
    <div className="space-y-4 py-4 sm:py-5">
      <article className="space-y-3">
        <UcatRichContentBlock
          json={question.stemJson}
          plainText={question.stemText}
          textTone="theme"
          paragraphSpacing
        />
      </article>
      <section className="space-y-3">
        <div className="text-base font-medium">
          <UcatRichContentBlock
            json={question.questionJson}
            plainText={question.questionText}
            textTone="theme"
          />
        </div>
        <div className="space-y-2">
          {question.options.map((option, index) => {
            const isCorrect = option.id === correctOptionId
            const isSelected = option.id === selectedOptionId
            const isWrongSelection =
              answeredIncorrectly &&
              isSelected &&
              !isCorrect &&
              projected?.outcome !== 'partial'
            const isPartialSelection =
              isSelected && projected?.outcome === 'partial'
            const label = isCorrect
              ? answeredIncorrectly
                ? 'Correct answer'
                : 'Correct'
              : isPartialSelection
                ? 'Partially correct'
              : isWrongSelection
                ? 'Your answer'
                : null

            return (
              <div
                key={option.id}
                className={cn(
                  'flex flex-wrap items-start gap-x-2 gap-y-1 rounded-md py-1 pl-6 pr-3',
                  isCorrect && 'bg-green-500/10',
                  isPartialSelection && 'bg-amber-500/10',
                  isWrongSelection && 'bg-red-500/10'
                )}
              >
                <label className="flex min-w-0 flex-[1_1_12rem] cursor-default items-start gap-2">
                  <input
                    type="radio"
                    name={question.id}
                    checked={isSelected}
                    readOnly
                    disabled
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span className="flex min-w-0 flex-1">
                    <span className="inline-block w-8 shrink-0">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <span className="ml-4 min-w-0 flex-1">
                      <OptionContent text={option.text} json={option.answerJson} />
                    </span>
                  </span>
                </label>
                {label ? (
                  <span
                    className={cn(
                      'ml-auto w-24 shrink-0 text-center text-xs font-medium',
                      isCorrect
                        ? 'text-green-700 dark:text-green-400'
                        : isPartialSelection
                          ? 'text-amber-700 dark:text-amber-400'
                        : 'text-red-700 dark:text-red-400'
                    )}
                  >
                    {label}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export function AttemptQuestionViewer(props: AttemptQuestionViewerProps) {
  const review = projectAttemptReview({
    question: props.question,
    selectedOptionId: props.selectedOptionId,
    binaryPlacements: props.syllogismSnapshot,
  })
  return props.question.answerScheme === 'decision_making_binary_placement' ? (
    <SyllogismResults {...props} review={review} />
  ) : (
    <MultipleChoiceResults {...props} review={review} />
  )
}
