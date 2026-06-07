import type { Json } from '@altitutor/shared'
import type { UseFormReturn } from 'react-hook-form'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { DEFAULT_OPTIONS, EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
import type { CategoryOption, UcatSectionOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'

function trimTextParagraphs(text: string): string {
  return text
    .split(/\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/^\s*\n+/, '')
    .replace(/\n+\s*$/, '')
    .trim()
}

export function applyStemTypeSwitch(
  form: UseFormReturn<UcatQuestionStemFormValues>,
  value: 'multiple_choice' | 'syllogism',
  sections: UcatSectionOption[],
  categories: CategoryOption[]
): boolean {
  const stemType = form.watch('questions.0.questionType') as 'multiple_choice' | 'syllogism' | undefined
  const currentStemType = stemType ?? 'multiple_choice'
  if (currentStemType === value) return true

  if (value === 'syllogism') {
    const currentQuestions = form.getValues('questions') ?? []
    const firstQuestion =
      currentQuestions[0] ?? {
        questionText: EMPTY_DOC,
        questionType: 'multiple_choice' as const,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: [],
        options: [...DEFAULT_OPTIONS],
      }

    const hasQuestionText =
      trimTextParagraphs(proseMirrorToPlainText(firstQuestion.questionText as Json) ?? '') !== ''
    const hasOptionContent = (firstQuestion.options ?? []).some(
      (opt) =>
        trimTextParagraphs(proseMirrorToPlainText(opt.answerText as Json) ?? '') !== '' ||
        trimTextParagraphs(
          opt.answerExplanation ? proseMirrorToPlainText(opt.answerExplanation as Json) ?? '' : ''
        ) !== ''
    )

    const otherQuestionsHaveData = currentQuestions.slice(1).some((question) => {
      const hasOtherQuestionText =
        trimTextParagraphs(proseMirrorToPlainText(question.questionText as Json) ?? '') !== ''
      const hasOtherOptionContent = (question.options ?? []).some(
        (opt) =>
          trimTextParagraphs(proseMirrorToPlainText(opt.answerText as Json) ?? '') !== '' ||
          trimTextParagraphs(
            opt.answerExplanation ? proseMirrorToPlainText(opt.answerExplanation as Json) ?? '' : ''
          ) !== ''
      )
      return hasOtherQuestionText || hasOtherOptionContent
    })

    const willRemoveData = hasQuestionText || hasOptionContent || otherQuestionsHaveData

    if (willRemoveData) {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(
              'Switching the type to "Syllogism" will reset questions and statements and remove existing question text and options. Do you want to continue?'
            )
          : false

      if (!confirmed) return false
    }

    const syllogismTemplateQuestion = {
      ...firstQuestion,
      questionType: 'syllogism' as const,
      questionText: plainTextToProseMirror(
        'Place ‘Yes’ if the conclusion does follow. Place ‘No’ if the conclusion does not follow.'
      ) as Json,
      options: Array.from({ length: 5 }, () => ({
        answerText: EMPTY_DOC,
        answerExplanation: null,
        isAnswer: false,
      })),
    }

    form.setValue('questions', [syllogismTemplateQuestion], { shouldDirty: true })

    const decisionMakingSection = sections.find((section) => section.name === 'Decision Making')
    if (decisionMakingSection?.id) {
      form.setValue('sectionId', decisionMakingSection.id, { shouldDirty: true })
    }

    const sectionIdForCategory = decisionMakingSection?.id ?? form.getValues('sectionId')
    const syllogismsCategory = categories.find((category) => {
      const rawName = (category.name ?? '').toLowerCase().trim()
      const normalizedName = rawName.replace(/\\+$/g, '')
      return normalizedName.startsWith('syllogism') && (category.ucat_section_id ?? null) === sectionIdForCategory
    })
    if (syllogismsCategory?.id) {
      form.setValue('categoryId', syllogismsCategory.id, { shouldDirty: true })
    }

    return true
  }

  const currentQuestions = form.getValues('questions') ?? []
  currentQuestions.forEach((_, i) => {
    form.setValue(`questions.${i}.questionType`, value, { shouldDirty: true })
  })
  return true
}
