import { ZodError } from 'zod'
import {
  UcatAiEmptyResponseError,
  UcatAiJsonParseError,
} from '@/features/ucat/shared/server/ucat-ai-client'

export type StructuredOutputRetryContext = {
  attempt: number
  previousError: string | null
}

const RETRYABLE_VALIDATION_PREFIXES = [
  'Assessment returned',
  'Bulk repair returned',
  'Bulk repair referenced',
  'Blind solver returned',
  'Blind solver did not',
]

function retryableStructuredOutputError(error: unknown): boolean {
  if (error instanceof ZodError
    || error instanceof UcatAiJsonParseError
    || error instanceof UcatAiEmptyResponseError) return true
  return error instanceof Error
    && RETRYABLE_VALIDATION_PREFIXES.some((prefix) => error.message.startsWith(prefix))
}

function conciseError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Invalid structured response'
  return message.replace(/\s+/gu, ' ').slice(0, 300)
}

export function promptWithStructuredOutputRetry(
  prompt: string,
  context: StructuredOutputRetryContext,
): string {
  if (context.attempt === 0) return prompt
  return `${prompt}\n\nYour previous response was rejected: ${context.previousError ?? 'invalid structured response'}. Return one complete JSON object matching the requested schema. Use only supplied IDs, make every finding key unique, and do not truncate the response.`
}

/** One corrective retry for malformed or schema-invalid model output. */
export async function runWithStructuredOutputRetry<T>(
  operation: (context: StructuredOutputRetryContext) => Promise<T>,
): Promise<T> {
  let previousError: string | null = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation({ attempt, previousError })
    } catch (error) {
      if (attempt === 1 || !retryableStructuredOutputError(error)) throw error
      previousError = conciseError(error)
    }
  }
  throw new Error('Structured output retry exhausted')
}
