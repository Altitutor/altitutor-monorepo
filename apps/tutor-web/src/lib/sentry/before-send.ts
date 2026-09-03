type TutorWebSentryEvent = {
  message?: string
  exception?: {
    values?: Array<{ value?: string }>
  }
}

type TutorWebSentryHint = {
  originalException?: unknown
}

const EXPECTED_UCAT_DOMAIN_OUTCOMES = [
  'delete_blocked_by_dependency',
  'status_blocked_by_attachment',
  'published_content_invalid:',
  'public_set_contains_private_stem',
  'private_child_of_public_set',
  'private_child_of_public_mock',
  'public_mock_contains_private_set',
  'audit_target_not_in_progress',
] as const

function originalExceptionMessage(originalException: unknown): string | undefined {
  if (originalException instanceof Error) return originalException.message
  if (!originalException || typeof originalException !== 'object') return undefined
  const message = (originalException as { message?: unknown }).message
  return typeof message === 'string' ? message : undefined
}

function isExpectedUcatDomainOutcome(message: string | undefined): boolean {
  return Boolean(message && EXPECTED_UCAT_DOMAIN_OUTCOMES.some((code) => message.includes(code)))
}

export function filterExpectedTutorWebError<TEvent extends TutorWebSentryEvent>(
  event: TEvent,
  hint?: TutorWebSentryHint,
): TEvent | null {
  const messages = [
    event.message,
    ...(event.exception?.values?.map((value) => value.value) ?? []),
    originalExceptionMessage(hint?.originalException),
  ]

  return messages.some(isExpectedUcatDomainOutcome) ? null : event
}
