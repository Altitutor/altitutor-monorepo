import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getUcatMcpAggregates } from '@/features/ucat/mcp/server/service'

const FIRST_ID = '60000000-0000-0000-0000-000000000001'
const SECOND_ID = '60000000-0000-0000-0000-000000000002'
const THIRD_ID = '60000000-0000-0000-0000-000000000003'

function clientWithStemResults(): SupabaseClient<Database> {
  type FakeResult = {
    data: Record<string, unknown> | null
    error: { message: string } | null
  }
  type FakeBuilder = {
    select: jest.Mock<FakeBuilder, []>
    eq: jest.Mock<FakeBuilder, [string, string]>
    maybeSingle: jest.Mock<Promise<FakeResult>, []>
  }
  const rows = new Map<string, {
    data: Record<string, unknown> | null
    error: { message: string } | null
    delay: number
  }>([
    [FIRST_ID, {
      data: { id: FIRST_ID, updated_at: '2026-07-28T00:00:00.000Z', questions: [] },
      error: null,
      delay: 10,
    }],
    [SECOND_ID, {
      data: null,
      error: { message: 'Second stem is unavailable' },
      delay: 0,
    }],
    [THIRD_ID, {
      data: { id: THIRD_ID, updated_at: '2026-07-28T00:00:02.000Z', questions: [] },
      error: null,
      delay: 1,
    }],
  ])
  return {
    from: jest.fn(() => {
      let selectedId = ''
      const builder = {} as FakeBuilder
      builder.select = jest.fn(() => builder)
      builder.eq = jest.fn((_column: string, id: string) => {
        selectedId = id
        return builder
      })
      builder.maybeSingle = jest.fn(async () => {
          const result = rows.get(selectedId)
          if (!result) return { data: null, error: { message: 'Unexpected stem' } }
          await new Promise((resolve) => setTimeout(resolve, result.delay))
          return { data: result.data, error: result.error }
      })
      return builder
    }),
  } as unknown as SupabaseClient<Database>
}

describe('UCAT MCP batch content reads', () => {
  it('preserves request order and isolates individual failures', async () => {
    const result = await getUcatMcpAggregates(clientWithStemResults(), [
      { contentType: 'stem', id: FIRST_ID },
      { contentType: 'stem', id: SECOND_ID },
      { contentType: 'stem', id: THIRD_ID },
    ])

    expect(result).toMatchObject({
      requestedCount: 3,
      successCount: 2,
      errorCount: 1,
      items: [
        { contentType: 'stem', id: FIRST_ID, ok: true },
        {
          contentType: 'stem',
          id: SECOND_ID,
          ok: false,
          error: 'Second stem is unavailable',
        },
        { contentType: 'stem', id: THIRD_ID, ok: true },
      ],
    })
    expect(result.items[0].ok && result.items[0].content.revision).toEqual(expect.any(String))
    expect(result.items[2].ok && result.items[2].content.revision).toEqual(expect.any(String))
  })
})
