import { compareGenerationSourceSimilarity } from '@/features/ucat/questions/lib/generation-source-similarity'

describe('generation source similarity', () => {
  const shuttleStem =
    'A community shuttle charges a booking fee of $42 plus $0.68 per kilometre travelled. A journey costs $178 in total, and the booking fee is waived on Sundays.'
  const shuttleQuestion = 'What is the charge for the same 200 kilometre journey on Sunday?'
  const shuttleOptions = '$128 $136 $170 $178 $220'
  const shuttleBundle = `${shuttleStem} ${shuttleQuestion} ${shuttleOptions}`

  it('flags a copied generated bundle and returns matching evidence', () => {
    const result = compareGenerationSourceSimilarity(shuttleBundle, shuttleBundle)

    expect(result.isNearCopy).toBe(true)
    expect(result.tokenRatio).toBeGreaterThanOrEqual(0.9)
    expect(result.sharedTokens.length).toBeGreaterThan(0)
    expect(result.sharedPhrases.length).toBeGreaterThan(0)
  })

  it('does not flag generic overlapping vocabulary', () => {
    const candidate =
      'The table shows the total number of patients in each month. What percentage increase is there between the following values? Which option shows the most accurate calculation?'
    const source =
      'A hospital ward records admissions across four weeks. Calculate the percentage change from week one to week four using the values in the chart. Which option is correct?'

    expect(compareGenerationSourceSimilarity(candidate, source).isNearCopy).toBe(false)
  })

  it('ignores required Decision Making question scaffolds', () => {
    const candidate =
      'A council is considering reserving public study spaces for students during examination weeks. Select the strongest argument from the statements below. The proposal is intended to improve access during busy periods.'
    const source =
      'A transport authority is replacing printed route maps with digital displays. Select the strongest argument from the statements below. The proposal is intended to improve passenger information during delays.'

    expect(compareGenerationSourceSimilarity(candidate, source).isNearCopy).toBe(false)
  })
})
