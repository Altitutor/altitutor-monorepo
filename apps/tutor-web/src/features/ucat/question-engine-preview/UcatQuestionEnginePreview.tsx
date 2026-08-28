'use client'

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEventHandler,
  type ReactNode,
} from 'react'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/components/ucat/ucat-theme'
import { UcatRichContentBlock } from '@/features/ucat/question-engine-preview/UcatRichContentBlock'
import { hasRichTextContent } from '@/features/ucat/shared/lib/rich-text'
import type { Json } from '@altitutor/shared'
import {
  applyPlacementTransition,
  getAnswerSchemePresentation,
  type PlacementValue,
} from '@altitutor/ucat-response-contract'

const EXPLANATION_MUTED_STYLE = { color: '#5a6c7d' } as const

const ENGINE_MUTED_LABEL = 'text-[10pt] font-normal text-[#9ba9bd]'

/** Engine UI ignores app dark theme — matches ucat-web exam shell. */
const ENGINE_LIGHT_TEXT = 'bg-white text-black [color-scheme:light] dark:bg-white dark:text-black'

/** Mirrors ucat-web QuestionItem subset used for display-only preview. */
export type UcatEnginePreviewQuestion = {
  id: string
  /** 1-based number shown before the question prompt (e.g. multi-question stems). */
  questionNumber?: number
  sectionDisplayColumns: 1 | 2
  stemText: string
  stemJson?: Record<string, unknown> | null
  questionText: string
  questionJson?: Record<string, unknown> | null
  responseType: 'multiple_choice' | 'drag_and_drop'
  answerScheme:
    | 'single_choice'
    | 'situational_judgement_rating'
    | 'decision_making_binary_placement'
    | 'situational_judgement_most_least'
  options: Array<{
    id: string
    index: number
    text: string
    answerJson?: Record<string, unknown> | null
    answerKeyValue: 'correct' | 'yes' | 'no' | 'most' | 'least' | null
    answerExplanation?: string
    answerExplanationJson?: Record<string, unknown> | null
  }>
  answerExplanation?: string
  answerExplanationJson?: Record<string, unknown> | null
}

type PreviewShellProps = {
  question: UcatEnginePreviewQuestion
  /** Pre-refreshed rich JSON for instant images (optional). */
  preloadedStem?: Record<string, unknown> | null
  preloadedQuestion?: Record<string, unknown> | null
  /** When true, shows single-choice/placement explanations like post-submit review. */
  showAnswerExplanations?: boolean
  /** When true, marks the submitted and correct answers without embedding explanations. */
  showAnswerResults?: boolean
  /** When false, disables interaction (view-only in bulk import). */
  interactive?: boolean
  /** Student answer shown during read-only attempt review. */
  selectedOptionId?: string | null
  /** Canonical student placements shown during read-only review. */
  placementSnapshot?: Record<string, PlacementValue> | null
}

function wrapInteractive(children: ReactNode, interactive: boolean) {
  const shellClass = 'h-full min-h-0'
  if (interactive) return <div className={shellClass}>{children}</div>
  return (
    <div
      className={`pointer-events-none select-none ${shellClass} [&_[data-ucat-preview-scroll-target]]:pointer-events-auto`}
    >
      {children}
    </div>
  )
}

function hasExplanationContent(
  plain: string | undefined,
  json: Record<string, unknown> | null | undefined,
): boolean {
  return (plain?.trim().length ?? 0) > 0 || hasRichTextContent(json as Json | null | undefined)
}

function ExplanationRichBlock({
  json,
  plainText,
  className,
}: {
  json?: Record<string, unknown> | null
  plainText?: string
  className?: string
}) {
  return (
    <div className={className} style={EXPLANATION_MUTED_STYLE}>
      <UcatRichContentBlock json={json} plainText={plainText ?? ''} paragraphSpacing />
    </div>
  )
}

