import { ucatMcpRequestHash } from '@/features/ucat/mcp/server/idempotency'

describe('UCAT MCP idempotency hashing', () => {
  it('is stable across object key ordering', () => {
    expect(ucatMcpRequestHash('create_mock', {
      name: 'Mock',
      setIds: ['set-1'],
      nested: { accessScope: 'public', count: 2 },
    })).toBe(ucatMcpRequestHash('create_mock', {
      nested: { count: 2, accessScope: 'public' },
      setIds: ['set-1'],
      name: 'Mock',
    }))
  })

  it('changes when ordered content changes', () => {
    expect(ucatMcpRequestHash('create_question_set', {
      stemIds: ['stem-1', 'stem-2'],
    })).not.toBe(ucatMcpRequestHash('create_question_set', {
      stemIds: ['stem-2', 'stem-1'],
    }))
  })
})
