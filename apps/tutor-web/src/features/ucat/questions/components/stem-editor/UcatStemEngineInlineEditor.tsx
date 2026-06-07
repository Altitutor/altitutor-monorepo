'use client'

import { useMemo } from 'react'
import type { Json } from '@altitutor/shared'
import type { UseFormReturn } from 'react-hook-form'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/components/ucat/ucat-theme'
import { Label } from '@altitutor/ui'
import {
  ResultsMcQuestionBlock,
  ResultsSyllogismQuestionBlock,
} from '@/features/ucat/question-engine-preview/UcatResultsStyleQuestionEditor'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'

const RTE = { forceLightChrome: true as const }

const ENGINE_LIGHT_TEXT =
  'bg-white text-black [color-scheme:light] dark:bg-white dark:text-black'

type UcatStemEngineInlineEditorProps = {
  form: UseFormReturn<UcatQuestionStemFormValues>
  questionIndex: number
  sectionDisplayColumns: 1 | 2
  stemId?: string | null
  enableImages?: boolean
  onNewImageFileIds?: (fileIds: string[]) => void
}

export function UcatStemEngineInlineEditor({
  form,
  questionIndex,
  sectionDisplayColumns,
  stemId = null,
  enableImages = true,
  onNewImageFileIds,
}: UcatStemEngineInlineEditorProps) {
  const stemType = (form.watch('questions.0.questionType') ?? 'multiple_choice') as
    | 'multiple_choice'
    | 'syllogism'
  const isSyllogism = stemType === 'syllogism'
  const isTwoColumn = sectionDisplayColumns === 2

  const stemText = form.watch('stemText') as Json
  const question = form.watch(`questions.${questionIndex}`)
  const options = useMemo(() => question?.options ?? [], [question?.options])

  const correctOptionIndex = useMemo(() => {
    const idx = options.findIndex((opt) => opt.isAnswer)
    return idx >= 0 ? idx : 0
  }, [options])

  const syllogismPattern = useMemo(
    () => options.map((opt) => (opt.isAnswer ? 'Y' : 'N')).join(''),
    [options]
  )

  const imageHandlers = {
    stemId: enableImages ? stemId : null,
    enableImages,
    onImageFileIdsChange: onNewImageFileIds,
  }

  const setStemText = (value: Json | null | undefined) => {
    form.setValue('stemText', value ?? EMPTY_DOC, { shouldDirty: true })
  }

  const setQuestionText = (value: Json | null | undefined) => {
    form.setValue(`questions.${questionIndex}.questionText`, value ?? EMPTY_DOC, { shouldDirty: true })
  }

  const setOptions = (
    updater: UcatQuestionStemFormValues['questions'][number]['options'] | ((prev: UcatQuestionStemFormValues['questions'][number]['options']) => UcatQuestionStemFormValues['questions'][number]['options'])
  ) => {
    const current = form.getValues(`questions.${questionIndex}.options`) ?? []
    const next = typeof updater === 'function' ? updater(current) : updater
    form.setValue(`questions.${questionIndex}.options`, next, { shouldDirty: true })
  }

  const setCorrectOptionIndex = (index: number) => {
    const current = form.getValues(`questions.${questionIndex}.options`) ?? []
    form.setValue(
      `questions.${questionIndex}.options`,
      current.map((opt, i) => ({ ...opt, isAnswer: i === index })),
      { shouldDirty: true }
    )
  }

  const setSyllogismPattern = (pattern: string) => {
    const current = form.getValues(`questions.${questionIndex}.options`) ?? []
    form.setValue(
      `questions.${questionIndex}.options`,
      current.map((opt, i) => ({
        ...opt,
        isAnswer: pattern.charAt(i).toUpperCase() === 'Y',
      })),
      { shouldDirty: true }
    )
  }

  const setAnswerExplanation = (value: Json | null | undefined) => {
    form.setValue(`questions.${questionIndex}.answerExplanation`, value ?? null, { shouldDirty: true })
  }

  const optionLabel = (index: number) => String.fromCharCode(65 + index)
  const questionNumber = questionIndex + 1

  const mcBlock = (
    <ResultsMcQuestionBlock
      includeStem={!isTwoColumn}
      stemText={stemText}
      setStemText={setStemText}
      questionText={(question?.questionText ?? EMPTY_DOC) as Json}
      setQuestionText={setQuestionText}
      questionNumber={questionNumber}
      options={options}
      setOptions={setOptions}
      correctOptionIndex={correctOptionIndex}
      setCorrectOptionIndex={setCorrectOptionIndex}
      answerExplanation={(question?.answerExplanation ?? null) as Json | null}
      setAnswerExplanation={setAnswerExplanation}
      optionLabel={optionLabel}
      showOptionExplanations={false}
      showQuestionExplanation
      allowOptionAddRemove
      {...imageHandlers}
    />
  )

  const syllogismBlock = (
    <ResultsSyllogismQuestionBlock
      includeStem={!isTwoColumn}
      stemText={stemText}
      setStemText={setStemText}
      questionText={(question?.questionText ?? EMPTY_DOC) as Json}
      setQuestionText={setQuestionText}
      questionNumber={questionNumber}
      options={options}
      setOptions={setOptions}
      syllogismPattern={syllogismPattern}
      setSyllogismPattern={setSyllogismPattern}
      answerExplanation={(question?.answerExplanation ?? null) as Json | null}
      setAnswerExplanation={setAnswerExplanation}
      showQuestionExplanation={false}
      {...imageHandlers}
    />
  )

  const body = isSyllogism ? syllogismBlock : mcBlock

  if (isTwoColumn) {
    return (
      <div
        className={`flex h-full min-h-0 gap-4 font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed ${ENGINE_LIGHT_TEXT}`}
      >
        <article
          className="flex-[3] h-full min-w-0 overflow-y-auto border-r-[6px] py-4 pr-4 sm:py-5"
          style={{ borderRightColor: UCAT_COLORS.primaryBlue }}
          data-ucat-preview-scroll-target="true"
        >
          <div className="space-y-2 px-3">
            <Label className="text-xs font-medium text-[#5a6c7d]">Stem</Label>
            <UcatRichTextEditor
              {...RTE}
              {...imageHandlers}
              value={stemText}
              onChange={(v) => setStemText(v)}
              minHeight="200px"
              pasteTableBehavior="keep"
            />
          </div>
        </article>
        <section
          className="flex-[2] h-full min-w-0 overflow-y-auto py-4 pl-2 pr-1 sm:py-5"
          data-ucat-preview-scroll-target="true"
        >
          {isSyllogism ? (
            <ResultsSyllogismQuestionBlock
              includeStem={false}
              stemText={stemText}
              setStemText={setStemText}
              questionText={(question?.questionText ?? EMPTY_DOC) as Json}
              setQuestionText={setQuestionText}
              questionNumber={questionNumber}
              options={options}
              setOptions={setOptions}
              syllogismPattern={syllogismPattern}
              setSyllogismPattern={setSyllogismPattern}
              answerExplanation={(question?.answerExplanation ?? null) as Json | null}
              setAnswerExplanation={setAnswerExplanation}
              showQuestionExplanation={false}
              {...imageHandlers}
            />
          ) : (
            <ResultsMcQuestionBlock
              includeStem={false}
              stemText={stemText}
              setStemText={setStemText}
              questionText={(question?.questionText ?? EMPTY_DOC) as Json}
              setQuestionText={setQuestionText}
              questionNumber={questionNumber}
              options={options}
              setOptions={setOptions}
              correctOptionIndex={correctOptionIndex}
              setCorrectOptionIndex={setCorrectOptionIndex}
              answerExplanation={(question?.answerExplanation ?? null) as Json | null}
              setAnswerExplanation={setAnswerExplanation}
              optionLabel={optionLabel}
              showOptionExplanations={false}
              showQuestionExplanation
              allowOptionAddRemove
              {...imageHandlers}
            />
          )}
        </section>
      </div>
    )
  }

  return (
    <div
      className={`h-full min-h-0 overflow-y-auto font-[${UCAT_FONTS.body}] text-[11pt] leading-relaxed ${ENGINE_LIGHT_TEXT}`}
      data-ucat-preview-scroll-target="true"
    >
      <div className="space-y-4 py-4 sm:py-5">{body}</div>
    </div>
  )
}
