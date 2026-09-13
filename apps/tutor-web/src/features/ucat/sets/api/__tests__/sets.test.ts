import { ucatSetsApi } from '../sets'

describe('ucatSetsApi.removeStemsFromSet', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('uses the narrow membership endpoint instead of rewriting the whole set', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as typeof fetch

    await ucatSetsApi.removeStemsFromSet('set-id', ['stem-a', 'stem-b'])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/ucat/question-sets/set-id/stems', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stemIds: ['stem-a', 'stem-b'] }),
    })
  })
})
