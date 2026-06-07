export type BulkImportStepKind =
  | 'section'
  | 'paste_document'
  | 'paste_stems'
  | 'per_stem_questions'
  | 'answers'
  | 'review'
  | 'create_set'

export function getBulkImportTotalSteps(separateStemDocument: boolean): number {
  return separateStemDocument ? 6 : 5
}

export function getBulkImportStepKind(
  step: number,
  separateStemDocument: boolean
): BulkImportStepKind {
  if (separateStemDocument) {
    switch (step) {
      case 0:
        return 'section'
      case 1:
        return 'paste_stems'
      case 2:
        return 'per_stem_questions'
      case 3:
        return 'answers'
      case 4:
        return 'review'
      case 5:
        return 'create_set'
      default:
        return 'section'
    }
  }
  switch (step) {
    case 0:
      return 'section'
    case 1:
      return 'paste_document'
    case 2:
      return 'answers'
    case 3:
      return 'review'
    case 4:
      return 'create_set'
    default:
      return 'section'
  }
}

export function getBulkImportStepTitle(kind: BulkImportStepKind): string {
  switch (kind) {
    case 'section':
      return 'Choose section'
    case 'paste_document':
      return 'Paste document'
    case 'paste_stems':
      return 'Paste stems'
    case 'per_stem_questions':
      return 'Paste questions per stem'
    case 'answers':
      return 'Answers'
    case 'review':
      return 'Review'
    case 'create_set':
      return 'Create set'
    default:
      return 'Bulk import'
  }
}

/** Steps that use full-height paste layout (no outer scroll). */
export function isBulkImportFullHeightPasteStep(kind: BulkImportStepKind): boolean {
  return kind === 'paste_document' || kind === 'paste_stems' || kind === 'per_stem_questions'
}
