'use client'

import { useEffect, useState } from 'react'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'
import type { QuestionItem } from '@/features/question-engine/model/types'

export function ResultsQuestionViewer({
  question,
  selectedOptionId,
  correctOptionId,
  points,
}: {
  question: QuestionItem
  selectedOptionId?: string
  correctOptionId?: string
  points?: number
}) {
  const isTwoColumn = question.sectionDisplayColumns === 2

  const optionLabel = (index: number) => String.fromCharCode(65 + index)
  const [animateBars, setAnimateBars] = useState(false)

  useEffect(() => {
    // Trigger bar animation when question changes
    setAnimateBars(false)
    const id = window.setTimeout(() => setAnimateBars(true), 0)
    return () => window.clearTimeout(id)
  }, [question.id])

  const renderOption = (
    option: {
      id: string
      text: string
      answerExplanation?: string
      totalAnswered?: number
      percentage?: number
    },
    index: number
  ) => {
    const optionIsCorrect = option.id === correctOptionId
    const optionIsSelected = option.id === selectedOptionId
    const letter = optionLabel(index)
    const hasStats = option.totalAnswered != null && option.totalAnswered > 0
    const pct = hasStats ? Math.max(0, option.percentage ?? 0) : 0
    const barWidth = animateBars ? Math.min(100, pct) : 0

    const bgClass = optionIsCorrect ? 'bg-green-100' : ''

    const label = optionIsCorrect
      ? { text: 'Correct', color: 'text-green-700' }
      : null

    return (
      <div key={option.id} className="space-y-0.5">
        <div className={`flex items-center gap-2 pl-6 pr-3 ${bgClass} rounded py-1`}>
          <label className="flex items-start gap-2 flex-1 min-w-0 cursor-default">
            <input
              type="radio"
              name={question.id}
              checked={optionIsSelected}
              readOnly
              disabled
              className="mt-1 h-4 w-4"
            />
            <span className="flex flex-1 min-w-0">
              <span className="inline-block w-8 shrink-0">{letter}.</span>
              <span className="ml-4 flex-1 min-w-0">{option.text}</span>
            </span>
          </label>
          {label && (
            <span className={`font-medium shrink-0 pr-2 ${label.color}`} style={{ fontSize: '10pt' }}>
              {label.text}
            </span>
          )}
          <div
            className="relative flex shrink-0 items-center justify-center h-5 w-20 rounded overflow-hidden bg-[#e8ecf0]"
            title={hasStats ? `${pct.toFixed(1)}%` : 'No data yet'}
          >
            <div
              className="absolute inset-y-0 left-0 rounded transition-all"
              style={{
                width: `${barWidth}%`,
                backgroundColor: UCAT_COLORS.toolbarBlue,
              }}
            />
            <span
              className="relative z-10 text-[10pt] tabular-nums font-medium"
              style={{
                color: pct > 50 ? 'white' : '#5a6c7d',
                textShadow: pct > 50 ? '0 0 1px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              {hasStats ? `${pct.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>
        {option.answerExplanation ? (
          <div
            className="text-[11pt] leading-relaxed"
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
        <div
          className="mt-3 pt-3 border-t border-[#9ba9bd] text-[11pt] leading-relaxed space-y-1"
          style={{ color: '#5a6c7d' }}
        >
          {typeof points === 'number' ? (
            <div className="font-medium">
              <span
                className={
                  points === 0
                    ? 'text-red-700'
                    : points > 0 && selectedOptionId === correctOptionId
                      ? 'text-green-700'
                      : 'text-amber-700'
                }
              >
                Points: {points.toFixed(1)}
              </span>
            </div>
          ) : null}
          {question.answerExplanation ? (
            <div>{question.answerExplanation}</div>
          ) : null}
        </div>
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
            <div
              className="mt-3 pt-3 border-t border-[#9ba9bd] text-[11pt] leading-relaxed space-y-1"
              style={{ color: '#5a6c7d' }}
            >
              {typeof points === 'number' ? (
                <div className="font-medium">
                  <span
                    className={
                      points === 0
                        ? 'text-red-700'
                        : points > 0 && selectedOptionId === correctOptionId
                          ? 'text-green-700'
                          : 'text-amber-700'
                    }
                  >
                    Points: {points.toFixed(1)}
                  </span>
                </div>
              ) : null}
              {question.answerExplanation ? (
                <div>{question.answerExplanation}</div>
              ) : null}
            </div>
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
