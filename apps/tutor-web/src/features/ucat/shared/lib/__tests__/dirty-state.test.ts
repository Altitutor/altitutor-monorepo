import { isSnapshotDirty, snapshotSetDetail } from '@/features/ucat/shared/lib/dirty-state'

describe('set detail dirty snapshot', () => {
  it('detects changes in ordered stem ids', () => {
    const baseline = snapshotSetDetail({
      description: 'Set 1',
      time: 1200,
      isPrivate: false,
      isStudentGenerated: false,
      stemIds: ['s1', 's2'],
    })

    const changed = snapshotSetDetail({
      description: 'Set 1',
      time: 1200,
      isPrivate: false,
      isStudentGenerated: false,
      stemIds: ['s2', 's1'],
    })

    expect(isSnapshotDirty(changed, baseline)).toBe(true)
    expect(isSnapshotDirty(baseline, baseline)).toBe(false)
  })
})
