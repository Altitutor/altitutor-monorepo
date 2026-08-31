export type UcatLifecycleEntityType =
  | 'stem'
  | 'set'
  | 'mock'
  | 'session'
  | 'learning_module'

export type UcatDeleteContentType = 'stem' | 'set' | 'mock' | 'lesson'

export type UcatLifecycleBlocker = {
  code: string
  message: string
  entity_type?: UcatLifecycleEntityType | null
  entity_id?: string | null
  entity_name?: string | null
}

const LIFECYCLE_ENTITY_TYPES = new Set<UcatLifecycleEntityType>([
  'stem',
  'set',
  'mock',
  'session',
  'learning_module',
])

export const UCAT_DELETE_BLOCKED_FALLBACK: Record<UcatDeleteContentType, string> = {
  stem: 'This question is still used by a set, session, or lesson and cannot be deleted.',
  set: 'This set is still used by a mock or session and cannot be deleted.',
  mock: 'This mock is still attached to a session and cannot be deleted.',
  lesson: 'This lesson is still attached to a session and cannot be deleted.',
}

export function isUcatDeleteBlockedError(message: string): boolean {
  return message.includes('delete_blocked_by_dependency') || message.includes('status_blocked_by_attachment')
}

export function failedUcatDeleteContentId(message: string, fallbackId: string): string {
  return message.match(/bulk_(?:delete|update)_item:([0-9a-f-]{36}):/i)?.[1] ?? fallbackId
}

export const UCAT_VISIBILITY_BLOCKED_FALLBACK = {
  public_set_contains_private_stem:
    'This public set contains a private question. Make that question public or remove it from the set first.',
  private_child_of_public_set:
    'Cannot make this question private while it belongs to a public set. Remove it from that set or make the set private first.',
  private_child_of_public_mock:
    'Cannot make this set private while it belongs to a public mock. Remove it from that mock or make the mock private first.',
  public_mock_contains_private_set:
    'This public mock contains a private set. Make that set public or remove it from the mock first.',
} as const

export type UcatVisibilityBlockedCode = keyof typeof UCAT_VISIBILITY_BLOCKED_FALLBACK

export type UcatVisibilityContentType = 'stem' | 'set' | 'mock'

export function isUcatVisibilityBlockedError(message: string): boolean {
  return (Object.keys(UCAT_VISIBILITY_BLOCKED_FALLBACK) as UcatVisibilityBlockedCode[])
    .some((code) => message.includes(code))
}

export function ucatVisibilityBlockedFallbackMessage(message: string): string {
  const code = (Object.keys(UCAT_VISIBILITY_BLOCKED_FALLBACK) as UcatVisibilityBlockedCode[])
    .find((candidate) => message.includes(candidate))
  return code
    ? UCAT_VISIBILITY_BLOCKED_FALLBACK[code]
    : 'This visibility change is blocked by another UCAT item.'
}

export function isUcatVisibilityBlockedMessage(message: string): boolean {
  return isUcatVisibilityBlockedError(message)
    || (Object.values(UCAT_VISIBILITY_BLOCKED_FALLBACK) as string[]).some((fallback) => message.includes(fallback))
}

export function ucatVisibilityBlockedPayload(blockers: UcatLifecycleBlocker[], message: string) {
  return {
    error: blockers[0]?.message || ucatVisibilityBlockedFallbackMessage(message),
    blockers,
  }
}

function parseLifecycleBlocker(value: unknown): UcatLifecycleBlocker | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.code !== 'string' || typeof row.message !== 'string') return null
  const entityType = row.entity_type
  return {
    code: row.code,
    message: row.message,
    entity_type:
      typeof entityType === 'string' && LIFECYCLE_ENTITY_TYPES.has(entityType as UcatLifecycleEntityType)
        ? (entityType as UcatLifecycleEntityType)
        : null,
    entity_id: typeof row.entity_id === 'string' ? row.entity_id : null,
    entity_name: typeof row.entity_name === 'string' ? row.entity_name : null,
  }
}

export function parseUcatLifecycleBlockers(data: unknown): UcatLifecycleBlocker[] {
  const raw = typeof data === 'string'
    ? (() => {
        try {
          return JSON.parse(data) as unknown
        } catch {
          return null
        }
      })()
    : data
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const blocker = parseLifecycleBlocker(item)
    return blocker ? [blocker] : []
  })
}

export function publicationBlockedBlockers(rawMessage: string): UcatLifecycleBlocker[] {
  const marker = 'publication_blocked:'
  const index = rawMessage.indexOf(marker)
  if (index < 0) return []
  return parseUcatLifecycleBlockers(rawMessage.slice(index + marker.length))
}

export function ucatDeleteBlockedPayload(
  blockers: UcatLifecycleBlocker[],
  contentType: UcatDeleteContentType,
) {
  return {
    error: blockers[0]?.message || UCAT_DELETE_BLOCKED_FALLBACK[contentType],
    blockers,
  }
}

export type UcatBulkStatusFailure = {
  contentId: string
  error: string
  blockers: UcatLifecycleBlocker[]
}

export type UcatBulkStatusResult = {
  movedIds: string[]
  failures: UcatBulkStatusFailure[]
}

