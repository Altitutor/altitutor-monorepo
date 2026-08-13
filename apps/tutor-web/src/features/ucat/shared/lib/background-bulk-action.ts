export type BackgroundBulkToast = {
  title?: string
  description?: string
  action?: { label: string; onClick: () => void }
  variant?: 'default' | 'destructive'
  duration?: number
  id?: string | number
}

export type InFlightIdStore = {
  ids: Set<string>
}

export type BackgroundBulkAction<T> = {
  ids: string[]
  toastId: string
  progress: BackgroundBulkToast
  begin: () => void
  run: () => Promise<T>
  onSuccess: (result: T) => BackgroundBulkToast | BackgroundBulkToast[] | void
  onError: (error: unknown) => BackgroundBulkToast
}

let toastSeq = 0

export function nextBulkActionToastId(kind: string) {
  toastSeq += 1
  return `ucat-bulk-${kind}-${toastSeq}`
}

export function createInFlightIdStore(): InFlightIdStore {
  return { ids: new Set() }
}

export function hasInFlightOverlap(store: InFlightIdStore, ids: string[]) {
  return ids.some((id) => store.ids.has(id))
}

function pluralize(count: number, noun: string) {
  return count === 1 ? noun : `${noun}s`
}

export function bulkStatusProgressToast(
  count: number,
  noun: string,
  status: 'draft' | 'in_review' | 'published',
): BackgroundBulkToast {
  const displayStatus = status === 'in_review' ? 'In review' : status[0].toUpperCase() + status.slice(1)
  return { title: `Moving ${count} ${pluralize(count, noun)} to ${displayStatus}...` }
}

export function bulkDeleteProgressToast(count: number, noun: string): BackgroundBulkToast {
  return { title: `Deleting ${count} ${pluralize(count, noun)}...` }
}

export function bulkUpdateProgressToast(count: number, noun: string, subject: string): BackgroundBulkToast {
  return { title: `Updating ${subject} for ${count} ${pluralize(count, noun)}...` }
}

export function startBackgroundBulkAction<T>({
  store,
  toast,
  dismiss,
  onInFlightChange,
  action,
}: {
  store: InFlightIdStore
  toast: (input: BackgroundBulkToast) => void
  dismiss: (toastId?: string | number) => void
  onInFlightChange?: () => void
  action: BackgroundBulkAction<T>
}): boolean {
  const { ids, toastId, progress, begin, run, onSuccess, onError } = action
  if (ids.length === 0) return false
  if (hasInFlightOverlap(store, ids)) {
    toast({
      title: 'Already in progress',
      description: 'Wait for the current bulk action on these items to finish.',
      variant: 'destructive',
    })
    return false
  }

  for (const id of ids) store.ids.add(id)
  onInFlightChange?.()
  begin()
  toast({
    ...progress,
    id: toastId,
    duration: progress.duration ?? Infinity,
  })

  const release = () => {
    for (const id of ids) store.ids.delete(id)
    onInFlightChange?.()
  }

  void run()
    .then((result) => {
      release()
      const next = onSuccess(result)
      const toasts = next == null ? [] : Array.isArray(next) ? next : [next]
      if (toasts.length === 0) {
        dismiss(toastId)
        return
      }
      toasts.forEach((item, index) => {
        toast({
          ...item,
          id: index === 0 ? toastId : item.id,
        })
      })
    })
    .catch((error: unknown) => {
      release()
      toast({
        ...onError(error),
        id: toastId,
      })
    })

  return true
}
