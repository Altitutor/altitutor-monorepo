'use client'

import { useId, useState, type DragEventHandler, type ReactNode } from 'react'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'
import { UcatRichContentBlock } from '@/features/ucat/question-engine-preview/UcatRichContentBlock'

const EXPLANATION_MUTED_STYLE = { color: '#5a6c7d' } as const

/** Engine UI ignores app dark theme — matches ucat-web exam shell. */
const ENGINE_LIGHT_TEXT =
  'bg-white text-black [color-scheme:light] dark:bg-white dark:text-black'

/** Mirrors ucat-web QuestionItem subset used for display-only preview. */
export type UcatEnginePreviewQuestion = {
  id: string
  sectionDisplayColumns: 1 | 2
  stemText: string
  stemJson?: Record<string, unknown> | null
  questionText: string
  questionJson?: Record<string, unknown> | null
  questionType: 'multiple_choice' | 'syllogism'
  options: Array<{
    id: string
    index: number
    text: string
    isAnswer?: boolean
    answerExplanation?: string
  }>
  answerExplanation?: string
}

type PreviewShellProps = {
  question: UcatEnginePreviewQuestion
  /** Pre-refreshed rich JSON for instant images (optional). */
  preloadedStem?: Record<string, unknown> | null
  preloadedQuestion?: Record<string, unknown> | null
  /** When true, shows MC/syllogism explanations like post-submit review. */
  showAnswerExplanations?: boolean
  /** When false, disables interaction (view-only in bulk import). */
  interactive?: boolean
}

function wrapInteractive(children: ReactNode, interactive: boolean) {
  if (interactive) return children
  return <div className="pointer-events-none select-none">{children}</div>
}

