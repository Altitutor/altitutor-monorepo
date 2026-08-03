import {
  estimateUcatSectionScore,
  resolveSingleUcatScoringSection,
  resolveUcatScoringSection,
} from '../scaled-score'
import { UCAT_SCORING_MODEL } from '../config'
import type { UcatScoringSection } from '../types'

const sections: UcatScoringSection[] = [
  'verbal_reasoning',
  'decision_making',
  'quantitative_reasoning',
  'situational_judgement',
]

describe('estimateUcatSectionScore', () => {
  it.each(sections)('%s keeps the reporting-scale endpoints', (section) => {
    expect(
      estimateUcatSectionScore({ section, rawScore: 0, maxRawScore: 100 })
        .scaledScore
    ).toBe(300)
    expect(
      estimateUcatSectionScore({ section, rawScore: 100, maxRawScore: 100 })
        .scaledScore
    ).toBe(900)
  })

  it('uses section-specific conversions for the same raw percentage', () => {
    const scores = sections.map(
      (section) =>
        estimateUcatSectionScore({
          section,
          rawScore: 67,
          maxRawScore: 100,
        }).scaledScore
    )
    expect(new Set(scores).size).toBeGreaterThan(2)
  })

  it('matches the published 2025 form means at their raw-score anchors', () => {
    expect(
      estimateUcatSectionScore({
        section: 'verbal_reasoning',
        rawScore: 22.246,
        maxRawScore: 40,
      }).scaledScore
    ).toBe(600)
    expect(
      estimateUcatSectionScore({
        section: 'decision_making',
        rawScore: 22.55,
        maxRawScore: 42,
      }).scaledScore
    ).toBe(630)
    expect(
      estimateUcatSectionScore({
        section: 'quantitative_reasoning',
        rawScore: 21.224,
        maxRawScore: 32,
      }).scaledScore
    ).toBe(660)
  })

  it('reports more uncertainty for a short set than a full section', () => {
    const short = estimateUcatSectionScore({
      section: 'verbal_reasoning',
      rawScore: 4,
      maxRawScore: 5,
    })
    const full = estimateUcatSectionScore({
      section: 'verbal_reasoning',
      rawScore: 35,
      maxRawScore: 44,
    })
    expect(short.standardError).toBeGreaterThan(full.standardError)
    expect(short.estimatedRange.min).toBeGreaterThanOrEqual(300)
    expect(short.estimatedRange.max).toBeLessThanOrEqual(900)
  })

  it('is monotonic across each section profile', () => {
    for (const section of sections) {
      const scores = Array.from({ length: 101 }, (_, rawScore) =>
        estimateUcatSectionScore({ section, rawScore, maxRawScore: 100 })
      )
      for (let index = 1; index < scores.length; index += 1) {
        expect(scores[index].scaledScore).toBeGreaterThanOrEqual(
          scores[index - 1].scaledScore
        )
      }
    }
  })

  it('clamps raw scores but rejects an invalid denominator', () => {
    expect(
      estimateUcatSectionScore({
        section: 'verbal_reasoning',
        rawScore: 50,
        maxRawScore: 40,
      }).scaledScore
    ).toBe(900)
    expect(() =>
      estimateUcatSectionScore({
        section: 'verbal_reasoning',
        rawScore: 0,
        maxRawScore: 0,
      })
    ).toThrow('Maximum raw score must be greater than zero')
  })

  it('returns the active model provenance', () => {
    const result = estimateUcatSectionScore({
      section: 'verbal_reasoning',
      rawScore: 20,
      maxRawScore: 40,
    })
    expect(result.modelVersion).toBe(UCAT_SCORING_MODEL.version)
    expect(result.evidenceCycle).toBe(2025)
  })
})

describe('resolveUcatScoringSection', () => {
  it.each([
    ['Verbal Reasoning', 'verbal_reasoning'],
    ['DM', 'decision_making'],
    ['quantitative_reasoning', 'quantitative_reasoning'],
    ['SJ', 'situational_judgement'],
    [3, 'quantitative_reasoning'],
  ] as const)('resolves %s', (input, expected) => {
    expect(resolveUcatScoringSection(input)).toBe(expected)
  })

  it('returns null for an unknown section', () => {
    expect(resolveUcatScoringSection('Abstract Reasoning')).toBeNull()
  })
})

describe('resolveSingleUcatScoringSection', () => {
  it('resolves a single-section attempt', () => {
    expect(
      resolveSingleUcatScoringSection(['Verbal Reasoning', 'VR'])
    ).toBe('verbal_reasoning')
  })

  it('rejects mixed or unknown sections', () => {
    expect(
      resolveSingleUcatScoringSection(['Verbal Reasoning', 'Decision Making'])
    ).toBeNull()
    expect(resolveSingleUcatScoringSection(['Unknown'])).toBeNull()
    expect(resolveSingleUcatScoringSection([])).toBeNull()
  })
})
