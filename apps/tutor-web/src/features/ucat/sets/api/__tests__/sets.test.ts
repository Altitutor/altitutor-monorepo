import { ucatSetsApi } from '../sets'
import type { UcatQuestionSetPayload } from '@/features/ucat/shared/types'

describe('ucatSetsApi', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it.each(['create', 'update'] as const)('%s sends only the active timing intent', async (action) => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'set-id' }) })
    global.fetch = fetchMock as typeof fetch
    const payload: UcatQuestionSetPayload = {
      description: '',
      timingMode: 'fixed', paceMultiplier: 1.5, fixedTimeLimitSeconds: 120,
      setFormat: 'partial_section', accessScope: 'public', sectionId: 'section-id',
      referenceBlueprintId: 'blueprint-id', stemIds: [],
    }
    if (action === 'create') await ucatSetsApi.create(payload)
    else await ucatSetsApi.update('set-id', payload)

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      timingMode: 'fixed', paceMultiplier: null, fixedTimeLimitSeconds: 120,
    })
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
