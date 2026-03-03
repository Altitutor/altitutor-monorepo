import { useState, type DragEventHandler } from 'react'
import type { QuestionItem } from '@/features/question-engine/model/types'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'

type QuestionContentProps = {
  question: QuestionItem
  selectedOptionId?: string
  onSelectOption: (optionId: string) => void
  syllogismSnapshot?: Record<string, boolean>
  onChangeSyllogismSnapshot?: (snapshot: Record<string, boolean>) => void
}

function SyllogismQuestionContent({
  question,
  syllogismSnapshot,
  onChangeSyllogismSnapshot,
}: QuestionContentProps) {
  const isTwoColumn = question.sectionDisplayColumns === 2

  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>(
    () => {
      const initial: Record<string, 'yes' | 'no'> = {}
      if (syllogismSnapshot) {
        for (const [optionId, value] of Object.entries(syllogismSnapshot)) {
          initial[optionId] = value ? 'yes' : 'no'
        }
      }
      return initial
    }
  )

  const syncSnapshot = (next: Record<string, 'yes' | 'no'>) => {
    if (!onChangeSyllogismSnapshot) return
    const snapshot: Record<string, boolean> = {}
    for (const [optionId, choice] of Object.entries(next)) {
      snapshot[optionId] = choice === 'yes'
    }
    onChangeSyllogismSnapshot(snapshot)
  }

  const handleAssign = (optionId: string, choice: 'yes' | 'no') => {
    setAnswers((prev) => {
      const next = { ...prev, [optionId]: choice }
      syncSnapshot(next)
      return next
    })
  }

  const makeHandleDrop =
    (optionId: string): DragEventHandler<HTMLDivElement> =>
    (event) => {
      event.preventDefault()
      const choice = event.dataTransfer.getData('ucat-syllogism-choice') as
        | 'yes'
        | 'no'
        | ''
      if (choice !== 'yes' && choice !== 'no') return

      const fromOptionId = event.dataTransfer.getData('ucat-syllogism-source') || null

      setAnswers((prev) => {
        const next = { ...prev }
        if (fromOptionId && fromOptionId !== optionId) {
          delete next[fromOptionId]
        }
        next[optionId] = choice
        syncSnapshot(next)
        return next
      })
    }

  const handleDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault()
  }

  const handleTokenAreaDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault()
    const fromOptionId = event.dataTransfer.getData('ucat-syllogism-source') || null
    if (!fromOptionId) return

    setAnswers((prev) => {
      if (!prev[fromOptionId]) return prev
      const next = { ...prev }
      delete next[fromOptionId]
      syncSnapshot(next)
      return next
    })
  }

  const content = (
    <section className="space-y-4">
      <h4 className="font-medium text-[12pt]">{question.questionText}</h4>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-3">
          {question.options.map((option) => {
            const choice = answers[option.id] ?? null
            return (
              <div
                key={option.id}
                className="flex flex-row items-stretch gap-4"
              >
                <div className="flex-1">
                  <div className="flex min-h-[50px] items-center justify-center rounded border border-[#000000] bg-white px-4 text-center">
                    <span className="whitespace-pre-wrap">{option.text}</span>
                  </div>
                </div>
                <div
                  className="flex h-12 w-24 items-center justify-center rounded border border-dashed border-[#4b5563] bg-slate-50 text-[11pt]"
                  onDrop={makeHandleDrop(option.id)}
                  onDragOver={handleDragOver}
                  role="button"
                  tabIndex={0}
                  aria-label="Drop Yes or No here"
                  onClick={() => handleAssign(option.id, choice === 'yes' ? 'no' : 'yes')}
                >
                  {choice ? (
                    <div
                      className="flex h-9 w-20 items-center justify-center rounded border border-black bg-white text-[11pt] font-medium"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('ucat-syllogism-choice', choice)
                        event.dataTransfer.setData('ucat-syllogism-source', option.id)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                    >
                      {choice === 'yes' ? 'Yes' : 'No'}
                    </div>
                  ) : (
                    <span className="text-[9pt] text-transparent">_</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-1 w-[139px] rounded border border-black bg-[#dfdfdf] px-2 py-2">
          <div
            className="flex h-full w-full flex-col items-center justify-start gap-2"
            onDrop={handleTokenAreaDrop}
            onDragOver={handleDragOver}
          >
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('ucat-syllogism-choice', 'yes')
                event.dataTransfer.setData('ucat-syllogism-source', '')
                event.dataTransfer.effectAllowed = 'copy'
              }}
              className="flex h-9 w-20 items-center justify-center rounded border border-black bg-white text-[11pt] font-medium"
            >
              Yes
            </button>
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('ucat-syllogism-choice', 'no')
                event.dataTransfer.setData('ucat-syllogism-source', '')
                event.dataTransfer.effectAllowed = 'copy'
              }}
              className="flex h-9 w-20 items-center justify-center rounded border border-black bg-white text-[11pt] font-medium"
            >
              No
            </button>
          </div>
        </div>
      </div>
    </section>
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
          {content}
        </section>
      </div>
    )
  }

  return (
    <div className={`h-full overflow-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}>
      <div className="space-y-4 py-4 sm:py-5">
        <article className="space-y-3">
          <p>{question.stemText}</p>
        </article>
        {content}
      </div>
    </div>
  )
}

export function QuestionContent({
  question,
  selectedOptionId,
  onSelectOption,
  syllogismSnapshot,
  onChangeSyllogismSnapshot,
}: QuestionContentProps) {
  const isTwoColumn = question.sectionDisplayColumns === 2

  if (question.questionType === 'syllogism') {
    return (
      <SyllogismQuestionContent
        question={question}
        selectedOptionId={selectedOptionId}
        onSelectOption={onSelectOption}
        syllogismSnapshot={syllogismSnapshot}
        onChangeSyllogismSnapshot={onChangeSyllogismSnapshot}
      />
    )
  }

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
            <div className="space-y-2 pl-6">
              {question.options.map((option, index) => {
                const letter = String.fromCharCode(65 + index)
                return (
                  <label key={option.id} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={question.id}
                      checked={selectedOptionId === option.id}
                      onChange={() => onSelectOption(option.id)}
                      className="mt-1 h-4 w-4"
                    />
                    <span className="flex">
                      <span className="inline-block w-8">{letter}.</span>
                      <span className="ml-4">{option.text}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={`h-full overflow-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}>
      <div className="space-y-4 py-4 sm:py-5">
        <article className="space-y-3">
          <p>{question.stemText}</p>
        </article>
        <section className="space-y-3">
          <h4 className="font-medium text-[12pt]">{question.questionText}</h4>
          <div className="space-y-2 pl-6">
            {question.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index)
              return (
                <label key={option.id} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name={question.id}
                    checked={selectedOptionId === option.id}
                    onChange={() => onSelectOption(option.id)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="flex">
                    <span className="inline-block w-8">{letter}.</span>
                    <span className="ml-4">{option.text}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

