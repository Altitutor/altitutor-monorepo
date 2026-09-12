import { runSetScopedAction } from '../set-scoped-action'

function deferred() {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('runSetScopedAction', () => {
  it('rejects a concurrent action for the same set until the first action finishes', async () => {
    const activeSetIds = new Set<string>()
    const changes: ReadonlySet<string>[] = []
    const firstAction = deferred()
    const first = runSetScopedAction(
      activeSetIds,
      'set-a',
      (next) => changes.push(next),
      () => firstAction.promise,
    )
    const secondAction = jest.fn().mockResolvedValue(undefined)

    await expect(
      runSetScopedAction(activeSetIds, 'set-a', (next) => changes.push(next), secondAction),
    ).resolves.toBe(false)
    expect(secondAction).not.toHaveBeenCalled()
    expect(changes.at(-1)?.has('set-a')).toBe(true)

    firstAction.resolve()
    await expect(first).resolves.toBe(true)
    expect(changes.at(-1)?.has('set-a')).toBe(false)
  })

  it('allows different sets to update concurrently', async () => {
    const activeSetIds = new Set<string>()
    const firstAction = deferred()
    const secondAction = deferred()

    const first = runSetScopedAction(
      activeSetIds,
      'set-a',
      () => undefined,
      () => firstAction.promise,
    )
    const second = runSetScopedAction(
      activeSetIds,
      'set-b',
      () => undefined,
      () => secondAction.promise,
    )

    expect(activeSetIds).toEqual(new Set(['set-a', 'set-b']))
    firstAction.resolve()
    secondAction.resolve()
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
  })
})
