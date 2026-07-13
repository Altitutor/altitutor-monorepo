/**
 * Near-copy detection shared by AI generation gates and reconciliation.
 *
 * Uses significant-token overlap plus word-trigram overlap. Generation gates keep
 * the looser default thresholds; reconciliation uses 90% overlap to cut false positives.
 * Stems are compared within a section only.
 */

export const STEM_SIMILARITY_MIN_CHARS = 120

export const STEM_SIMILARITY_TOKEN_MIN_SHARED = 8
export const STEM_SIMILARITY_TOKEN_RATIO = 0.72
export const STEM_SIMILARITY_TRIGRAM_MIN_SHARED = 3
export const STEM_SIMILARITY_TRIGRAM_RATIO = 0.45

/** Stricter thresholds for reconciliation duplicate detection (fewer false positives). */
export const RECONCILIATION_DUPLICATE_TOKEN_RATIO = 0.9
export const RECONCILIATION_DUPLICATE_TRIGRAM_RATIO = 0.9

/** Above this stem count per section, use rare-token candidate blocking before full compare. */
export const STEM_SIMILARITY_INVERTED_INDEX_THRESHOLD = 400

const SIMILARITY_IGNORED_TOKENS = new Set([
  'about',
  'after',
  'answer',
  'answers',
  'before',
  'between',
  'calculate',
  'calculation',
  'chart',
  'data',
  'decrease',
  'following',
  'increase',
  'more',
  'most',
  'number',
  'numbers',
  'option',
  'options',
  'percentage',
  'percentages',
  'table',
  'than',
  'that',
  'their',
  'there',
  'these',
  'this',
  'total',
  'using',
  'value',
  'values',
  'what',
  'which',
  'with',
  'would',
])

const REQUIRED_DM_QUESTION_SCAFFOLDS = [
  /place\s+['"]?yes['"]?\s+if\s+the\s+conclusion\s+does\s+follow\.?\s*place\s+['"]?no['"]?\s+if\s+the\s+conclusion\s+does\s+not\s+follow\.?/giu,
  /select\s+the\s+strongest\s+argument\s+from\s+the\s+statements\s+below\.?/giu,
]

export function normalizeSimilarityText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’']/gu, "'")
    .replace(/\s+/gu, ' ')
}

export function stripRequiredDmQuestionScaffolds(value: string): string {
  return REQUIRED_DM_QUESTION_SCAFFOLDS.reduce((text, pattern) => text.replace(pattern, ' '), value)
}

export function similarityWords(value: string): string[] {
  return normalizeSimilarityText(stripRequiredDmQuestionScaffolds(value))
    .replace(/[^a-z0-9]+/gu, ' ')
    .split(' ')
    .filter(
      (token) => (token.length >= 3 || /^\d{2,}$/u.test(token)) && !SIMILARITY_IGNORED_TOKENS.has(token),
    )
}

export function wordTrigrams(words: string[]): Set<string> {
  const trigrams = new Set<string>()
  for (let index = 0; index <= words.length - 3; index += 1) {
    trigrams.add(words.slice(index, index + 3).join(' '))
  }
  return trigrams
}

function sharedItems<T>(left: Set<T>, right: Set<T>): T[] {
  return [...left].filter((item) => right.has(item))
}

export type StemSimilarityResult = {
  isNearCopy: boolean
  tokenRatio: number
  trigramRatio: number
  sharedTokens: string[]
  sharedPhrases: string[]
}

export type StemSimilarityThresholds = {
  tokenMinShared?: number
  tokenRatio?: number
  trigramMinShared?: number
  trigramRatio?: number
}

export const RECONCILIATION_DUPLICATE_THRESHOLDS: Required<StemSimilarityThresholds> = {
  tokenMinShared: STEM_SIMILARITY_TOKEN_MIN_SHARED,
  tokenRatio: RECONCILIATION_DUPLICATE_TOKEN_RATIO,
  trigramMinShared: STEM_SIMILARITY_TRIGRAM_MIN_SHARED,
  trigramRatio: RECONCILIATION_DUPLICATE_TRIGRAM_RATIO,
}

