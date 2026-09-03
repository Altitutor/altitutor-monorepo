import { patchUcatContentStatus, UCAT_BULK_STATUS_CHUNK_SIZE } from '@/features/ucat/shared/lib/content-status-request'

describe('patchUcatContentStatus', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('sends one request when the selection fits in a single chunk', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ movedIds: ['a'], failures: [] }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(patchUcatContentStatus({
      contentType: 'set',
      contentIds: ['a'],
      status: 'in_review',
      fallback: 'Failed to update set status',
    })).resolves.toEqual({ movedIds: ['a'], failures: [] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      contentType: 'set',
      contentIds: ['a'],
      status: 'in_review',
    })
  })

  it('chunks large bulk status changes and concatenates results', async () => {
    const ids = Array.from({ length: UCAT_BULK_STATUS_CHUNK_SIZE + 2 }, (_, index) => `id-${index}`)
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ movedIds: ids.slice(0, UCAT_BULK_STATUS_CHUNK_SIZE), failures: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          movedIds: [ids[UCAT_BULK_STATUS_CHUNK_SIZE]],
          failures: [{ contentId: ids[UCAT_BULK_STATUS_CHUNK_SIZE + 1], error: 'blocked', blockers: [] }],
        }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(patchUcatContentStatus({
      contentType: 'set',
      contentIds: ids,
      status: 'in_review',
      fallback: 'Failed to update set status',
    })).resolves.toEqual({
      movedIds: ids.slice(0, UCAT_BULK_STATUS_CHUNK_SIZE + 1),
      failures: [{ contentId: ids[UCAT_BULK_STATUS_CHUNK_SIZE + 1], error: 'blocked', blockers: [] }],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).contentIds).toHaveLength(UCAT_BULK_STATUS_CHUNK_SIZE)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).contentIds).toEqual(ids.slice(UCAT_BULK_STATUS_CHUNK_SIZE))
  })
})
