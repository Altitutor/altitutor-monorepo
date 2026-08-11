import {
  canMergeDuplicatePair,
  duplicateComparisonBadgeLabel,
  duplicateComparisonMatchLabel,
  duplicateRecommendationLabel,
  HIGH_CONFIDENCE_NEAR_COPY_STEM_SIMILARITY,
} from '../duplicate-queue-match'

describe('duplicate-queue-match', () => {
  it('keeps the SQL near-copy similarity threshold at 0.95', () => {
    expect(HIGH_CONFIDENCE_NEAR_COPY_STEM_SIMILARITY).toBe(0.95)
  })

  it('labels exact and near-copy match kinds for the table', () => {
    expect(duplicateComparisonMatchLabel('complete_duplicate')).toBe(
      'All compared content matches',
    )
    expect(duplicateComparisonMatchLabel('shared_stem')).toBe('Stem text matches')
    expect(duplicateComparisonMatchLabel('high_confidence_near_copy')).toBe(
      'High-confidence near copy',
    )
  })

  it('badges near-copies distinctly from exact stem matches', () => {
    expect(duplicateComparisonBadgeLabel('complete_duplicate')).toBe(
      'Exact normalized stem match',
    )
    expect(duplicateComparisonBadgeLabel('shared_stem')).toBe(
      'Exact normalized stem match',
    )
    expect(duplicateComparisonBadgeLabel('high_confidence_near_copy')).toBe(
      'High-confidence near copy',
    )
  })

  it('disables merge for high-confidence near copies', () => {
    expect(canMergeDuplicatePair('complete_duplicate')).toBe(true)
    expect(canMergeDuplicatePair('shared_stem')).toBe(true)
    expect(canMergeDuplicatePair('high_confidence_near_copy')).toBe(false)
  })

  it('formats delete vs merge recommendations', () => {
    expect(duplicateRecommendationLabel('delete', null)).toBe('Delete duplicate')
    expect(duplicateRecommendationLabel('merge', 'A-into-B')).toBe('Merge A into B')
    expect(duplicateRecommendationLabel('merge', 'B-into-A')).toBe('Merge B into A')
  })
})
