import {
  compileResponseContract,
  getAnswerSchemeContract,
  type AnswerScheme,
  type ContractIssue,
  type ResponseType,
} from '@altitutor/ucat-response-contract'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'

export type AnswerSchemeKind = AnswerScheme['kind']
export type AnswerKeyValue = 'correct' | 'yes' | 'no' | 'most' | 'least' | null
export type AuthoredQuestion = UcatQuestionStemFormValues['questions'][number]

export type SuggestedResponseContract = {
  responseType: ResponseType
  answerScheme: AnswerSchemeKind
}

export function shouldApplyCategoryDefaults(input: {
  stemId: string | null | undefined
  previousCategoryId: string | null | undefined
  questionsDirty: boolean
}): boolean {
  return input.stemId == null
    && input.previousCategoryId == null
    && !input.questionsDirty
}

export function normalizeAuthoredQuestionContract(question: AuthoredQuestion): AuthoredQuestion {
  const responseType = question.responseType ?? (
    question.questionType === 'syllogism' ? 'drag_and_drop' : 'multiple_choice'
  )
  const answerScheme = question.answerScheme ?? (
    question.questionType === 'syllogism'
      ? 'decision_making_binary_placement'
      : 'single_choice'
  )
  return {
    ...question,
    responseType,
    answerScheme,
    options: question.options.map((option) => ({
      ...option,
      answerKeyValue: option.answerKeyValue ?? (
        answerScheme === 'decision_making_binary_placement'
          ? option.isAnswer ? 'yes' : 'no'
          : option.isAnswer ? 'correct' : null
      ),
    })),
  }
}

export function suggestedResponseContract(
  categoryName: string | null | undefined,
  sectionName: string | null | undefined,
): SuggestedResponseContract {
  const category = (categoryName ?? '').trim().toLowerCase()
  const section = (sectionName ?? '').trim().toLowerCase()

  if (category === 'most/least appropriate') {
    return { responseType: 'drag_and_drop', answerScheme: 'situational_judgement_most_least' }
  }
  if (
    category.startsWith('syllogism')
    || category === 'interpreting information and drawing conclusions'
  ) {
    return { responseType: 'drag_and_drop', answerScheme: 'decision_making_binary_placement' }
  }
  if (section === 'situational judgement') {
    return { responseType: 'multiple_choice', answerScheme: 'situational_judgement_rating' }
  }
  return { responseType: 'multiple_choice', answerScheme: 'single_choice' }
}

export function responseContractForType(
  responseType: ResponseType,
  categoryName: string | null | undefined,
  sectionName: string | null | undefined,
): SuggestedResponseContract {
  const suggested = suggestedResponseContract(categoryName, sectionName)
  if (suggested.responseType === responseType) return suggested

  if (responseType === 'multiple_choice') {
    return {
      responseType,
      answerScheme: (sectionName ?? '').trim().toLowerCase() === 'situational judgement'
        ? 'situational_judgement_rating'
        : 'single_choice',
    }
  }

  return {
    responseType,
    answerScheme: (categoryName ?? '').trim().toLowerCase() === 'most/least appropriate'
      ? 'situational_judgement_most_least'
      : 'decision_making_binary_placement',
  }
}

function optionId(question: AuthoredQuestion, index: number): string {
  return question.options[index]?.id ?? `draft-option-${index}`
}

function answerSchemeDefinition(question: AuthoredQuestion): AnswerScheme {
  const kind = question.answerScheme ?? (
    question.questionType === 'syllogism'
      ? 'decision_making_binary_placement'
      : 'single_choice'
  )
  const keyed = question.options.map((option, index) => ({
    id: optionId(question, index),
    value: option.answerKeyValue ?? (
      question.questionType === 'syllogism'
        ? option.isAnswer ? 'yes' : 'no'
        : option.isAnswer ? 'correct' : null
    ),
  }))

  if (kind === 'decision_making_binary_placement') {
    return {
      kind,
      correctByOptionId: Object.fromEntries(
        keyed
          .filter((entry): entry is { id: string; value: 'yes' | 'no' } => entry.value === 'yes' || entry.value === 'no')
          .map((entry) => [entry.id, entry.value]),
      ),
    }
  }
  if (kind === 'situational_judgement_most_least') {
    return {
      kind,
      mostAppropriateOptionId: keyed.find((entry) => entry.value === 'most')?.id ?? '',
      leastAppropriateOptionId: keyed.find((entry) => entry.value === 'least')?.id ?? '',
    }
  }
  return {
    kind,
    correctOptionId: keyed.find((entry) => entry.value === 'correct')?.id ?? '',
  }
}

export function responseContractIssues(question: AuthoredQuestion): readonly ContractIssue[] {
  const result = compileResponseContract({
    questionId: question.id ?? 'draft-question',
    responseType: question.responseType ?? (
      question.questionType === 'syllogism' ? 'drag_and_drop' : 'multiple_choice'
    ),
    answerScheme: answerSchemeDefinition(question),
    options: question.options.map((_, index) => ({ id: optionId(question, index), index })),
  })
  return result.ok ? [] : result.issues
}

function optionForTransform(
  question: AuthoredQuestion,
  index: number,
  answerKeyValue: AnswerKeyValue,
): AuthoredQuestion['options'][number] {
  const existing = question.options[index]
  return {
    ...(existing ?? { answerText: EMPTY_DOC, answerExplanation: null }),
    isAnswer: answerKeyValue === 'correct' || answerKeyValue === 'yes',
    answerKeyValue,
  }
}

export function transformResponseContract(
  question: AuthoredQuestion,
  target: SuggestedResponseContract,
): AuthoredQuestion {
  const existingCorrectIndex = Math.max(0, question.options.findIndex((option) => (
    option.answerKeyValue === 'correct' || option.isAnswer
  )))
  const optionCountContract = getAnswerSchemeContract(target.answerScheme).optionCount
  const optionCount = typeof optionCountContract === 'number'
    ? optionCountContract
    : Math.max(optionCountContract.minimum, question.options.length)

  const options = Array.from({ length: optionCount }, (_, index) => {
    let key: AnswerKeyValue = null
    if (target.answerScheme === 'decision_making_binary_placement') {
      key = question.options[index]?.answerKeyValue === 'yes' ? 'yes' : 'no'
    } else if (target.answerScheme === 'situational_judgement_most_least') {
      key = index === 0 ? 'most' : index === 1 ? 'least' : null
    } else if (index === Math.min(existingCorrectIndex, optionCount - 1)) {
      key = 'correct'
    }
    return optionForTransform(question, index, key)
  })

  return {
    ...question,
    questionType: target.responseType === 'drag_and_drop' ? 'syllogism' : 'multiple_choice',
    responseType: target.responseType,
    answerScheme: target.answerScheme,
    options,
  }
}
