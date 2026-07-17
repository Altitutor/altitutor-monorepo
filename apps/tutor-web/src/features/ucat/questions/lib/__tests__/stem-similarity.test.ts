import {
  buildStemSimilarityIndexEntry,
  compareStemSimilarityText,
  findPotentialDuplicatePairs,
} from '@/features/ucat/questions/lib/stem-similarity'

describe('stem-similarity', () => {
  const shuttleStem =
    'A community shuttle charges a booking fee of $42 plus $0.68 per kilometre travelled. A journey costs $178 in total, and the booking fee is waived on Sundays.'
  const shuttleQuestion = 'What is the charge for the same 200 kilometre journey on Sunday?'
  const shuttleOptions = '$128 $136 $170 $178 $220'
  const shuttleFull = `${shuttleStem} ${shuttleQuestion} ${shuttleOptions}`

  it('flags near-identical comparison text as a near copy', () => {
    const result = compareStemSimilarityText(shuttleFull, shuttleFull)
    expect(result.isNearCopy).toBe(true)
    expect(result.tokenRatio).toBeGreaterThanOrEqual(0.9)
  })

  it('does not flag generic overlapping vocabulary alone', () => {
    const left =
      'The table shows the total number of patients in each month. What percentage increase is there between the following values? Which option shows the most accurate calculation?'
    const right =
      'A hospital ward records admissions across four weeks. Calculate the percentage change from week one to week four using the values in the chart. Which option is correct?'
    const result = compareStemSimilarityText(left, right)
    expect(result.isNearCopy).toBe(false)
  })

  it('finds duplicate pairs within an indexed section group at reconciliation thresholds', () => {
    const other =
      'A ferry tickets office sells day passes for $29 and charges $0.45 per kilometre after the first 12 kilometres. A passenger travels 80 kilometres and pays $59.60 in total.'
    const entries = [
      buildStemSimilarityIndexEntry('stem-a', shuttleFull),
      buildStemSimilarityIndexEntry('stem-b', `${shuttleStem} ${shuttleQuestion} $128 $136 $170 $178 $220`),
      buildStemSimilarityIndexEntry('stem-c', `${other} How much would a 100 kilometre trip cost without the day pass discount? $45 $52 $61 $74 $88`),
    ].filter((entry): entry is NonNullable<typeof entry> => entry != null)

    const pairs = findPotentialDuplicatePairs(entries)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].idA).toBe('stem-a')
    expect(pairs[0].idB).toBe('stem-b')
    expect(pairs[0].result.isNearCopy).toBe(true)
    expect(Math.max(pairs[0].result.tokenRatio, pairs[0].result.trigramRatio)).toBeGreaterThanOrEqual(0.9)
  })
})