export function compareStemSimilarityText(
  leftText: string,
  rightText: string,
  thresholds: StemSimilarityThresholds = {},
): StemSimilarityResult {
  const tokenMinShared = thresholds.tokenMinShared ?? STEM_SIMILARITY_TOKEN_MIN_SHARED
  const tokenRatioThreshold = thresholds.tokenRatio ?? STEM_SIMILARITY_TOKEN_RATIO
  const trigramMinShared = thresholds.trigramMinShared ?? STEM_SIMILARITY_TRIGRAM_MIN_SHARED
  const trigramRatioThreshold = thresholds.trigramRatio ?? STEM_SIMILARITY_TRIGRAM_RATIO

  const left = normalizeSimilarityText(leftText)
  const right = normalizeSimilarityText(rightText)
  if (left.length < STEM_SIMILARITY_MIN_CHARS || right.length < STEM_SIMILARITY_MIN_CHARS) {
    return {
      isNearCopy: false,
      tokenRatio: 0,
      trigramRatio: 0,
      sharedTokens: [],
      sharedPhrases: [],
    }
  }

  const leftWords = similarityWords(left)
  const rightWords = similarityWords(right)
  const leftTokens = new Set(leftWords)
  const rightTokens = new Set(rightWords)
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return {
      isNearCopy: false,
      tokenRatio: 0,
      trigramRatio: 0,
      sharedTokens: [],
      sharedPhrases: [],
    }
  }

  const leftTrigrams = wordTrigrams(leftWords)
  const rightTrigrams = wordTrigrams(rightWords)
  const sharedTokens = sharedItems(leftTokens, rightTokens)
  const sharedTrigrams = sharedItems(leftTrigrams, rightTrigrams)
  const tokenRatio = sharedTokens.length / Math.max(1, Math.min(leftTokens.size, rightTokens.size))
  const trigramRatio =
    sharedTrigrams.length / Math.max(1, Math.min(leftTrigrams.size, rightTrigrams.size))
  const isNearCopy =
    (sharedTokens.length >= tokenMinShared && tokenRatio >= tokenRatioThreshold) ||
    (sharedTrigrams.length >= trigramMinShared && trigramRatio >= trigramRatioThreshold)

  return {
    isNearCopy,
    tokenRatio: Number(tokenRatio.toFixed(3)),
    trigramRatio: Number(trigramRatio.toFixed(3)),
    sharedTokens: sharedTokens.slice(0, 12),
    sharedPhrases: sharedTrigrams.slice(0, 6),
  }
}

export type StemSimilarityIndexEntry = {
  id: string
  comparisonText: string
  words: string[]
  tokens: Set<string>
}

export function buildStemSimilarityIndexEntry(
  id: string,
  comparisonText: string,
): StemSimilarityIndexEntry | null {
  const normalized = normalizeSimilarityText(comparisonText)
  if (normalized.length < STEM_SIMILARITY_MIN_CHARS) return null
  const words = similarityWords(normalized)
  const tokens = new Set(words)
  if (tokens.size === 0) return null
  return { id, comparisonText: normalized, words, tokens }
}

/**
 * Find near-copy pairs among indexed stems (caller should already scope by section).
 * Returns pairs with idA < idB lexicographically for stable ids.
 */
export function findPotentialDuplicatePairs(
  entries: StemSimilarityIndexEntry[],
  thresholds: StemSimilarityThresholds = RECONCILIATION_DUPLICATE_THRESHOLDS,
): Array<{
  idA: string
  idB: string
  result: StemSimilarityResult
}> {
  if (entries.length < 2) return []

  const tokenMinShared = thresholds.tokenMinShared ?? STEM_SIMILARITY_TOKEN_MIN_SHARED
  const trigramMinShared = thresholds.trigramMinShared ?? STEM_SIMILARITY_TRIGRAM_MIN_SHARED

  const pairs: Array<{ idA: string; idB: string; result: StemSimilarityResult }> = []
  const useInvertedIndex = entries.length > STEM_SIMILARITY_INVERTED_INDEX_THRESHOLD

  let candidatePairs: Array<[number, number]> | null = null
  if (useInvertedIndex) {
    const tokenToIndices = new Map<string, number[]>()
    const maxDocFreq = Math.max(2, Math.floor(entries.length * 0.2))
    for (let i = 0; i < entries.length; i += 1) {
      for (const token of entries[i].tokens) {
        const list = tokenToIndices.get(token)
        if (list) list.push(i)
        else tokenToIndices.set(token, [i])
      }
    }
    const seen = new Set<string>()
    const collected: Array<[number, number]> = []
    for (const indices of tokenToIndices.values()) {
      if (indices.length < 2 || indices.length > maxDocFreq) continue
      for (let a = 0; a < indices.length; a += 1) {
        for (let b = a + 1; b < indices.length; b += 1) {
          const i = indices[a]
          const j = indices[b]
          const key = i < j ? `${i}:${j}` : `${j}:${i}`
          if (seen.has(key)) continue
          seen.add(key)
          collected.push(i < j ? [i, j] : [j, i])
        }
      }
    }
    candidatePairs = collected
  }

  const comparePair = (i: number, j: number) => {
    const left = entries[i]
    const right = entries[j]
    // Cheap reject: need enough shared tokens before full trigram work
    const sharedTokenCount = sharedItems(left.tokens, right.tokens).length
    if (sharedTokenCount < tokenMinShared && left.words.length >= 3 && right.words.length >= 3) {
      // Still allow trigram path when both have enough words — cheap trigram precheck
      const leftTrigrams = wordTrigrams(left.words)
      const rightTrigrams = wordTrigrams(right.words)
      if (sharedItems(leftTrigrams, rightTrigrams).length < trigramMinShared) {
        return
      }
    }
    const result = compareStemSimilarityText(left.comparisonText, right.comparisonText, thresholds)
    if (!result.isNearCopy) return
    const [idA, idB] = left.id < right.id ? [left.id, right.id] : [right.id, left.id]
    pairs.push({ idA, idB, result })
  }

  if (candidatePairs) {
    for (const [i, j] of candidatePairs) comparePair(i, j)
  } else {
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        comparePair(i, j)
      }
    }
  }

  return pairs
}
