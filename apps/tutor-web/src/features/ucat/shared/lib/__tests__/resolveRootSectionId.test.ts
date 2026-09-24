import { resolveRootSectionId } from '../taxonomy-reparent'

const VR = 'section-vr'
const DM = 'section-dm'

describe('resolveRootSectionId', () => {
  it('returns the ultimate root section when the root is sectioned', () => {
    const rows = [
      { id: 'vr-root', parent_id: null, section_id: VR },
      { id: 'vr-child', parent_id: 'vr-root', section_id: null },
    ]
    expect(resolveRootSectionId(rows, 'vr-root')).toBe(VR)
    expect(resolveRootSectionId(rows, 'vr-child')).toBe(VR)
  })

  it('uses the highest sectioned ancestor under an unsectioned umbrella', () => {
    const rows = [
      { id: 'core', parent_id: null, section_id: null },
      { id: 'foundations', parent_id: 'core', section_id: null },
      { id: 'vr', parent_id: 'core', section_id: VR },
      { id: 'vr-child', parent_id: 'vr', section_id: VR },
      { id: 'dm', parent_id: 'core', section_id: DM },
      { id: 'dm-child', parent_id: 'dm', section_id: null },
    ]

    expect(resolveRootSectionId(rows, 'core')).toBeNull()
    expect(resolveRootSectionId(rows, 'foundations')).toBeNull()
    expect(resolveRootSectionId(rows, 'vr')).toBe(VR)
    expect(resolveRootSectionId(rows, 'vr-child')).toBe(VR)
    expect(resolveRootSectionId(rows, 'dm')).toBe(DM)
    expect(resolveRootSectionId(rows, 'dm-child')).toBe(DM)
  })

  it('prefers the highest sectioned ancestor over a nested override', () => {
    const rows = [
      { id: 'core', parent_id: null, section_id: null },
      { id: 'vr', parent_id: 'core', section_id: VR },
      { id: 'nested-dm', parent_id: 'vr', section_id: DM },
    ]
    expect(resolveRootSectionId(rows, 'nested-dm')).toBe(VR)
  })

  it('falls back to the node section when the parent chain is broken', () => {
    const rows = [{ id: 'orphan', parent_id: 'missing', section_id: VR }]
    expect(resolveRootSectionId(rows, 'orphan')).toBe(VR)
  })

  it('returns null for an unknown node', () => {
    expect(resolveRootSectionId([], 'missing')).toBeNull()
  })
})
