/**
 * Keep in sync with the SQL threshold in
 * tutor_ucat_list_exact_duplicate_stems (high-confidence near-copy path).
 */
export const HIGH_CONFIDENCE_NEAR_COPY_STEM_SIMILARITY = 0.95

export type DuplicateComparisonKind =
  | 'complete_duplicate'
  | 'shared_stem'
  | 'high_confidence_near_copy'

export type DuplicateRecommendation = 'merge' | 'delete'

export function duplicateComparisonMatchLabel(
  kind: DuplicateComparisonKind,
): string {
  switch (kind) {
    case 'complete_duplicate':
      return 'All compared content matches'
    case 'shared_stem':
      return 'Stem text matches'
    case 'high_confidence_near_copy':
      return 'High-confidence near copy'
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function duplicateComparisonBadgeLabel(
  kind: DuplicateComparisonKind,
): string {
  switch (kind) {
    case 'complete_duplicate':
    case 'shared_stem':
      return 'Exact normalized stem match'
    case 'high_confidence_near_copy':
      return 'High-confidence near copy'
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function duplicateRecommendationLabel(
  recommendation: DuplicateRecommendation,
  suggestedMergeDirection: 'A-into-B' | 'B-into-A' | null,
): string {
  if (recommendation === 'merge') {
    return `Merge ${suggestedMergeDirection === 'A-into-B' ? 'A into B' : 'B into A'}`
  }
  return 'Delete duplicate'
}

/** Merge is only safe when normalized stem text is identical. */
export function canMergeDuplicatePair(kind: DuplicateComparisonKind): boolean {
  switch (kind) {
    case 'complete_duplicate':
    case 'shared_stem':
      return true
    case 'high_confidence_near_copy':
      return false
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}