export class UcatLifecycleError extends Error {
  blockers: UcatLifecycleBlocker[]

  constructor(message: string, blockers: UcatLifecycleBlocker[] = []) {
    super(message)
    this.name = 'UcatLifecycleError'
    this.blockers = blockers
  }
}

export async function throwUcatLifecycleResponseError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string
    blockers?: unknown
  }
  throw new UcatLifecycleError(body.error ?? fallback, parseUcatLifecycleBlockers(body.blockers))
}

export async function readUcatBulkStatusResponse(
  response: Response,
  fallback: string,
): Promise<UcatBulkStatusResult> {
  if (!response.ok) await throwUcatLifecycleResponseError(response, fallback)
  const body = (await response.json()) as Partial<UcatBulkStatusResult>
  return {
    movedIds: Array.isArray(body.movedIds) ? body.movedIds : [],
    failures: Array.isArray(body.failures) ? body.failures : [],
  }
}

export function throwFirstUcatBulkStatusFailure(result: UcatBulkStatusResult): void {
  const failure = result.failures[0]
  if (failure) throw new UcatLifecycleError(failure.error, failure.blockers)
}

export function firstUcatBulkStatusFailureError(result: UcatBulkStatusResult): UcatLifecycleError | null {
  const failure = result.failures[0]
  return failure ? new UcatLifecycleError(failure.error, failure.blockers) : null
}

function blockerAction(blocker: UcatLifecycleBlocker) {
  if (!blocker.entity_id || !blocker.entity_type) return null
  switch (blocker.entity_type) {
    case 'stem':
      return { label: 'View question', href: `/ucat/questions/${blocker.entity_id}` }
    case 'set':
      return { label: 'View set', href: `/ucat/sets/${blocker.entity_id}` }
    case 'mock':
      return { label: 'View mock', href: `/ucat/mocks/${blocker.entity_id}` }
    case 'learning_module':
      return { label: 'View module', href: `/ucat/learning-modules/${blocker.entity_id}` }
    case 'session':
      return { label: 'View classes', href: '/ucat/classes' }
  }
}

export const UCAT_SET_SECTION_FALLBACK = {
  question_set_section_required: 'Choose a UCAT section for this set.',
  ucat_section_not_found: 'That UCAT section was not found.',
  question_set_section_has_members: 'Remove every stem from this set before changing its section.',
  question_set_stem_section_mismatch: 'Every stem in a set must belong to the set’s section.',
  question_stem_section_frozen_by_set: 'Remove this stem from its set before changing its section.',
  question_set_restore_section_mismatch:
    'This set cannot be restored until every remaining member stem matches its section.',
} as const

export function ucatSetSectionFallbackMessage(message: string): string {
  const code = (Object.keys(UCAT_SET_SECTION_FALLBACK) as Array<keyof typeof UCAT_SET_SECTION_FALLBACK>)
    .find((candidate) => message.includes(candidate))
  return code ? UCAT_SET_SECTION_FALLBACK[code] : message
}

export function lifecycleErrorToast(
  error: unknown,
  title: string,
  navigate: (href: string) => void,
  openEntity?: (entityType: UcatLifecycleEntityType, entityId: string) => boolean,
) {
  const blocker = error instanceof UcatLifecycleError ? error.blockers[0] : null
  const action = blocker ? blockerAction(blocker) : null
  const extraCount = error instanceof UcatLifecycleError ? Math.max(0, error.blockers.length - 1) : 0
  const rawMessage = error instanceof Error ? error.message : 'The lifecycle change could not be completed.'
  const message = ucatSetSectionFallbackMessage(rawMessage)

  return {
    title,
    description: extraCount > 0 ? `${message} There ${extraCount === 1 ? 'is' : 'are'} ${extraCount} more blocker${extraCount === 1 ? '' : 's'}.` : message,
    variant: 'destructive' as const,
    ...(action
      ? {
          action: {
            label: blocker && isUcatVisibilityBlockedError(blocker.code)
              ? action.label
              : openEntity && blocker?.entity_type && ['stem', 'set', 'mock'].includes(blocker.entity_type)
                ? action.label.replace('View', 'Edit')
                : action.label,
            onClick: () => {
              if (
                blocker?.entity_type &&
                blocker.entity_id &&
                openEntity?.(blocker.entity_type, blocker.entity_id)
              ) return
              navigate(action.href)
            },
          },
        }
      : {}),
  }
}

export function lifecycleStatusSuccessToast({
  contentLabel,
  count,
  status,
  onUndo,
}: {
  contentLabel: string
  count: number
  status: 'draft' | 'in_review' | 'published'
  onUndo: () => void
}) {
  const displayStatus = status === 'in_review' ? 'In review' : status[0].toUpperCase() + status.slice(1)
  return {
    title: count === 1
      ? `${contentLabel} moved to ${displayStatus}`
      : `${count} ${contentLabel.toLowerCase()}s moved to ${displayStatus}`,
    description: 'Tap Undo to restore the previous status.',
    duration: 10_000,
    action: {
      label: 'Undo',
      onClick: onUndo,
    },
  }
}
