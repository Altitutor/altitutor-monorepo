export type UcatLifecycleEntityType =
  | 'stem'
  | 'set'
  | 'mock'
  | 'session'
  | 'learning_module'

export type UcatLifecycleBlocker = {
  code: string
  message: string
  entity_type?: UcatLifecycleEntityType | null
  entity_id?: string | null
  entity_name?: string | null
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
    blockers?: UcatLifecycleBlocker[]
  }
  throw new UcatLifecycleError(body.error ?? fallback, body.blockers ?? [])
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

export function lifecycleErrorToast(
  error: unknown,
  title: string,
  navigate: (href: string) => void,
) {
  const blocker = error instanceof UcatLifecycleError ? error.blockers[0] : null
  const action = blocker ? blockerAction(blocker) : null
  const extraCount = error instanceof UcatLifecycleError ? Math.max(0, error.blockers.length - 1) : 0
  const message = error instanceof Error ? error.message : 'The lifecycle change could not be completed.'

  return {
    title,
    description: extraCount > 0 ? `${message} There ${extraCount === 1 ? 'is' : 'are'} ${extraCount} more blocker${extraCount === 1 ? '' : 's'}.` : message,
    variant: 'destructive' as const,
    ...(action
      ? {
          action: {
            label: action.label,
            onClick: () => navigate(action.href),
          },
        }
      : {}),
  }
}