function SyllogismPreviewBody({
  question,
  preloadedContent,
  showAnswerExplanations,
}: {
  question: UcatEnginePreviewQuestion
  preloadedContent?: { stem?: Record<string, unknown> | null; question?: Record<string, unknown> | null } | null
  showAnswerExplanations?: boolean
}) {
  const isTwoColumn = question.sectionDisplayColumns === 2

  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({})


  const handleAssign = (optionId: string, choice: 'yes' | 'no') => {
    setAnswers((prev) => ({ ...prev, [optionId]: choice }))
  }

  const makeHandleDrop =
    (optionId: string): DragEventHandler<HTMLDivElement> =>
    (event) => {
      event.preventDefault()
      const choice = event.dataTransfer.getData('ucat-syllogism-choice') as '' | 'no' | 'yes'
      if (choice !== 'yes' && choice !== 'no') return

      const fromOptionId = event.dataTransfer.getData('ucat-syllogism-source') || null

      setAnswers((prev) => {
        const next = { ...prev }
        if (fromOptionId && fromOptionId !== optionId) {
          delete next[fromOptionId]
        }
        next[optionId] = choice
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
      return next
    })
  }

  const content = (
    <section className="space-y-4">
      <div className="font-medium text-[12pt]">
        <UcatRichContentBlock
          json={question.questionJson ?? undefined}
          plainText={question.questionText}
          preloadedContent={preloadedContent?.question ?? undefined}
        />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-3">
          {question.options.map((option) => {
            const choice = answers[option.id] ?? null
            return (
              <div key={option.id} className="space-y-1">
                <div className="flex flex-row items-stretch gap-4">
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
                {showAnswerExplanations && option.answerExplanation ? (
                  <div className="pl-1 text-[10pt] leading-relaxed" style={EXPLANATION_MUTED_STYLE}>
                    {option.answerExplanation}
                  </div>
                ) : null}
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
      {showAnswerExplanations && question.answerExplanation ? (
        <div
          className="mt-3 space-y-1 border-t border-[#9ba9bd] pt-3 text-[11pt] leading-relaxed"
          style={EXPLANATION_MUTED_STYLE}
        >
          {question.answerExplanation}
        </div>
      ) : null}
    </section>
  )

  if (isTwoColumn) {
    return (
      <div
        className={`flex h-full min-h-0 gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed ${ENGINE_LIGHT_TEXT}`}
      >
        <article
          className="flex-[3] h-full min-w-0 overflow-y-auto border-r-[6px] pr-4 py-4 sm:py-5"
          style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
        >
          <div className="space-y-3">
            <UcatRichContentBlock
              json={question.stemJson ?? undefined}
              plainText={question.stemText}
              preloadedContent={preloadedContent?.stem ?? undefined}
            />
          </div>
        </article>
        <section className="flex-[2] h-full min-w-0 overflow-y-auto pl-2 pr-1 py-4 sm:py-5">{content}</section>
      </div>
    )
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed ${ENGINE_LIGHT_TEXT}`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 py-4 sm:py-5">
          <article className="space-y-3">
            <UcatRichContentBlock
              json={question.stemJson ?? undefined}
              plainText={question.stemText}
              preloadedContent={preloadedContent?.stem ?? undefined}
            />
          </article>
          {content}
        </div>
      </div>
    </div>
  )
}

function MultipleChoicePreviewBody({
  question,
  preloadedContent,
  showAnswerExplanations,
}: {
  question: UcatEnginePreviewQuestion
  preloadedContent?: { stem?: Record<string, unknown> | null; question?: Record<string, unknown> | null } | null
  showAnswerExplanations?: boolean
}) {
  const radioName = useId()
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(undefined)
  const isTwoColumn = question.sectionDisplayColumns === 2

  const innerSection = (
    <div className="space-y-3">
      <div className="font-medium text-[12pt]">
        <UcatRichContentBlock
          json={question.questionJson ?? undefined}
          plainText={question.questionText}
          preloadedContent={preloadedContent?.question ?? undefined}
        />
      </div>
      <div className="space-y-2 pl-6">
        {question.options.map((option, index) => {
          const letter = String.fromCharCode(65 + index)
          const reviewHighlight = Boolean(showAnswerExplanations && option.isAnswer)
          const radioChecked = showAnswerExplanations
            ? Boolean(option.isAnswer)
            : selectedOptionId === option.id
          return (
            <div key={option.id} className="space-y-0.5">
              <label
                className={`flex items-start gap-2 text-black ${reviewHighlight ? 'rounded bg-green-100 py-1 pl-1 pr-2' : ''}`}
              >
                <input
                  type="radio"
                  name={radioName}
                  checked={radioChecked}
                  onChange={() => setSelectedOptionId(option.id)}
                  className="mt-1 h-4 w-4"
                />
                <span className="flex min-w-0">
                  <span className="inline-block w-8 shrink-0">{letter}.</span>
                  <span className="ml-4 min-w-0">{option.text}</span>
                </span>
              </label>
              {showAnswerExplanations && option.answerExplanation ? (
                <div className="ml-6 text-[11pt] leading-relaxed" style={EXPLANATION_MUTED_STYLE}>
                  {option.answerExplanation}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {showAnswerExplanations && question.answerExplanation ? (
        <div
          className="mt-3 border-t border-[#9ba9bd] pt-3 text-[11pt] leading-relaxed"
          style={EXPLANATION_MUTED_STYLE}
        >
          {question.answerExplanation}
        </div>
      ) : null}
    </div>
  )

  if (isTwoColumn) {
    return (
      <div
        className={`flex h-full min-h-0 gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed ${ENGINE_LIGHT_TEXT}`}
      >
        <article
          className="flex-[3] h-full min-w-0 overflow-y-auto border-r-[6px] pr-4 py-4 sm:py-5"
          style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
        >
          <div className="space-y-3">
            <UcatRichContentBlock
              json={question.stemJson ?? undefined}
              plainText={question.stemText}
              preloadedContent={preloadedContent?.stem ?? undefined}
            />
          </div>
        </article>
        <section className="flex-[2] h-full min-w-0 overflow-y-auto pl-2 pr-1 py-4 sm:py-5">{innerSection}</section>
      </div>
    )
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed ${ENGINE_LIGHT_TEXT}`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 py-4 sm:py-5">
          <article className="space-y-3">
            <UcatRichContentBlock
              json={question.stemJson ?? undefined}
              plainText={question.stemText}
              preloadedContent={preloadedContent?.stem ?? undefined}
            />
          </article>
          <section className="space-y-3">{innerSection}</section>
        </div>
      </div>
    </div>
  )
}

/** Parity with ucat-web QuestionContent: fonts, two-column stem layout, MC radios, syllogism drag UI. */
export function UcatQuestionEnginePreview({
  question,
  preloadedStem,
  preloadedQuestion,
  showAnswerExplanations = false,
  interactive = true,
}: PreviewShellProps) {
  const preloaded =
    preloadedStem != null || preloadedQuestion != null
      ? { stem: preloadedStem ?? null, question: preloadedQuestion ?? null }
      : null

  if (question.questionType === 'syllogism') {
    return wrapInteractive(
      <SyllogismPreviewBody
        question={question}
        preloadedContent={preloaded}
        showAnswerExplanations={showAnswerExplanations}
      />,
      interactive
    )
  }

  return wrapInteractive(
    <MultipleChoicePreviewBody
      question={question}
      preloadedContent={preloaded}
      showAnswerExplanations={showAnswerExplanations}
    />,
    interactive
  )
}
