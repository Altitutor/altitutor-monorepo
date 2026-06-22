export type BulkImportStepKind =
  | 'section'
  | 'paste_document'
  | 'paste_stems'
  | 'per_stem_questions'
  | 'syllogism_manual'
  | 'answers'
  | 'stem_categories'
  | 'question_tags'
  | 'review'
  | 'create_set'

export function getBulkImportStepSequence(
  separateStemDocument: boolean,
  includeSyllogismManual = false
): BulkImportStepKind[] {
  const manualStep: BulkImportStepKind[] = includeSyllogismManual ? ['syllogism_manual'] : []

  if (separateStemDocument) {
    return [
      'section',
      'paste_stems',
      'per_stem_questions',
      ...manualStep,
      'answers',
      'stem_categories',
      'question_tags',
      'review',
      'create_set',
    ]
  }

  return [
    'section',
    'paste_document',
    ...manualStep,
    'answers',
    'stem_categories',
    'question_tags',
    'review',
    'create_set',
  ]
}

export function getBulkImportTotalSteps(
  separateStemDocument: boolean,
  includeSyllogismManual = false
): number {
  return getBulkImportStepSequence(separateStemDocument, includeSyllogismManual).length
}

export function getBulkImportStepKind(
  step: number,
  separateStemDocument: boolean,
  includeSyllogismManual = false
): BulkImportStepKind {
  return (
    getBulkImportStepSequence(separateStemDocument, includeSyllogismManual)[step] ?? 'section'
  )
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
    case 'syllogism_manual':
      return 'Syllogism statements'
    case 'answers':
      return 'Answers'
    case 'stem_categories':
      return 'Stem categories'
    case 'question_tags':
      return 'Question tags'
    case 'review':
      return 'Review'
    case 'create_set':
      return 'Create set'
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

/** Steps that use full-height paste layout (no outer scroll). */
export function isBulkImportFullHeightPasteStep(kind: BulkImportStepKind): boolean {
  return (
    kind === 'paste_document' ||
    kind === 'paste_stems' ||
    kind === 'per_stem_questions' ||
    kind === 'answers'
  )
}