function QuestionPromptBlock({
  questionNumber,
  questionJson,
  questionText,
  preloadedQuestion,
}: {
  questionNumber?: number
  questionJson?: Record<string, unknown> | null
  questionText: string
  preloadedQuestion?: Record<string, unknown> | null
}) {
  return (
    <div className="flex items-start gap-2 text-[12pt]">
      {questionNumber != null ? (
        <span className={`inline-block w-8 shrink-0 ${ENGINE_MUTED_LABEL}`}>{questionNumber}.</span>
      ) : null}
      <div className="min-w-0 flex-1">
        <UcatRichContentBlock
          json={questionJson ?? undefined}
          plainText={questionText}
          preloadedContent={preloadedQuestion ?? undefined}
        />
      </div>
    </div>
  )
}

function PlacementPreviewBody({
  question,
  preloadedContent,
  showAnswerExplanations,
  showAnswerResults,
  interactive = true,
  placementSnapshot,
}: {
  question: UcatEnginePreviewQuestion
  preloadedContent?: {
    stem?: Record<string, unknown> | null
    question?: Record<string, unknown> | null
  } | null
  showAnswerExplanations?: boolean
  showAnswerResults?: boolean
  interactive?: boolean
  placementSnapshot?: Record<string, PlacementValue> | null
}) {
  const answerScheme = question.answerScheme ?? 'decision_making_binary_placement'
  const options = question.options ?? []
  const presentation = getAnswerSchemePresentation(
    answerScheme,
    [...options]
      .sort((left, right) => left.index - right.index)
      .map((option) => option.id),
  )
  if (presentation.kind !== 'placement') {
    throw new Error('The preview question does not use a placement response.')
  }
  const isTwoColumn = (presentation.displayColumnsOverride ?? question.sectionDisplayColumns) === 2
  const [positiveToken, negativeToken] = presentation.tokens
  if (!positiveToken || !negativeToken) {
    throw new Error('Placement responses require two presentation tokens.')
  }

  const [answers, setAnswers] = useState<Record<string, PlacementValue>>({})
  const touchDragRef = useRef<
    | {
        kind: 'token'
        pointerId: number
        choice: PlacementValue
        sourceOptionId: string | null
      }
    | { kind: 'option'; pointerId: number; sourceOptionId: string }
    | null
  >(null)

  const assignChoice = (
    previous: Record<string, PlacementValue>,
    optionId: string,
    choice: PlacementValue,
    fromOptionId: string | null,
  ) => {
    return {
      ...applyPlacementTransition({
        presentation,
        placements: previous,
        targetId: optionId,
        token: choice,
        sourceId: fromOptionId,
      }),
    }
  }

  const handleAssign = (optionId: string, choice: PlacementValue) => {
    setAnswers((prev) => assignChoice(prev, optionId, choice, null))
  }

  useEffect(() => {
    const finishTouchDrag = (event: PointerEvent) => {
      const drag = touchDragRef.current
      if (!drag || drag.pointerId !== event.pointerId || !interactive) return
      touchDragRef.current = null
      const target = document.elementFromPoint(event.clientX, event.clientY)
      if (drag.kind === 'option') {
        const tokenElement = target?.closest<HTMLElement>('[data-preview-placement-token-value]')
        const token = tokenElement?.dataset.previewPlacementTokenValue as PlacementValue | undefined
        if (token && presentation.tokens.some((item) => item.value === token)) {
          setAnswers((previous) =>
            assignChoice(previous, drag.sourceOptionId, token, drag.sourceOptionId),
          )
        } else if (target?.closest('[data-preview-placement-option-tray]')) {
          setAnswers((previous) => {
            const next = { ...previous }
            delete next[drag.sourceOptionId]
            return next
          })
        }
        return
      }
      const optionElement = target?.closest<HTMLElement>('[data-preview-placement-option-id]')
      const targetOptionId = optionElement?.dataset.previewPlacementOptionId
      if (targetOptionId) {
        setAnswers((previous) =>
          assignChoice(previous, targetOptionId, drag.choice, drag.sourceOptionId),
        )
        return
      }
      if (drag.sourceOptionId && target?.closest('[data-preview-placement-token-area]')) {
        setAnswers((previous) => {
          const next = { ...previous }
          delete next[drag.sourceOptionId!]
          return next
        })
      }
    }
    window.addEventListener('pointerup', finishTouchDrag)
    window.addEventListener('pointercancel', finishTouchDrag)
    return () => {
      window.removeEventListener('pointerup', finishTouchDrag)
      window.removeEventListener('pointercancel', finishTouchDrag)
    }
  })

  const startTouchDrag = (
    event: React.PointerEvent,
    choice: PlacementValue,
    sourceOptionId: string | null,
  ) => {
    if (event.pointerType === 'mouse' || !interactive) return
    event.preventDefault()
    touchDragRef.current = {
      kind: 'token',
      pointerId: event.pointerId,
      choice,
      sourceOptionId,
    }
  }

  const startOptionTouchDrag = (event: React.PointerEvent, sourceOptionId: string) => {
    if (event.pointerType === 'mouse' || !interactive) return
    event.preventDefault()
    touchDragRef.current = {
      kind: 'option',
      pointerId: event.pointerId,
      sourceOptionId,
    }
  }

  const makeHandleDrop =
    (optionId: string): DragEventHandler<HTMLDivElement> =>
    (event) => {
      event.preventDefault()
      const choice = event.dataTransfer.getData('ucat-placement-value') as '' | PlacementValue
      if (choice !== positiveToken.value && choice !== negativeToken.value) return

      const fromOptionId = event.dataTransfer.getData('ucat-placement-source') || null

      setAnswers((prev) => {
        return assignChoice(prev, optionId, choice, fromOptionId)
      })
    }

  const handleDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault()
  }

  const handleTokenAreaDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault()
    const fromOptionId = event.dataTransfer.getData('ucat-placement-source') || null
    if (!fromOptionId) return

    setAnswers((prev) => {
      if (!prev[fromOptionId]) return prev
      const next = { ...prev }
      delete next[fromOptionId]
      return next
    })
  }

  const makeOptionDestinationDrop =
    (token: PlacementValue): DragEventHandler<HTMLDivElement> =>
    (event) => {
      event.preventDefault()
      if (!interactive) return
      const optionId = event.dataTransfer.getData('ucat-placement-option')
      if (!optionId || !presentation.targetIds.includes(optionId)) return
      setAnswers((previous) => assignChoice(previous, optionId, token, optionId))
    }

  const handleOptionTrayDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault()
    if (!interactive) return
    const optionId = event.dataTransfer.getData('ucat-placement-option')
    if (!optionId) return
    setAnswers((previous) => {
      if (!previous[optionId]) return previous
      const next = { ...previous }
      delete next[optionId]
      return next
    })
  }

  const visibleAnswers = interactive ? answers : (placementSnapshot ?? {})
  const optionsToTokensContent = (
    <section className="space-y-5">
      <QuestionPromptBlock
        questionNumber={question.questionNumber}
        questionJson={question.questionJson}
        questionText={question.questionText}
        preloadedQuestion={preloadedContent?.question}
      />
      <div className="max-w-4xl space-y-3">
        {presentation.tokens.map((token) => {
          const placedOptionId = Object.entries(visibleAnswers).find(
            ([, value]) => value === token.value,
          )?.[0]
          const placedOption = options.find((option) => option.id === placedOptionId)
          const placedCorrectly = placedOption?.answerKeyValue === token.value
          return (
            <div key={token.value} className="flex items-stretch gap-3 sm:gap-5">
              <div className="flex w-36 shrink-0 items-center justify-center rounded border border-black bg-white px-3 py-4 text-center font-medium sm:w-44">
                {token.label}
              </div>
              <div
                data-preview-placement-token-value={token.value}
                className="flex min-h-[68px] flex-1 items-center justify-center rounded border border-black bg-[#d1cbcb] p-2"
                onDrop={interactive ? makeOptionDestinationDrop(token.value) : undefined}
                onDragOver={interactive ? handleDragOver : undefined}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={interactive ? `Drop an action into ${token.label}` : undefined}
              >
                {placedOption ? (
                  <div className="w-full space-y-1">
                    <div
                      className={`flex min-h-[50px] w-full touch-none items-center justify-center rounded border bg-white px-4 py-2 text-center ${
                        !interactive && (showAnswerExplanations || showAnswerResults)
                          ? placedCorrectly
                            ? 'border-green-600 bg-green-100'
                            : 'border-red-600 bg-red-100'
                          : 'border-black'
                      }`}
                      draggable={interactive}
                      onPointerDown={(event) => startOptionTouchDrag(event, placedOption.id)}
                      onDragStart={
                        interactive
                          ? (event) => {
                              event.dataTransfer.setData('ucat-placement-option', placedOption.id)
                              event.dataTransfer.effectAllowed = 'move'
                            }
                          : undefined
                      }
                    >
                      <UcatRichContentBlock
                        json={placedOption.answerJson}
                        plainText={placedOption.text}
                        className="w-full text-center"
                      />
                    </div>
                    {!interactive &&
                    (showAnswerExplanations || showAnswerResults) &&
                    !placedCorrectly ? (
                      <div className="text-right text-[9pt] text-emerald-700">
                        Correct answer:{' '}
                        {placedOption.answerKeyValue == null
                          ? 'Not placed'
                          : placedOption.answerKeyValue === positiveToken.value
                            ? positiveToken.label
                            : negativeToken.label}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      <div
        data-preview-placement-option-tray
        className="max-w-3xl space-y-3 rounded bg-[#dfdfdf] p-5 sm:ml-12 sm:p-7"
        onDrop={interactive ? handleOptionTrayDrop : undefined}
        onDragOver={interactive ? handleDragOver : undefined}
      >
        {options
          .filter((option) => !visibleAnswers[option.id])
          .map((option) => (
            <div
              key={option.id}
              className="flex min-h-[58px] touch-none items-center justify-center rounded border border-black bg-white px-4 py-2 text-center"
              draggable={interactive}
              onPointerDown={(event) => startOptionTouchDrag(event, option.id)}
              onDragStart={
                interactive
                  ? (event) => {
                      event.dataTransfer.setData('ucat-placement-option', option.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }
                  : undefined
              }
            >
              <UcatRichContentBlock
                json={option.answerJson}
                plainText={option.text}
                className="w-full text-center"
              />
            </div>
          ))}
      </div>
    </section>
  )

  const tokensToOptionsContent = (
    <section className="space-y-4">
      <QuestionPromptBlock
        questionNumber={question.questionNumber}
        questionJson={question.questionJson}
        questionText={question.questionText}
        preloadedQuestion={preloadedContent?.question}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-3">
          {options.map((option) => {
            const savedAnswer = placementSnapshot?.[option.id]
            const choice =
              !interactive && savedAnswer != null ? savedAnswer : (answers[option.id] ?? null)
            const correctChoice =
              option.answerKeyValue === positiveToken.value ||
              option.answerKeyValue === negativeToken.value
                ? option.answerKeyValue
                : null
            const showReviewState = Boolean(showAnswerExplanations || showAnswerResults)
            const answerIsCorrect = choice != null && choice === correctChoice
            return (
              <div
                key={option.id}
                data-preview-placement-option-id={option.id}
                className="space-y-1"
              >
                <div className="flex flex-row items-stretch gap-4">
                  <div className="flex-1">
                    <div className="flex min-h-[50px] items-center rounded border border-[#000000] bg-white px-4 py-2">
                      <UcatRichContentBlock
                        json={option.answerJson}
                        plainText={option.text}
                        className="w-full text-left"
                      />
                    </div>
                  </div>
                  <div
                    className="flex h-12 w-24 items-center justify-center rounded border border-dashed border-[#4b5563] bg-slate-50 text-[11pt]"
                    onDrop={interactive ? makeHandleDrop(option.id) : undefined}
                    onDragOver={interactive ? handleDragOver : undefined}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    aria-label={
                      interactive
                        ? `Drop ${positiveToken.label} or ${negativeToken.label} here`
                        : undefined
                    }
                    onClick={
                      interactive && presentation.reuse !== 'once_each'
                        ? () =>
                            handleAssign(
                              option.id,
                              choice === positiveToken.value
                                ? negativeToken.value
                                : positiveToken.value,
                            )
                        : undefined
                    }
                  >
                    {choice ? (
                      <div
                        onPointerDown={(event) => startTouchDrag(event, choice, option.id)}
                        className={`flex h-9 w-20 items-center justify-center rounded border text-[11pt] font-medium ${
                          showReviewState && !interactive
                            ? answerIsCorrect
                              ? 'border-emerald-600 bg-emerald-100 text-emerald-900'
                              : 'border-red-600 bg-red-100 text-red-900'
                            : 'border-black bg-white'
                        }`}
                        draggable={interactive}
                        onDragStart={
                          interactive
                            ? (event) => {
                                event.dataTransfer.setData('ucat-placement-value', choice)
                                event.dataTransfer.setData('ucat-placement-source', option.id)
                                event.dataTransfer.effectAllowed = 'move'
                              }
                            : undefined
                        }
                      >
                        {choice === positiveToken.value ? positiveToken.label : negativeToken.label}
                      </div>
                    ) : (
                      <span className="text-[9pt] text-transparent">_</span>
                    )}
                  </div>
                </div>
                {showReviewState && !interactive && !answerIsCorrect ? (
                  <div className="text-right text-[9pt] text-emerald-700">
                    Correct answer:{' '}
                    {correctChoice == null
                      ? 'Not placed'
                      : correctChoice === positiveToken.value
                        ? positiveToken.label
                        : negativeToken.label}
                  </div>
                ) : null}
                {showAnswerExplanations &&
                hasExplanationContent(option.answerExplanation, option.answerExplanationJson) ? (
                  <ExplanationRichBlock
                    json={option.answerExplanationJson}
                    plainText={option.answerExplanation}
                    className="pl-1 text-[10pt] leading-relaxed"
                  />
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="mt-1 w-[139px] rounded border border-black bg-[#dfdfdf] px-2 py-2">
          <div
            data-preview-placement-token-area
            className="flex h-full w-full flex-col items-center justify-start gap-2"
            onDrop={interactive ? handleTokenAreaDrop : undefined}
            onDragOver={interactive ? handleDragOver : undefined}
          >
            <button
              type="button"
              draggable={interactive && !Object.values(answers).includes(positiveToken.value)}
              disabled={
                interactive &&
                presentation.reuse === 'once_each' &&
                Object.values(answers).includes(positiveToken.value)
              }
              onPointerDown={(event) => startTouchDrag(event, positiveToken.value, null)}
              onDragStart={
                interactive
                  ? (event) => {
                      event.dataTransfer.setData('ucat-placement-value', positiveToken.value)
                      event.dataTransfer.setData('ucat-placement-source', '')
                      event.dataTransfer.effectAllowed = 'copy'
                    }
                  : undefined
              }
              className="flex h-9 w-20 items-center justify-center rounded border border-black bg-white text-[11pt] font-medium"
            >
              {positiveToken.label}
            </button>
            <button
              type="button"
              draggable={interactive && !Object.values(answers).includes(negativeToken.value)}
              disabled={
                interactive &&
                presentation.reuse === 'once_each' &&
                Object.values(answers).includes(negativeToken.value)
              }
              onPointerDown={(event) => startTouchDrag(event, negativeToken.value, null)}
              onDragStart={
                interactive
                  ? (event) => {
                      event.dataTransfer.setData('ucat-placement-value', negativeToken.value)
                      event.dataTransfer.setData('ucat-placement-source', '')
                      event.dataTransfer.effectAllowed = 'copy'
                    }
                  : undefined
              }
              className="flex h-9 w-20 items-center justify-center rounded border border-black bg-white text-[11pt] font-medium"
            >
              {negativeToken.label}
            </button>
          </div>
        </div>
      </div>
      {showAnswerExplanations &&
      hasExplanationContent(question.answerExplanation, question.answerExplanationJson) ? (
        <ExplanationRichBlock
          json={question.answerExplanationJson}
          plainText={question.answerExplanation}
          className="mt-3 space-y-1 border-t border-[#9ba9bd] pt-3 text-[11pt] leading-relaxed"
        />
      ) : null}
    </section>
  )

  const content =
    presentation.dragDirection === 'options_to_tokens'
      ? optionsToTokensContent
      : tokensToOptionsContent

  if (isTwoColumn) {
    return (
      <div
        className={`flex h-full min-h-0 gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed ${ENGINE_LIGHT_TEXT}`}
      >
        <article
          className="flex-[3] h-full min-w-0 overscroll-contain overflow-y-auto border-r-[6px] pr-4 py-4 sm:py-5"
          style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
          data-ucat-preview-scroll-target="true"
        >
          <div className="space-y-3">
            <UcatRichContentBlock
              json={question.stemJson ?? undefined}
              plainText={question.stemText}
              preloadedContent={preloadedContent?.stem ?? undefined}
              paragraphSpacing
            />
          </div>
        </article>
        <section
          className="flex-[2] h-full min-w-0 overscroll-contain overflow-y-auto pl-2 pr-1 py-4 sm:py-5"
          data-ucat-preview-scroll-target="true"
        >
          {content}
        </section>
      </div>
    )
  }

  return (
    <div
      className={`h-full min-h-0 overflow-y-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed ${ENGINE_LIGHT_TEXT}`}
      data-ucat-preview-scroll-target="true"
    >
      <div className="space-y-4 py-4 sm:py-5">
        <article className="space-y-3">
          <UcatRichContentBlock
            json={question.stemJson ?? undefined}
            plainText={question.stemText}
            preloadedContent={preloadedContent?.stem ?? undefined}
            paragraphSpacing
          />
        </article>
        {content}
      </div>
    </div>
  )
}

function MultipleChoicePreviewBody({
  question,
  preloadedContent,
  showAnswerExplanations,
  showAnswerResults,
  interactive = true,
  selectedOptionId: savedOptionId,
}: {
  question: UcatEnginePreviewQuestion
  preloadedContent?: {
    stem?: Record<string, unknown> | null
    question?: Record<string, unknown> | null
  } | null
  showAnswerExplanations?: boolean
  showAnswerResults?: boolean
  interactive?: boolean
  selectedOptionId?: string | null
}) {
  const radioName = useId()
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(undefined)
  const isTwoColumn = question.sectionDisplayColumns === 2
  const options = question.options ?? []

  const innerSection = (
    <div className="space-y-3">
      <QuestionPromptBlock
        questionNumber={question.questionNumber}
        questionJson={question.questionJson}
        questionText={question.questionText}
        preloadedQuestion={preloadedContent?.question}
      />
      <div className="space-y-2 pl-6">
        {options.map((option, index) => {
          const letter = String.fromCharCode(65 + index)
          const showReviewState = Boolean(showAnswerExplanations || showAnswerResults)
          const selectedInReview = showReviewState && savedOptionId === option.id
          const isCorrect = option.answerKeyValue === 'correct'
          const reviewHighlight = Boolean(showReviewState && isCorrect)
          const incorrectHighlight = Boolean(selectedInReview && !isCorrect)
          const radioChecked = showReviewState ? selectedInReview : selectedOptionId === option.id
          return (
            <div key={option.id} className="space-y-0.5">
              <div
                className={`flex items-start gap-2 rounded text-black ${
                  reviewHighlight
                    ? 'bg-green-100 py-1 pl-1 pr-2'
                    : incorrectHighlight
                      ? 'bg-red-100 py-1 pl-1 pr-2'
                      : ''
                }`}
              >
                <input
                  type="radio"
                  name={radioName}
                  checked={radioChecked}
                  disabled={!interactive}
                  readOnly={!interactive}
                  onChange={interactive ? () => setSelectedOptionId(option.id) : undefined}
                  className={`mt-1 h-4 w-4 shrink-0 ${interactive ? 'cursor-pointer' : 'cursor-default disabled:cursor-default'}`}
                  aria-label={`Option ${letter}`}
                />
                <span className={`inline-block w-8 shrink-0 ${ENGINE_MUTED_LABEL}`}>{letter}.</span>
                <div className="min-w-0 flex-1">
                  <UcatRichContentBlock json={option.answerJson} plainText={option.text} />
                </div>
              </div>
              {showAnswerExplanations &&
              hasExplanationContent(option.answerExplanation, option.answerExplanationJson) ? (
                <ExplanationRichBlock
                  json={option.answerExplanationJson}
                  plainText={option.answerExplanation}
                  className="ml-6 text-[11pt] leading-relaxed"
                />
              ) : null}
            </div>
          )
        })}
      </div>
      {showAnswerExplanations &&
      hasExplanationContent(question.answerExplanation, question.answerExplanationJson) ? (
        <ExplanationRichBlock
          json={question.answerExplanationJson}
          plainText={question.answerExplanation}
          className="mt-3 border-t border-[#9ba9bd] pt-3 text-[11pt] leading-relaxed"
        />
      ) : null}
    </div>
  )

  if (isTwoColumn) {
    return (
      <div
        className={`flex h-full min-h-0 gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed ${ENGINE_LIGHT_TEXT}`}
      >
        <article
          className="flex-[3] h-full min-w-0 overscroll-contain overflow-y-auto border-r-[6px] pr-4 py-4 sm:py-5"
          style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
          data-ucat-preview-scroll-target="true"
        >
          <div className="space-y-3">
            <UcatRichContentBlock
              json={question.stemJson ?? undefined}
              plainText={question.stemText}
              preloadedContent={preloadedContent?.stem ?? undefined}
              paragraphSpacing
            />
          </div>
        </article>
        <section
          className="flex-[2] h-full min-w-0 overscroll-contain overflow-y-auto pl-2 pr-1 py-4 sm:py-5"
          data-ucat-preview-scroll-target="true"
        >
          {innerSection}
        </section>
      </div>
    )
  }

  return (
    <div
      className={`h-full min-h-0 overflow-y-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed ${ENGINE_LIGHT_TEXT}`}
      data-ucat-preview-scroll-target="true"
    >
      <div className="space-y-4 py-4 sm:py-5">
        <article className="space-y-3">
          <UcatRichContentBlock
            json={question.stemJson ?? undefined}
            plainText={question.stemText}
            preloadedContent={preloadedContent?.stem ?? undefined}
            paragraphSpacing
          />
        </article>
        <section className="space-y-3">{innerSection}</section>
      </div>
    </div>
  )
}

/** Parity with ucat-web QuestionContent: fonts, stem layout, single-choice radios, placement UI. */
export function UcatQuestionEnginePreview({
  question,
  preloadedStem,
  preloadedQuestion,
  showAnswerExplanations = false,
  showAnswerResults = false,
  interactive = true,
  selectedOptionId,
  placementSnapshot,
}: PreviewShellProps) {
  const preloaded =
    preloadedStem != null || preloadedQuestion != null
      ? { stem: preloadedStem ?? null, question: preloadedQuestion ?? null }
      : null

  if (
    question.answerScheme === 'decision_making_binary_placement' ||
    question.answerScheme === 'situational_judgement_most_least'
  ) {
    return wrapInteractive(
      <PlacementPreviewBody
        question={question}
        preloadedContent={preloaded}
        showAnswerExplanations={showAnswerExplanations}
        showAnswerResults={showAnswerResults}
        interactive={interactive}
        placementSnapshot={placementSnapshot}
      />,
      interactive,
    )
  }

  return wrapInteractive(
    <MultipleChoicePreviewBody
      question={question}
      preloadedContent={preloaded}
      showAnswerExplanations={showAnswerExplanations}
      showAnswerResults={showAnswerResults}
      interactive={interactive}
      selectedOptionId={selectedOptionId}
    />,
    interactive,
  )
}
