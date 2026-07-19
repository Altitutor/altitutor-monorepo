const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

export type AutomaticReviewEnvironment = {
  enabled: boolean
  source: 'explicit' | 'production_default' | 'non_production_default'
}

export function automaticReviewEnvironment(): AutomaticReviewEnvironment {
  const raw = process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED?.trim().toLowerCase()
  if (raw && TRUE_VALUES.has(raw)) return { enabled: true, source: 'explicit' }
  if (raw && FALSE_VALUES.has(raw)) return { enabled: false, source: 'explicit' }
  if (process.env.VERCEL_ENV === 'production') {
    return { enabled: true, source: 'production_default' }
  }
  return { enabled: false, source: 'non_production_default' }
}
