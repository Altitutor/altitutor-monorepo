'use client'

import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { Json } from '@altitutor/shared'
import { Button, Label, RadioGroup, RadioGroupItem } from '@altitutor/ui'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/components/ucat/ucat-theme'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'

const EXPLANATION_MUTED_STYLE = { color: '#5a6c7d' } as const

const ENGINE_LIGHT_TEXT =
  'bg-white text-black [color-scheme:light] dark:bg-white dark:text-black'

const RTE = { forceLightChrome: true as const }

type OptionsState = NonNullable<UcatQuestionStemFormValues['questions'][number]['options']>

type ResultsMcQuestionBlockProps = {
  includeStem: boolean
  stemText: Json | null | undefined
  setStemText: (v: Json | null | undefined) => void
  questionText: Json | null | undefined
  setQuestionText: (v: Json | null | undefined) => void
  options: OptionsState
  setOptions: Dispatch<SetStateAction<OptionsState>>
  correctOptionIndex: number
  setCorrectOptionIndex: (i: number) => void
  answerExplanation: Json | null | undefined
  setAnswerExplanation: (v: Json | null | undefined) => void
  optionLabel: (index: number) => string
}

function ResultsMcQuestionBlock({
  includeStem,
  stemText,
  setStemText,
  questionText,
  setQuestionText,
  options,
  setOptions,
  correctOptionIndex,
  setCorrectOptionIndex,
  answerExplanation,
  setAnswerExplanation,
  optionLabel,
}: ResultsMcQuestionBlockProps) {
  return (
    <div className="space-y-3 px-1">
      {includeStem ? (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-[#5a6c7d]">Stem</Label>
          <UcatRichTextEditor
            {...RTE}
            value={stemText}
            onChange={(v) => setStemText(v)}
            minHeight="120px"
            pasteTableBehavior="keep"
          />
        </div>
      ) : null}
      <div className="font-medium text-[12pt]">
        <UcatRichTextEditor
          {...RTE}
          value={questionText}
          onChange={(v) => setQuestionText(v)}
          minHeight="4rem"
          pasteTableBehavior="keep"
        />
      </div>
      <div className="space-y-2">
        {options.map((opt, index) => {
          const optionIsCorrect = index === correctOptionIndex && options.length > 0
          const letter = optionLabel(index)
          const bgClass = optionIsCorrect ? 'bg-green-100' : ''

          return (
            <div key={index} className="space-y-0.5">
              <div className={`flex items-start gap-2 rounded py-1 pl-6 pr-3 ${bgClass}`}>
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="bulk-import-correct-mc"
                    checked={correctOptionIndex === index}
                    onChange={() => setCorrectOptionIndex(index)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span className="inline-block w-8 shrink-0">{letter}.</span>
                  <div className="min-w-0 flex-1">
                    <UcatRichTextEditor
                      {...RTE}
                      value={opt.answerText}
                      onChange={(v) => {
                        setOptions((prev) => {
                          const next = [...prev]
                          next[index] = { ...opt, answerText: v }
                          return next
                        })
                      }}
                      minHeight="48px"
                      pasteTableBehavior="keep"
                    />
                  </div>
                </label>
                {optionIsCorrect ? (
                  <span className="shrink-0 pr-2 text-[10pt] font-medium text-green-700">
                    Correct
                  </span>
                ) : null}
              </div>
              <div className="ml-6 pl-8">
                <UcatRichTextEditor
                  {...RTE}
                  value={opt.answerExplanation ?? null}
                  onChange={(v) => {
                    setOptions((prev) => {
                      const next = [...prev]
                      next[index] = { ...opt, answerExplanation: v }
                      return next
                    })
                  }}
                  minHeight="36px"
                  pasteTableBehavior="keep"
                />
                <div className="mt-0.5 text-[10pt]" style={EXPLANATION_MUTED_STYLE}>
                  Option explanation (optional)
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div
        className="mt-3 space-y-2 border-t border-[#9ba9bd] pt-3 text-[11pt] leading-relaxed"
        style={EXPLANATION_MUTED_STYLE}
      >
        <Label className="text-[11pt] font-medium">Question answer explanation</Label>
        <UcatRichTextEditor
          {...RTE}
          value={answerExplanation}
          onChange={(v) => setAnswerExplanation(v)}
          minHeight="60px"
          pasteTableBehavior="keep"
        />
      </div>
    </div>
  )
}

type ResultsSyllogismQuestionBlockProps = {
  includeStem: boolean
  stemText: Json | null | undefined
  setStemText: (v: Json | null | undefined) => void
  questionText: Json | null | undefined
  setQuestionText: (v: Json | null | undefined) => void
  options: OptionsState
  setOptions: Dispatch<SetStateAction<OptionsState>>
  syllogismPattern: string
  setSyllogismPattern: (v: string) => void
  answerExplanation: Json | null | undefined
  setAnswerExplanation: (v: Json | null | undefined) => void
}

function ResultsSyllogismQuestionBlock({
  includeStem,
  stemText,
  setStemText,
  questionText,
  setQuestionText,
  options,
  setOptions,
  syllogismPattern,
  setSyllogismPattern,
  answerExplanation,
  setAnswerExplanation,
}: ResultsSyllogismQuestionBlockProps) {
  return (
    <div className="space-y-3 px-1">
      {includeStem ? (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-[#5a6c7d]">Stem</Label>
          <UcatRichTextEditor
            {...RTE}
            value={stemText}
            onChange={(v) => setStemText(v)}
            minHeight="120px"
            pasteTableBehavior="keep"
          />
        </div>
      ) : null}
      <div className="font-medium text-[12pt]">
        <UcatRichTextEditor
          {...RTE}
          value={questionText}
          onChange={(v) => setQuestionText(v)}
          minHeight="4rem"
          pasteTableBehavior="keep"
        />
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] gap-x-1 gap-y-0.5 pl-4 pr-3 text-[10pt] font-medium text-[#4b5563]">
          <div>Statement</div>
          <div className="text-center">Your answers</div>
          <div className="text-center">Correct answers</div>
        </div>
        <div className="space-y-1">
          {options.map((opt, index) => {
            const correctYes = syllogismPattern.charAt(index).toUpperCase() === 'Y'
            return (
              <div key={index}>
                <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] gap-x-1 gap-y-1 items-stretch pl-4 pr-3">
                  <div className="flex items-center">
                    <div className="flex min-h-[50px] w-full flex-col gap-1 rounded border border-[#000000] bg-white px-2 py-1">
                      <UcatRichTextEditor
                        {...RTE}
                        value={opt.answerText}
                        onChange={(v) => {
                          setOptions((prev) => {
                            const next = [...prev]
                            next[index] = { ...opt, answerText: v }
                            return next
                          })
                        }}
                        minHeight="44px"
                        pasteTableBehavior="keep"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="flex h-9 w-20 items-center justify-center rounded border border-dashed border-[#9ca3af] bg-white text-[11pt] text-[#9ca3af]">
                      —
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1 py-1">
                    <div className="flex h-9 w-20 items-center justify-center rounded border border-black bg-white text-[11pt] font-medium">
                      {correctYes ? 'Yes' : 'No'}
                    </div>
                    <RadioGroup
                      value={syllogismPattern.charAt(index) === 'Y' ? 'Y' : 'N'}
                      onValueChange={(v) => {
                        const arr = syllogismPattern.split('')
                        arr[index] = v
                        setSyllogismPattern(
                          arr.join('').padEnd(options.length, 'N').slice(0, options.length)
                        )
                      }}
                      className="flex gap-2"
                    >
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="Y" id={`rs-y-${index}`} />
                        <Label htmlFor={`rs-y-${index}`} className="cursor-pointer text-[10pt]">
                          Yes
                        </Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="N" id={`rs-n-${index}`} />
                        <Label htmlFor={`rs-n-${index}`} className="cursor-pointer text-[10pt]">
                          No
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                <div className="col-span-full mt-1 max-w-[calc(100%-2rem)] pl-4 pr-3">
                  <UcatRichTextEditor
                    {...RTE}
                    value={opt.answerExplanation ?? null}
                    onChange={(v) => {
                      setOptions((prev) => {
                        const next = [...prev]
                        next[index] = { ...opt, answerExplanation: v }
                        return next
                      })
                    }}
                    minHeight="36px"
                    pasteTableBehavior="keep"
                  />
                  <div className="text-[10pt]" style={EXPLANATION_MUTED_STYLE}>
                    Statement explanation (optional)
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div
        className="mt-3 space-y-2 border-t border-[#9ba9bd] pt-3 text-[11pt] leading-relaxed"
        style={EXPLANATION_MUTED_STYLE}
      >
        <Label className="font-medium">Question answer explanation</Label>
        <UcatRichTextEditor
          {...RTE}
          value={answerExplanation}
          onChange={(v) => setAnswerExplanation(v)}
          minHeight="60px"
          pasteTableBehavior="keep"
        />
      </div>
    </div>
  )
}

type UcatResultsStyleQuestionEditorProps = {
  stemTextJson: Json | null | undefined
  question: UcatQuestionStemFormValues['questions'][number]
  sectionDisplayColumns: 1 | 2
  onSave: (
    stemText: Json | null | undefined,
    updatedQuestion: UcatQuestionStemFormValues['questions'][number]
  ) => void
  onCancel: () => void
}

export function UcatResultsStyleQuestionEditor({
  stemTextJson,
  question,
  sectionDisplayColumns,
  onSave,
  onCancel,
}: UcatResultsStyleQuestionEditorProps) {
  const [stemText, setStemText] = useState<Json | null | undefined>(stemTextJson)
  const [questionText, setQuestionText] = useState<Json | null | undefined>(question.questionText)
  const [options, setOptions] = useState(question.options ?? [])
  const [correctOptionIndex, setCorrectOptionIndex] = useState(() => {
    const idx = question.options?.findIndex((o) => o.isAnswer) ?? 0
    return idx >= 0 ? idx : 0
  })
  const [answerExplanation, setAnswerExplanation] = useState<Json | null | undefined>(
    question.answerExplanation
  )
  const initialPattern =
    (question as { syllogismAnswerPattern?: string | null }).syllogismAnswerPattern ??
    (question.options ?? [])
      .map((o) => (o.isAnswer ? 'Y' : 'N'))
      .join('')
  const [syllogismPattern, setSyllogismPattern] = useState(() =>
    initialPattern.padEnd(question.options?.length ?? 0, 'N').slice(0, question.options?.length ?? 0)
  )
  const isSyllogism = question.questionType === 'syllogism'

  const handleSave = () => {
    const n = options.length
    const resolvedCorrect = n > 0 ? Math.min(Math.max(0, correctOptionIndex), n - 1) : 0
    const updatedOptions = options.map((opt, i) => ({
      ...opt,
      isAnswer: isSyllogism
        ? syllogismPattern.charAt(i).toUpperCase() === 'Y'
        : i === resolvedCorrect,
    }))
    const qWithPattern = {
      ...question,
      questionText: questionText ?? question.questionText,
      answerExplanation: answerExplanation ?? question.answerExplanation,
      options: updatedOptions,
      syllogismAnswerPattern:
        isSyllogism && syllogismPattern.length === options.length ? syllogismPattern : null,
    } as UcatQuestionStemFormValues['questions'][number]
    onSave(stemText, qWithPattern)
  }

  const optionLabel = (index: number) => String.fromCharCode(65 + index)

  const mcShared: Omit<
    ResultsMcQuestionBlockProps,
    'includeStem'
  > = {
    stemText,
    setStemText,
    questionText,
    setQuestionText,
    options,
    setOptions,
    correctOptionIndex,
    setCorrectOptionIndex,
    answerExplanation,
    setAnswerExplanation,
    optionLabel,
  }

  const sylShared: Omit<ResultsSyllogismQuestionBlockProps, 'includeStem'> = {
    stemText,
    setStemText,
    questionText,
    setQuestionText,
    options,
    setOptions,
    syllogismPattern,
    setSyllogismPattern,
    answerExplanation,
    setAnswerExplanation,
  }

  const shell = (body: ReactNode) => (
    <div className={`rounded-md border border-border shadow-sm ${ENGINE_LIGHT_TEXT}`}>
      <div className="max-h-[min(70vh,720px)] overflow-y-auto">{body}</div>
      <EditorFooter onSave={handleSave} onCancel={onCancel} />
    </div>
  )

  if (isSyllogism) {
    if (sectionDisplayColumns === 2) {
      return shell(
        <div
          className={`flex min-h-[320px] gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}
        >
          <article
            className="flex-[3] min-w-0 border-r-[6px] py-4 pr-4 sm:py-5"
            style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
          >
            <div className="space-y-2 px-3">
              <Label className="text-xs font-medium text-[#5a6c7d]">Stem</Label>
              <UcatRichTextEditor
                {...RTE}
                value={stemText}
                onChange={(v) => setStemText(v)}
                minHeight="200px"
                pasteTableBehavior="keep"
              />
            </div>
          </article>
          <section className="flex-[2] min-w-0 py-4 sm:py-5">
            <ResultsSyllogismQuestionBlock {...sylShared} includeStem={false} />
          </section>
        </div>
      )
    }
    return shell(
      <div className={`space-y-4 py-4 sm:py-5 font-[${UCAT_FONTS.body}] text-[11pt]`}>
        <ResultsSyllogismQuestionBlock {...sylShared} includeStem />
      </div>
    )
  }

  /** Multiple choice */
  if (sectionDisplayColumns === 2) {
    return shell(
      <div
        className={`flex min-h-[320px] gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed`}
      >
        <article
          className="flex-[3] min-w-0 border-r-[6px] py-4 pr-4 sm:py-5"
          style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
        >
          <div className="space-y-2 px-3">
            <Label className="text-xs font-medium text-[#5a6c7d]">Stem</Label>
            <UcatRichTextEditor
              {...RTE}
              value={stemText}
              onChange={(v) => setStemText(v)}
              minHeight="200px"
              pasteTableBehavior="keep"
            />
          </div>
        </article>
        <section className="flex-[2] min-w-0 py-4 sm:py-5">
          <ResultsMcQuestionBlock {...mcShared} includeStem={false} />
        </section>
      </div>
    )
  }

  return shell(
    <div className={`space-y-4 py-4 sm:py-5 font-[${UCAT_FONTS.body}] text-[11pt]`}>
      <ResultsMcQuestionBlock {...mcShared} includeStem />
    </div>
  )
}

function EditorFooter({
  onSave,
  onCancel,
}: {
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 dark:bg-[#f9fafb]">
      <Button type="button" variant="outline" size="sm" className="h-9" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" size="sm" className="h-9" onClick={onSave}>
        Save
      </Button>
    </div>
  )
}
