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

type AuthoredQuestionInput = Omit<AuthoredQuestion, 'options'> & {
  options?: AuthoredQuestion['options'] | null
}

export type SuggestedResponseContract = {
  responseType: ResponseType
  answerScheme: AnswerSchemeKind
}

const INTERPRETING_INFORMATION_CATEGORY = 'interpreting information and drawing conclusions'

export function allowsResponseTypeChoice(categoryName: string | null | undefined): boolean {
  return (categoryName ?? '').trim().toLowerCase().startsWith('interpreting information')
}

export function authoredResponseContract(
  question: Pick<AuthoredQuestion, 'responseType' | 'answerScheme'>,
): SuggestedResponseContract {
  return {
    responseType: question.responseType,
    answerScheme: question.answerScheme,
  }
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
  return {
    ...question,
    options: authoredOptions(question).map((option) => ({
      ...option,
      answerKeyValue: option.answerKeyValue,
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
    || category === INTERPRETING_INFORMATION_CATEGORY
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
    answerScheme: 'decision_making_binary_placement',
  }
}

function authoredOptions(question: AuthoredQuestionInput): AuthoredQuestion['options'] {
  return question.options ?? []
}

function optionId(question: AuthoredQuestionInput, index: number): string {
  return authoredOptions(question)[index]?.id ?? `draft-option-${index}`
}

function answerSchemeDefinition(question: AuthoredQuestionInput): AnswerScheme {
  const { answerScheme: kind } = authoredResponseContract(question)
  const keyed = authoredOptions(question).map((option, index) => ({
    id: optionId(question, index),
    value: option.answerKeyValue,
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

export function responseContractIssues(question: AuthoredQuestionInput): readonly ContractIssue[] {
  const { responseType } = authoredResponseContract(question)
  const result = compileResponseContract({
    questionId: question.id ?? 'draft-question',
    responseType,
    answerScheme: answerSchemeDefinition(question),
    options: authoredOptions(question).map((_, index) => ({ id: optionId(question, index), index })),
  })
  return result.ok ? [] : result.issues
}

function optionForTransform(
  question: AuthoredQuestion,
  index: number,
  answerKeyValue: AnswerKeyValue,
): AuthoredQuestion['options'][number] {
  const existing = authoredOptions(question)[index]
  return {
    ...(existing ?? { answerText: EMPTY_DOC, answerExplanation: null }),
    answerKeyValue,
  }
}

export function transformResponseContract(
  question: AuthoredQuestion,
  target: SuggestedResponseContract,
): AuthoredQuestion {
  const existingOptions = authoredOptions(question)
  const existingCorrectIndex = Math.max(0, existingOptions.findIndex((option) => (
    option.answerKeyValue === 'correct'
  )))
  const optionCountContract = getAnswerSchemeContract(target.answerScheme).optionCount
  const optionCount = typeof optionCountContract === 'number'
    ? optionCountContract
    : Math.max(optionCountContract.minimum, existingOptions.length)

  const options = Array.from({ length: optionCount }, (_, index) => {
    let key: AnswerKeyValue = null
    if (target.answerScheme === 'decision_making_binary_placement') {
      key = existingOptions[index]?.answerKeyValue === 'yes' ? 'yes' : 'no'
    } else if (target.answerScheme === 'situational_judgement_most_least') {
      key = index === 0 ? 'most' : index === 1 ? 'least' : null
    } else if (index === Math.min(existingCorrectIndex, optionCount - 1)) {
      key = 'correct'
    }
    return optionForTransform(question, index, key)
  })

  return {
    ...question,
    responseType: target.responseType,
    answerScheme: target.answerScheme,
    options,
  }
}
