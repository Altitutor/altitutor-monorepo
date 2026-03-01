'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import type { Json } from '@altitutor/shared'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import { BulkImportQuestionNavigator } from '@/features/ucat/questions/components/bulk-import/BulkImportQuestionNavigator'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type Step4ReviewAndSubmitProps = {
  stems: BulkImportStemDraft[]
  activeIndex: number
  selectStem: (index: number) => void
}

type ReviewQuestion = UcatQuestionStemFormValues['questions'][number]
type ReviewQuestionOption = ReviewQuestion['options'][number]

function toPlain(value: Json | null | undefined): string {
  return proseMirrorToPlainText(value ?? null) ?? ''
}

export function Step4ReviewAndSubmit({
  stems,
  activeIndex,
  selectStem,
}: Step4ReviewAndSubmitProps) {
  const count = stems.length
  const current = stems[activeIndex] ?? null

  const stemPlainText =
    current != null ? toPlain(current.values.stemText as Json | null) : ''

  const totalQuestions = stems.reduce(
    (sum, stem) => sum + (stem.values.questions?.length ?? 0),
    0
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Review questions before import</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quickly scan each stem and its nested questions to make sure everything looks correct.
          When you&apos;re happy, click &quot;Import all stems&quot; to create them.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground">{count}</span> stem
            {count === 1 ? '' : 's'}
          </div>
          <div>
            <span className="font-semibold text-foreground">{totalQuestions}</span> question
            {totalQuestions === 1 ? '' : 's'}
          </div>
        </CardContent>
      </Card>

      <BulkImportQuestionNavigator
        count={count}
        activeIndex={activeIndex}
        onSelectIndex={selectStem}
        onPrevious={() => selectStem(Math.max(0, activeIndex - 1))}
        onNext={() => selectStem(Math.min(count - 1, activeIndex + 1))}
      />

      {current ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stem text</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">
                {stemPlainText !== '' ? (
                  stemPlainText
                ) : (
                  <span className="text-muted-foreground">No stem text</span>
                )}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {current.values.questions.map((question: ReviewQuestion, index: number) => {
              const questionText = toPlain(question.questionText as Json | null)
              return (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Question {index + 1}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="whitespace-pre-wrap">
                      {questionText !== '' ? (
                        questionText
                      ) : (
                        <span className="text-muted-foreground">No question text</span>
                      )}
                    </p>
                    {question.options.length > 0 && (
                      <ul className="mt-2 space-y-1 list-disc pl-5">
                        {question.options.map((option: ReviewQuestionOption, optIndex: number) => {
                          const optionText = toPlain(option.answerText as Json | null)
                          return (
                            <li key={optIndex}>
                              <span className="font-medium">
                                {option.isAnswer ? 'Correct: ' : ''}
                              </span>
                              <span>
                                {optionText !== '' ? (
                                  optionText
                                ) : (
                                  <span className="text-muted-foreground">Empty option</span>
                                )}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No parsed stems to review yet. Go back to previous steps and run parsing first.
        </p>
      )}
    </div>
  )
}

