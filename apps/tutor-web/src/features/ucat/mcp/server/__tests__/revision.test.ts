import {
  decodeAuthoringRevision,
  encodeAuthoringRevision,
} from '@/features/ucat/mcp/server/revision'

describe('UCAT MCP authoring revisions', () => {
  it('round-trips an opaque revision for the matching aggregate', () => {
    const updatedAt = '2026-07-23T12:34:56.123Z'
    const revision = encodeAuthoringRevision(
      '10000000-0000-0000-0000-000000000001',
      updatedAt,
    )

    expect(revision).not.toContain(updatedAt)
    expect(
      decodeAuthoringRevision(
        revision,
        '10000000-0000-0000-0000-000000000001',
      ),
    ).toBe(updatedAt)
  })

  it('rejects a revision copied from another aggregate', () => {
    const revision = encodeAuthoringRevision(
      '10000000-0000-0000-0000-000000000001',
      '2026-07-23T12:34:56.123Z',
    )

    expect(() => decodeAuthoringRevision(
      revision,
      '20000000-0000-0000-0000-000000000002',
    )).toThrow('Revision does not match this aggregate')
  })
})

