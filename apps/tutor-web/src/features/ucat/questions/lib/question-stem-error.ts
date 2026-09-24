import { humanizePublishedContentError } from '@/features/ucat/shared/lifecycle-errors'

/**
 * Converts publication validation errors returned by Postgres into a message
 * suitable for question-stem save toasts. Other API errors pass through.
 */
export function humanizeQuestionStemError(rawMessage: string): string {
  return humanizePublishedContentError(rawMessage)
}
