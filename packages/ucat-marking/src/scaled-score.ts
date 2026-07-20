import {
  SCALED_MAX,
  SCALED_MIN,
  SCALED_ROUND_TO,
  UCAT_SCORING_MODEL,
} from './config'
import type {
  UcatScoringSection,
  UcatSectionScoreEstimate,
} from './types'

type ScoreAnchor = {
  rawRatio: number
  scaledScore: number
}

type SectionProfile = {
  anchors: readonly ScoreAnchor[]
  fullAttemptMaxRawScore: number
  scaledScoreStandardError: number
}

/**
 * Shape-preserving empirical anchors derived from the five form-level raw and
 * scaled score distributions in the 2025 UCAT technical report. Interior
 * anchors match corresponding standard-deviation points; the reporting-scale
 * endpoints are fixed at 300 and 900.
 *
 * Ratios let Altitutor score all authored questions while approximating UCAT's
 * hidden operational/pretest split. They do not assign extra marks to selected
 * "hard" questions: form difficulty remains a future calibration layer.
 */
const SECTION_PROFILES: Record<UcatScoringSection, SectionProfile> = {
  verbal_reasoning: {
    fullAttemptMaxRawScore: 44,
    scaledScoreStandardError: 39.078,
    anchors: [
      { rawRatio: 0, scaledScore: 300 },
      { rawRatio: 0.24755, scaledScore: 441.384 },
      { rawRatio: 0.40185, scaledScore: 521.86 },
      { rawRatio: 0.55615, scaledScore: 602.336 },
      { rawRatio: 0.71045, scaledScore: 682.812 },
      { rawRatio: 0.86475, scaledScore: 763.288 },
      { rawRatio: 1, scaledScore: 900 },
    ],
  },
  decision_making: {
    fullAttemptMaxRawScore: 47,
    scaledScoreStandardError: 39.338,
    anchors: [
      { rawRatio: 0, scaledScore: 300 },
      { rawRatio: 0.213476, scaledScore: 455.422 },
      { rawRatio: 0.37519, scaledScore: 541.486 },
      { rawRatio: 0.536905, scaledScore: 627.55 },
      { rawRatio: 0.698619, scaledScore: 713.614 },
      { rawRatio: 0.860333, scaledScore: 799.678 },
      { rawRatio: 1, scaledScore: 900 },
    ],
  },
  quantitative_reasoning: {
    fullAttemptMaxRawScore: 36,
    scaledScoreStandardError: 46.696,
    anchors: [
      { rawRatio: 0, scaledScore: 300 },
      { rawRatio: 0.235375, scaledScore: 441.494 },
      { rawRatio: 0.449313, scaledScore: 550.928 },
      { rawRatio: 0.66325, scaledScore: 660.362 },
      { rawRatio: 0.877188, scaledScore: 769.796 },
      { rawRatio: 1, scaledScore: 900 },
    ],
  },
  situational_judgement: {
    fullAttemptMaxRawScore: 69,
    scaledScoreStandardError: 30.802,
    anchors: [
      { rawRatio: 0, scaledScore: 300 },
      { rawRatio: 0.575472, scaledScore: 453.548 },
      { rawRatio: 0.658805, scaledScore: 526.98 },
      { rawRatio: 0.742138, scaledScore: 600.412 },
      { rawRatio: 0.825472, scaledScore: 673.844 },
      { rawRatio: 0.908805, scaledScore: 747.276 },
      { rawRatio: 1, scaledScore: 900 },
    ],
  },
}

function roundScaledScore(value: number): number {
  const bounded = Math.min(SCALED_MAX, Math.max(SCALED_MIN, value))
  return Math.round(bounded / SCALED_ROUND_TO) * SCALED_ROUND_TO
}

function roundScoreDelta(value: number): number {
  const bounded = Math.min(SCALED_MAX - SCALED_MIN, Math.max(0, value))
  return Math.round(bounded / SCALED_ROUND_TO) * SCALED_ROUND_TO
}

function interpolateScore(
  rawRatio: number,
  anchors: readonly ScoreAnchor[]
): number {
  const upperIndex = anchors.findIndex((anchor) => anchor.rawRatio >= rawRatio)
  if (upperIndex <= 0) return anchors[0].scaledScore

  const lower = anchors[upperIndex - 1]
  const upper = anchors[upperIndex]
  const span = upper.rawRatio - lower.rawRatio
  if (span <= 0) return upper.scaledScore

  const position = (rawRatio - lower.rawRatio) / span
  return lower.scaledScore + position * (upper.scaledScore - lower.scaledScore)
}

/** Resolve database/display section values to the scoring authority's key. */
export function resolveUcatScoringSection(
  value: string | number
): UcatScoringSection | null {
  if (typeof value === 'number') {
    return (
      [
        'verbal_reasoning',
        'decision_making',
        'quantitative_reasoning',
        'situational_judgement',
      ] as const
    )[value - 1] ?? null
  }

  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const aliases: Record<string, UcatScoringSection> = {
    '1': 'verbal_reasoning',
    vr: 'verbal_reasoning',
    verbalreasoning: 'verbal_reasoning',
    '2': 'decision_making',
    dm: 'decision_making',
    decisionmaking: 'decision_making',
    '3': 'quantitative_reasoning',
    qr: 'quantitative_reasoning',
    quantitativereasoning: 'quantitative_reasoning',
    '4': 'situational_judgement',
    sj: 'situational_judgement',
    sjt: 'situational_judgement',
    situationaljudgement: 'situational_judgement',
  }
  return aliases[normalized] ?? null
}

/** Return one canonical section only when every supplied value agrees. */
export function resolveSingleUcatScoringSection(
  values: readonly (string | number)[]
): UcatScoringSection | null {
  if (values.length === 0) return null
  const sections = values.map(resolveUcatScoringSection)
  if (sections.some((section) => section == null)) return null
  const first = sections[0]
  return sections.every((section) => section === first) ? first : null
}

/**
 * Estimate a UCAT ANZ section score using the active section-specific profile.
 * This is the only raw-to-scaled conversion exported by the scoring authority.
 */
export function estimateUcatSectionScore(input: {
  section: UcatScoringSection
  rawScore: number
  maxRawScore: number
}): UcatSectionScoreEstimate {
  const { section, rawScore, maxRawScore } = input
  if (!Number.isFinite(rawScore) || !Number.isFinite(maxRawScore)) {
    throw new TypeError('Raw score inputs must be finite numbers')
  }
  if (maxRawScore <= 0) {
    throw new RangeError('Maximum raw score must be greater than zero')
  }

  const profile = SECTION_PROFILES[section]
  const rawRatio = Math.min(1, Math.max(0, rawScore / maxRawScore))
  const scaledScore = roundScaledScore(
    interpolateScore(rawRatio, profile.anchors)
  )
  const evidenceScale = Math.max(
    1,
    Math.sqrt(profile.fullAttemptMaxRawScore / maxRawScore)
  )
  const standardError = roundScoreDelta(
    profile.scaledScoreStandardError * evidenceScale
  )

  return {
    scaledScore,
    standardError,
    estimatedRange: {
      min: roundScaledScore(scaledScore - standardError),
      max: roundScaledScore(scaledScore + standardError),
    },
    modelVersion: UCAT_SCORING_MODEL.version,
    evidenceCycle: UCAT_SCORING_MODEL.evidenceCycle,
  }
}
