'use client'

import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { Json } from '@altitutor/shared'
import type { Editor } from '@tiptap/react'
import { Button, Label, SearchableSelect } from '@altitutor/ui'
import { Plus, Trash2 } from 'lucide-react'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/components/ucat/ucat-theme'
import { SegmentedControl } from '@/shared/components/segmented-control'
import { cn } from '@/shared/utils'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { bindRichTextToolbarFocus } from '@/features/ucat/shared/lib/rich-text-toolbar-focus'
import { getSituationalJudgementMarkingOutcome } from '@/features/ucat/questions/lib/situational-judgement-marking'

const EXPLANATION_MUTED_STYLE = { color: '#5a6c7d' } as const

const ENGINE_LIGHT_TEXT =
  'bg-white text-black [color-scheme:light] dark:bg-white dark:text-black'

const ENGINE_MUTED_LABEL = 'text-[10pt] font-normal text-[#9ba9bd]'

/** Pin control chrome on white UCAT engine shells when the app is in dark mode. */
const ENGINE_CHROME_OUTLINE_BUTTON =
  'border border-[#9ba9bd] bg-white text-black hover:bg-[#f3f4f6] dark:border-[#9ba9bd] dark:bg-white dark:text-black dark:hover:bg-[#f3f4f6] dark:hover:text-black'

const RTE = { forceLightChrome: true as const }

type OptionsState = NonNullable<UcatQuestionStemFormValues['questions'][number]['options']>

type RichEditorImageProps = {
  stemId?: string | null
  enableImages?: boolean
  onImageFileIdsChange?: (fileIds: string[]) => void
  onTextEditorActive?: (editor: Editor | null) => void
}

export type ResultsMcQuestionBlockProps = {
  includeStem: boolean
  stemText: Json | null | undefined
  setStemText: (v: Json | null | undefined) => void
  questionText: Json | null | undefined
  setQuestionText: (v: Json | null | undefined) => void
  questionNumber?: number
  options: OptionsState
  setOptions: Dispatch<SetStateAction<OptionsState>>
  correctOptionIndex: number
  sectionName?: string | null
  setCorrectOptionIndex: (i: number) => void
  answerScheme?: 'single_choice' | 'situational_judgement_rating' | 'situational_judgement_most_least'
  setAnswerKeyValue?: (optionIndex: number, value: 'most' | 'least' | null) => void
  answerExplanation: Json | null | undefined
  setAnswerExplanation: (v: Json | null | undefined) => void
  optionLabel: (index: number) => string
  showOptionExplanations?: boolean
  /** When true, option explanation editors appear under the question answer explanation section. */
  showOptionExplanationsUnderQuestion?: boolean
  showQuestionExplanation?: boolean
  allowOptionAddRemove?: boolean
} & RichEditorImageProps

