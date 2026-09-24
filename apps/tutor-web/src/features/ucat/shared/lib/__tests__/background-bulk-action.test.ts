import {
  bulkDeleteProgressToast,
  bulkStatusProgressToast,
  bulkUpdateProgressToast,
  createInFlightIdStore,
  hasInFlightOverlap,
  startBackgroundBulkAction,
} from '../background-bulk-action'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('bulk action progress copy', () => {
  it('names a status move while it is still running', () => {
    expect(bulkStatusProgressToast(2, 'question', 'in_review').title).toBe(
      'Moving 2 questions to In review...',
    )
  })

  it('names a delete while it is still running', () => {
    expect(bulkDeleteProgressToast(1, 'set').title).toBe('Deleting 1 set...')
  })

  it('names a metadata update while it is still running', () => {
    expect(bulkUpdateProgressToast(3, 'mock', 'visibility').title).toBe(
      'Updating visibility for 3 mocks...',
    )
  })
})

describe('startBackgroundBulkAction', () => {
  it('releases the confirm UI before the operation finishes', async () => {
    const store = createInFlightIdStore()
    const toasts: Array<{ title?: string; id?: string | number; duration?: number }> = []
    const begin = jest.fn()
    const work = deferred<{ moved: string[] }>()

    const started = startBackgroundBulkAction({
      store,
      toast: (input) => toasts.push(input),
      dismiss: jest.fn(),
      action: {
        ids: ['a', 'b'],
        toastId: 'bulk-1',
        progress: { title: 'Moving 2 questions to Published...' },
        begin,
        run: () => work.promise,
        onSuccess: () => ({ title: '2 questions moved to Published' }),
        onError: () => ({ title: 'Cannot move selected questions', variant: 'destructive' }),
      },
    })

    expect(started).toBe(true)
    expect(begin).toHaveBeenCalledTimes(1)
    expect(toasts).toEqual([
      { title: 'Moving 2 questions to Published...', id: 'bulk-1', duration: Infinity },
    ])
    expect(hasInFlightOverlap(store, ['a'])).toBe(true)

    work.resolve({ moved: ['a', 'b'] })
    await work.promise
    await Promise.resolve()

    expect(toasts[1]).toMatchObject({ title: '2 questions moved to Published', id: 'bulk-1' })
    expect(hasInFlightOverlap(store, ['a', 'b'])).toBe(false)
  })

  it('keeps a partial-failure toast alongside the success toast', async () => {
    const store = createInFlightIdStore()
    const toasts: Array<{ title?: string; id?: string | number }> = []
    const work = deferred<{ movedIds: string[] }>()

    startBackgroundBulkAction({
      store,
      toast: (input) => toasts.push(input),
      dismiss: jest.fn(),
      action: {
        ids: ['a', 'b'],
        toastId: 'bulk-2',
        progress: { title: 'Moving 2 sets to Published...' },
        begin: () => undefined,
        run: () => work.promise,
        onSuccess: () => [
          { title: '1 set moved to Published' },
          { title: '1 set could not be moved', variant: 'destructive' as const },
        ],
        onError: () => ({ title: 'Cannot move selected sets', variant: 'destructive' }),
      },
    })

    work.resolve({ movedIds: ['a'] })
    await work.promise
    await Promise.resolve()

    expect(toasts.slice(1)).toEqual([
      { title: '1 set moved to Published', id: 'bulk-2' },
      { title: '1 set could not be moved', variant: 'destructive' },
    ])
  })

  it('replaces the progress toast when the operation fails', async () => {
    const store = createInFlightIdStore()
    const toasts: Array<{ title?: string; id?: string | number; variant?: string }> = []
    const work = deferred<void>()

    startBackgroundBulkAction({
      store,
      toast: (input) => toasts.push(input),
      dismiss: jest.fn(),
      action: {
        ids: ['a'],
        toastId: 'bulk-3',
        progress: { title: 'Deleting 1 mock...' },
        begin: () => undefined,
        run: () => work.promise,
        onSuccess: () => ({ title: 'Mock deleted' }),
        onError: () => ({ title: 'Cannot delete', variant: 'destructive' }),
      },
    })

    work.reject(new Error('blocked'))
    await work.promise.catch(() => undefined)
    await Promise.resolve()

    expect(toasts[1]).toEqual({ title: 'Cannot delete', variant: 'destructive', id: 'bulk-3' })
    expect(hasInFlightOverlap(store, ['a'])).toBe(false)
  })

  it('dismisses the progress toast when there is no result toast', async () => {
    const store = createInFlightIdStore()
    const dismiss = jest.fn()
    const work = deferred<void>()

    startBackgroundBulkAction({
      store,
      toast: jest.fn(),
      dismiss,
      action: {
        ids: ['a'],
        toastId: 'bulk-4',
        progress: { title: 'Updating visibility for 1 question...' },
        begin: () => undefined,
        run: () => work.promise,
        onSuccess: () => undefined,
        onError: () => ({ title: 'Could not update visibility', variant: 'destructive' }),
      },
    })

    work.resolve()
    await work.promise
    await Promise.resolve()

    expect(dismiss).toHaveBeenCalledWith('bulk-4')
  })

  it('refuses a second action that overlaps in-flight items', () => {
    const store = createInFlightIdStore()
    const toasts: Array<{ title?: string }> = []
    const begin = jest.fn()
    const work = deferred<void>()

    startBackgroundBulkAction({
      store,
      toast: (input) => toasts.push(input),
      dismiss: jest.fn(),
      action: {
        ids: ['a', 'b'],
        toastId: 'bulk-5',
        progress: { title: 'Moving 2 questions to Draft...' },
        begin,
        run: () => work.promise,
        onSuccess: () => undefined,
        onError: () => ({ title: 'Cannot move selected questions' }),
      },
    })

    const startedAgain = startBackgroundBulkAction({
      store,
      toast: (input) => toasts.push(input),
      dismiss: jest.fn(),
      action: {
        ids: ['b', 'c'],
        toastId: 'bulk-6',
        progress: { title: 'Deleting 2 questions...' },
        begin,
        run: () => Promise.resolve(),
        onSuccess: () => undefined,
        onError: () => ({ title: 'Cannot delete' }),
      },
    })

    expect(startedAgain).toBe(false)
    expect(begin).toHaveBeenCalledTimes(1)
    expect(toasts.at(-1)?.title).toBe('Already in progress')
  })
})
