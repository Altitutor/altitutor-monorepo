import { sampleWithoutReplacement } from '../sample-without-replacement'

describe('sampleWithoutReplacement', () => {
  it('returns an empty array for empty input or non-positive limit', () => {
    expect(sampleWithoutReplacement(['a'], 0)).toEqual([])
    expect(sampleWithoutReplacement([], 5)).toEqual([])
  })

  it('returns a permutation when limit covers the full set', () => {
    const items = ['a', 'b', 'c', 'd']
    const sample = sampleWithoutReplacement(items, 4)
    expect(sample).toHaveLength(4)
    expect(new Set(sample)).toEqual(new Set(items))
  })

  it('returns a subset without duplicates when limit is smaller', () => {
    const items = Array.from({ length: 20 }, (_, index) => `id-${index}`)
    const sample = sampleWithoutReplacement(items, 5)
    expect(sample).toHaveLength(5)
    expect(new Set(sample).size).toBe(5)
    for (const id of sample) {
      expect(items).toContain(id)
    }
  })
})