export function ResultsMcQuestionBlock({
  includeStem,
  stemText,
  setStemText,
  questionText,
  setQuestionText,
  options,
  setOptions,
  correctOptionIndex,
  sectionName,
  setCorrectOptionIndex,
  answerScheme = 'single_choice',
  setAnswerKeyValue,
  answerExplanation,
  setAnswerExplanation,
  optionLabel,
  questionNumber,
  showOptionExplanations = true,
  showOptionExplanationsUnderQuestion = false,
  showQuestionExplanation = true,
  allowOptionAddRemove = false,
  stemId = null,
  enableImages = false,
  onImageFileIdsChange,
  onTextEditorActive,
}: ResultsMcQuestionBlockProps) {
  const imageProps = enableImages
    ? { stemId, enableImages: true as const, onImageFileIdsChange, onTextEditorActive }
    : { onTextEditorActive }

  const onEditorReady = (editor: Editor) => bindRichTextToolbarFocus(editor, onTextEditorActive)

  return (
    <div className="space-y-3 px-1">
      {includeStem ? (
        <div className="space-y-2">
          <span className={ENGINE_MUTED_LABEL}>Stem</span>
          <UcatRichTextEditor
            {...RTE}
            {...imageProps}
            value={stemText}
            onChange={(v) => setStemText(v)}
            minHeight="120px"
            pasteTableBehavior="keep"
            paragraphSpacing
            onEditorReady={onEditorReady}
          />
        </div>
      ) : null}
      <div className="flex items-start gap-2 text-[12pt]">
        {questionNumber != null ? (
          <span className={cn('inline-block w-8 shrink-0', ENGINE_MUTED_LABEL)}>{questionNumber}.</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <UcatRichTextEditor
            {...RTE}
            {...imageProps}
            value={questionText}
            onChange={(v) => setQuestionText(v)}
            minHeight="4rem"
            pasteTableBehavior="keep"
            onEditorReady={onEditorReady}
          />
        </div>
      </div>
      <div className="space-y-2">
        {allowOptionAddRemove ? (
          <div className="flex justify-end pl-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('h-8 gap-1', ENGINE_CHROME_OUTLINE_BUTTON)}
              onClick={() =>
                setOptions((prev) => [
                  ...prev,
                  { answerText: EMPTY_DOC, answerExplanation: null, isAnswer: false },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add option
            </Button>
          </div>
        ) : null}
        {options.map((opt, index) => {
          const optionIsCorrect = index === correctOptionIndex && options.length > 0
          const letter = optionLabel(index)
          const sjOutcome = getSituationalJudgementMarkingOutcome({
            sectionName,
            optionCount: options.length,
            selectedIndex: index,
            correctIndex: correctOptionIndex,
          })
          const isPartial = sjOutcome === 'partial'
          const bgClass = answerScheme === 'situational_judgement_most_least'
            ? options[index]?.answerKeyValue === 'most'
              ? 'bg-green-100'
              : options[index]?.answerKeyValue === 'least'
                ? 'bg-red-100'
                : 'bg-white'
            : optionIsCorrect
              ? 'bg-green-100'
              : isPartial
                ? 'bg-amber-100'
                : 'bg-red-50'

          return (
            <div key={index} className="space-y-0.5">
              <div className={`rounded px-3 py-2 ${bgClass}`}>
                <div className="flex min-h-8 items-center gap-2">
                  {answerScheme === 'situational_judgement_most_least' ? null : (
                    <input
                      type="radio"
                      name="bulk-import-correct-mc"
                      checked={correctOptionIndex === index}
                      onChange={() => setCorrectOptionIndex(index)}
                      className="h-4 w-4 shrink-0 cursor-pointer"
                      aria-label={`Mark option ${letter} as correct`}
                    />
                  )}
                  <span className={cn('inline-block w-7 shrink-0', ENGINE_MUTED_LABEL)}>{letter}.</span>
                  {answerScheme !== 'situational_judgement_most_least' ? (
                    optionIsCorrect ? (
                      <span className="rounded-full bg-green-200 px-2 py-0.5 text-[9pt] font-medium text-green-800">
                        Correct
                      </span>
                    ) : isPartial ? (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[9pt] font-medium text-amber-800">
                        Partial
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9pt] font-medium text-red-700">
                        {sjOutcome === 'incorrect' ? 'Wrong polarity' : 'Wrong'}
                      </span>
                    )
                  ) : null}
                  <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
                    {answerScheme === 'situational_judgement_most_least' ? (
                      <div className={cn(
                        'w-36 shrink-0 truncate text-right text-[9pt] font-medium',
                        options[index]?.answerKeyValue === 'most'
                          ? 'text-green-800'
                          : options[index]?.answerKeyValue === 'least'
                            ? 'text-red-800'
                            : 'text-[#5a6c7d]',
                      )}>
                        {options[index]?.answerKeyValue === 'most'
                          ? 'Most appropriate'
                          : options[index]?.answerKeyValue === 'least'
                            ? 'Least appropriate'
                            : 'Not keyed'}
                      </div>
                    ) : null}
                    {answerScheme === 'situational_judgement_most_least' ? (
                      <SearchableSelect<{ value: 'none' | 'most' | 'least'; label: string }>
                        items={[
                          { value: 'none', label: 'Not keyed' },
                          { value: 'most', label: 'Most appropriate' },
                          { value: 'least', label: 'Least appropriate' },
                        ]}
                        value={[
                          { value: 'none' as const, label: 'Not keyed' },
                          { value: 'most' as const, label: 'Most appropriate' },
                          { value: 'least' as const, label: 'Least appropriate' },
                        ].find((item) => item.value === (options[index]?.answerKeyValue ?? 'none')) ?? { value: 'none', label: 'Not keyed' }}
                        onValueChange={(item) => setAnswerKeyValue?.(index, item?.value === 'most' || item?.value === 'least' ? item.value : null)}
                        getItemLabel={(item) => item.label}
                        getItemId={(item) => item.value}
                        triggerClassName="h-8 w-40 shrink-0 !border-[#9ba9bd] !bg-white !text-black dark:!border-[#9ba9bd] dark:!bg-white dark:!text-black dark:hover:!bg-[#f3f4f6]"
                        className="!bg-white !text-black [&_[cmdk-group]]:!text-black [&_[cmdk-group-heading]]:!text-gray-500 [&_[cmdk-input]]:!text-black [&_[cmdk-input]]:!placeholder:text-gray-500 [&_[cmdk-item]]:!text-black"
                        forceLight
                        ariaLabel={`Set answer key for option ${letter}`}
                      />
                    ) : null}
                    {allowOptionAddRemove && options.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 !text-destructive hover:!text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        setOptions((prev) => prev.filter((_, optionIndex) => optionIndex !== index))
                      }
                      aria-label={`Remove option ${letter}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    ) : null}
                  </div>
                </div>
                <div className="pt-1.5">
                  <UcatRichTextEditor
                    {...RTE}
                    {...imageProps}
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
                    onEditorReady={onEditorReady}
                  />
                </div>
              </div>
              {showOptionExplanations ? (
                <div className="px-3 sm:pl-14">
                  <UcatRichTextEditor
                    {...RTE}
                    {...imageProps}
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
                    onEditorReady={onEditorReady}
                  />
                  <div className="mt-0.5 text-[10pt]" style={EXPLANATION_MUTED_STYLE}>
                    Option explanation (optional)
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {showQuestionExplanation ? (
        <div
          className="mt-3 space-y-3 border-t border-[#9ba9bd] pt-3 text-[11pt] leading-relaxed"
          style={EXPLANATION_MUTED_STYLE}
        >
          <div className="space-y-2">
            <Label className="text-[11pt] font-medium">Question answer explanation</Label>
            <UcatRichTextEditor
              {...RTE}
              {...imageProps}
              value={answerExplanation}
              onChange={(v) => setAnswerExplanation(v)}
              minHeight="60px"
              pasteTableBehavior="keep"
              onEditorReady={onEditorReady}
            />
          </div>
          {showOptionExplanationsUnderQuestion
            ? options.map((opt, index) => {
                const letter = optionLabel(index)
                return (
                  <div key={index} className="space-y-2">
                    <Label className="text-[11pt] font-medium">
                      Option {letter} explanation (optional)
                    </Label>
                    <UcatRichTextEditor
                      {...RTE}
                      {...imageProps}
                      value={opt.answerExplanation ?? null}
                      onChange={(v) => {
                        setOptions((prev) => {
                          const next = [...prev]
                          const current = next[index]
                          if (!current) return prev
                          next[index] = { ...current, answerExplanation: v }
                          return next
                        })
                      }}
                      minHeight="36px"
                      pasteTableBehavior="keep"
                      onEditorReady={onEditorReady}
                    />
                  </div>
                )
              })
            : null}
        </div>
      ) : null}
    </div>
  )
}

export type ResultsSyllogismQuestionBlockProps = {
  includeStem: boolean
  stemText: Json | null | undefined
  setStemText: (v: Json | null | undefined) => void
  questionText: Json | null | undefined
  setQuestionText: (v: Json | null | undefined) => void
  options: OptionsState
  setOptions: Dispatch<SetStateAction<OptionsState>>
  syllogismPattern: string
  setSyllogismPattern: (v: string) => void
  answerMode?: 'binary' | 'most_least'
  setMostLeastAnswerKey?: (optionIndex: number, value: 'most' | 'least' | null) => void
  answerExplanation: Json | null | undefined
  setAnswerExplanation: (v: Json | null | undefined) => void
  questionNumber?: number
  showQuestionExplanation?: boolean
} & RichEditorImageProps

export function ResultsSyllogismQuestionBlock({
  includeStem,
  stemText,
  setStemText,
  questionText,
  setQuestionText,
  options,
  setOptions,
  syllogismPattern,
  setSyllogismPattern,
  answerMode = 'binary',
  setMostLeastAnswerKey,
  answerExplanation,
  setAnswerExplanation,
  questionNumber,
  showQuestionExplanation = true,
  stemId = null,
  enableImages = false,
  onImageFileIdsChange,
  onTextEditorActive,
}: ResultsSyllogismQuestionBlockProps) {
  const imageProps = enableImages
    ? { stemId, enableImages: true as const, onImageFileIdsChange, onTextEditorActive }
    : { onTextEditorActive }

  const onEditorReady = (editor: Editor) => bindRichTextToolbarFocus(editor, onTextEditorActive)

  return (
    <div className="space-y-3 px-1">
      {includeStem ? (
        <div className="space-y-2">
          <span className={ENGINE_MUTED_LABEL}>Stem</span>
          <UcatRichTextEditor
            {...RTE}
            {...imageProps}
            value={stemText}
            onChange={(v) => setStemText(v)}
            minHeight="120px"
            pasteTableBehavior="keep"
            paragraphSpacing
            onEditorReady={onEditorReady}
          />
        </div>
      ) : null}
      <div className="flex items-start gap-2 text-[12pt]">
        {questionNumber != null ? (
          <span className={cn('inline-block w-8 shrink-0', ENGINE_MUTED_LABEL)}>{questionNumber}.</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <UcatRichTextEditor
            {...RTE}
            {...imageProps}
            value={questionText}
            onChange={(v) => setQuestionText(v)}
            minHeight="4rem"
            pasteTableBehavior="keep"
            onEditorReady={onEditorReady}
          />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,2.5fr)] items-center gap-x-3 pl-4 pr-3">
          <span className={ENGINE_MUTED_LABEL}>Statement</span>
          <span className={cn(ENGINE_MUTED_LABEL, 'text-center')}>{answerMode === 'most_least' ? 'Answer key' : 'Answer'}</span>
          <span className={cn(ENGINE_MUTED_LABEL, 'text-center')}>Explanation</span>
        </div>
        <div className="space-y-3">
          {options.map((opt, index) => (
            <div
              key={index}
              className={cn(
                'grid grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,2.5fr)] items-start gap-x-3 rounded-md py-2 pl-4 pr-3',
                answerMode === 'most_least' && opt.answerKeyValue === 'most'
                  ? 'border border-green-200 bg-green-50'
                  : answerMode === 'most_least' && opt.answerKeyValue === 'least'
                    ? 'border border-red-200 bg-red-50'
                    : null,
              )}
            >
              <div className="flex min-w-0 items-start gap-2">
                <span className={cn(ENGINE_MUTED_LABEL, 'mt-1 shrink-0 leading-none')}>•</span>
                <div className="min-w-0 flex-1">
                  <UcatRichTextEditor
                    {...RTE}
                    {...imageProps}
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
                    onEditorReady={onEditorReady}
                  />
                </div>
              </div>
              <div className="flex items-start justify-center pt-1">
                {answerMode === 'most_least' ? (
                  <SearchableSelect<{ value: 'none' | 'most' | 'least'; label: string }>
                    items={[
                      { value: 'none', label: 'Not keyed' },
                      { value: 'most', label: 'Most appropriate' },
                      { value: 'least', label: 'Least appropriate' },
                    ]}
                    value={[
                      { value: 'none' as const, label: 'Not keyed' },
                      { value: 'most' as const, label: 'Most appropriate' },
                      { value: 'least' as const, label: 'Least appropriate' },
                    ].find((item) => item.value === (opt.answerKeyValue ?? 'none')) ?? { value: 'none', label: 'Not keyed' }}
                    onValueChange={(item) => setMostLeastAnswerKey?.(
                      index,
                      item?.value === 'most' || item?.value === 'least' ? item.value : null,
                    )}
                    getItemLabel={(item) => item.label}
                    getItemId={(item) => item.value}
                    triggerClassName="h-8 w-40 shrink-0 !border-[#9ba9bd] !bg-white !text-black dark:!border-[#9ba9bd] dark:!bg-white dark:!text-black dark:hover:!bg-[#f3f4f6]"
                    className="!bg-white !text-black [&_[cmdk-group]]:!text-black [&_[cmdk-group-heading]]:!text-gray-500 [&_[cmdk-input]]:!text-black [&_[cmdk-input]]:!placeholder:text-gray-500 [&_[cmdk-item]]:!text-black"
                    forceLight
                    ariaLabel={`Set answer key for option ${index + 1}`}
                  />
                ) : (
                  <SegmentedControl
                    variant="light"
                    size="sm"
                    aria-label={`Correct answer for statement ${index + 1}`}
                    value={syllogismPattern.charAt(index) === 'Y' ? 'Y' : 'N'}
                    onValueChange={(answerValue) => {
                      const arr = syllogismPattern.split('')
                      arr[index] = answerValue
                      setSyllogismPattern(
                        arr.join('').padEnd(options.length, 'N').slice(0, options.length)
                      )
                    }}
                    options={[
                      { value: 'Y', label: 'Yes' },
                      { value: 'N', label: 'No' },
                    ]}
                  />
                )}
              </div>
              <div className="min-w-0">
                <UcatRichTextEditor
                  {...RTE}
                  {...imageProps}
                  value={opt.answerExplanation ?? null}
                  onChange={(v) => {
                    setOptions((prev) => {
                      const next = [...prev]
                      next[index] = { ...opt, answerExplanation: v }
                      return next
                    })
                  }}
                  minHeight="44px"
                  pasteTableBehavior="keep"
                  onEditorReady={onEditorReady}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {showQuestionExplanation ? (
        <div
          className="mt-3 space-y-2 border-t border-[#9ba9bd] pt-3 text-[11pt] leading-relaxed"
          style={EXPLANATION_MUTED_STYLE}
        >
          <Label className="font-medium">Question answer explanation</Label>
          <UcatRichTextEditor
            {...RTE}
            {...imageProps}
            value={answerExplanation}
            onChange={(v) => setAnswerExplanation(v)}
            minHeight="60px"
            pasteTableBehavior="keep"
            onEditorReady={onEditorReady}
          />
        </div>
      ) : null}
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
  const isMostLeast = question.answerScheme === 'situational_judgement_most_least'

  const setMostLeastAnswerKey = (optionIndex: number, value: 'most' | 'least' | null) => {
    setOptions((previous) => previous.map((option, index) => ({
      ...option,
      answerKeyValue: index === optionIndex
        ? value
        : option.answerKeyValue === value ? null : option.answerKeyValue,
      isAnswer: false,
    })))
  }

  const handleSave = () => {
    const n = options.length
    const resolvedCorrect = n > 0 ? Math.min(Math.max(0, correctOptionIndex), n - 1) : 0
    const updatedOptions = options.map((opt, i) => ({
      ...opt,
      isAnswer: isSyllogism
        ? syllogismPattern.charAt(i).toUpperCase() === 'Y'
        : isMostLeast ? false : i === resolvedCorrect,
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
    answerMode: isMostLeast ? 'most_least' : 'binary',
    setMostLeastAnswerKey,
    answerExplanation,
    setAnswerExplanation,
  }

  const shell = (body: ReactNode) => (
    <div className={`rounded-md border border-border shadow-sm ${ENGINE_LIGHT_TEXT}`}>
      <div className="max-h-[min(70vh,720px)] overflow-y-auto">{body}</div>
      <EditorFooter onSave={handleSave} onCancel={onCancel} />
    </div>
  )

  if (isSyllogism || isMostLeast) {
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
              <span className={ENGINE_MUTED_LABEL}>Stem</span>
              <UcatRichTextEditor
                {...RTE}
                value={stemText}
                onChange={(v) => setStemText(v)}
                minHeight="200px"
                pasteTableBehavior="keep"
                paragraphSpacing
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
            <span className={ENGINE_MUTED_LABEL}>Stem</span>
            <UcatRichTextEditor
              {...RTE}
              value={stemText}
              onChange={(v) => setStemText(v)}
              minHeight="200px"
              pasteTableBehavior="keep"
              paragraphSpacing
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
