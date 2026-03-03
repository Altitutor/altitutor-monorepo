'use client'

import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'
import type { QuestionItem } from '@/features/question-engine/model/types'

export function ResultsQuestionViewer({
  question,
  selectedOptionId,
  correctOptionId,
}: {
  question: QuestionItem
  selectedOptionId?: string
  correctOptionId?: string
}) {
  const isTwoColumn = question.sectionDisplayColumns === 2

  const optionLabel = (index: number) => String.fromCharCode(65 + index)

  const renderOption = (option: { id: string; text: string; answerExplanation?: string }, index: number) => {
    const isCorrect = option.id === correctOptionId
    const isSelected = option.id === selectedOptionId
    const letter = optionLabel(index)

    return (
      <div key={option.id} className="space-y-0.5">
        <div
          className={`flex items-start gap-2 pl-6 ${
            isCorrect ? 'ring-2 ring-green-600 rounded px-2 py-1 -ml-2' : ''
          } ${isSelected && !isCorrect ? 'ring-2 ring-amber-500 rounded px-2 py-1 -ml-2' : ''}`}
        >
          <span className="inline-block w-8 shrink-0">{letter}.</span>
          <span className="flex-1">{option.text}</span>
          {isCorrect && (
            <span className="text-green-700 font-medium shrink-0" style={{ fontSize: '10pt' }}>
              Correct
            </span>
          )}
          {isSelected && !isCorrect && (
            <span className="text-amber-700 font-medium shrink-0" style={{ fontSize: '10pt' }}>
              Your answer
            </span>
          )}
        </div>
        {option.answerExplanation ? (
          <div
            className="pl-14 text-[10pt]"
            style={{ color: '#5a6c7d' }}
          >
            {option.answerExplanation}
          </div>
        ) : null}
      </div>
    )
  }

  const content = (
    <div className="space-y-4 py-4 sm:py-5">
      <article className="space-y-3">
        <p>{question.stemText}</p>
      </article>
      <section className="space-y-3">
        <h4 className="font-medium text-[12pt]">{question.questionText}</h4>
        <div className="space-y-2">
          {question.options.map((opt, i) => renderOption(opt, i))}
        </div>
        {question.answerExplanation ? (
          <div
            className="mt-3 pt-3 border-t border-[#9ba9bd] text-[10pt]"
            style={{ color: '#5a6c7d' }}
          >
            {question.answerExplanation}
          </div>
        ) : null}
      </section>
    </div>
  )

  if (isTwoColumn) {
    return (
      <div className={`flex h-full min-h-0 gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}>
        <article
          className="flex-[3] h-full min-w-0 overflow-y-auto border-r-[6px] pr-4 py-4 sm:py-5"
          style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
        >
          <div className="space-y-3">
            <p>{question.stemText}</p>
          </div>
        </article>
        <section className="flex-[2] h-full min-w-0 overflow-y-auto pl-2 pr-1 py-4 sm:py-5">
          <div className="space-y-3">
            <h4 className="font-medium text-[12pt]">{question.questionText}</h4>
            <div className="space-y-2">
              {question.options.map((opt, i) => renderOption(opt, i))}
            </div>
            {question.answerExplanation ? (
              <div
                className="mt-3 pt-3 border-t border-[#9ba9bd] text-[10pt]"
                style={{ color: '#5a6c7d' }}
              >
                {question.answerExplanation}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={`h-full overflow-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}>
      {content}
    </div>
  )
}
