/**
 * Detects whether an AI-generated question bundle is too close to source
 * material. This is an originality guard, not question-bank duplicate finding.
 */

const MIN_COMPARISON_CHARS = 120
const MIN_SHARED_TOKENS = 8
const TOKEN_RATIO_THRESHOLD = 0.72
const MIN_SHARED_TRIGRAMS = 3
const TRIGRAM_RATIO_THRESHOLD = 0.45

const IGNORED_TOKENS = new Set([
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

export function normalizeGenerationSimilarityText(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’']/gu, "'")
    .replace(/\s+/gu, ' ')
}

function significantWords(value: string): string[] {
  const withoutRequiredScaffolds = REQUIRED_DM_QUESTION_SCAFFOLDS.reduce(
    (text, pattern) => text.replace(pattern, ' '),
    value,
  )
  return normalizeGenerationSimilarityText(withoutRequiredScaffolds)
    .replace(/[^a-z0-9]+/gu, ' ')
    .split(' ')
    .filter(
      (token) =>
        (token.length >= 3 || /^\d{2,}$/u.test(token)) &&
        !IGNORED_TOKENS.has(token),
    )
}

function wordTrigrams(words: string[]): Set<string> {
  const trigrams = new Set<string>()
  for (let index = 0; index <= words.length - 3; index += 1) {
    trigrams.add(words.slice(index, index + 3).join(' '))
  }
  return trigrams
}

function sharedItems<T>(left: Set<T>, right: Set<T>): T[] {
  return [...left].filter((item) => right.has(item))
}

export type GenerationSourceSimilarity = {
  isNearCopy: boolean
  tokenRatio: number
  trigramRatio: number
  sharedTokens: string[]
  sharedPhrases: string[]
}

export function compareGenerationSourceSimilarity(
  candidateText: string,
  sourceText: string,
): GenerationSourceSimilarity {
  const candidate = normalizeGenerationSimilarityText(candidateText)
  const source = normalizeGenerationSimilarityText(sourceText)
  if (candidate.length < MIN_COMPARISON_CHARS || source.length < MIN_COMPARISON_CHARS) {
    return {
      isNearCopy: false,
      tokenRatio: 0,
      trigramRatio: 0,
      sharedTokens: [],
      sharedPhrases: [],
    }
  }

  const candidateWords = significantWords(candidate)
  const sourceWords = significantWords(source)
  const candidateTokens = new Set(candidateWords)
  const sourceTokens = new Set(sourceWords)
  if (candidateTokens.size === 0 || sourceTokens.size === 0) {
    return {
      isNearCopy: false,
      tokenRatio: 0,
      trigramRatio: 0,
      sharedTokens: [],
      sharedPhrases: [],
    }
  }

  const sharedTokens = sharedItems(candidateTokens, sourceTokens)
  const candidateTrigrams = wordTrigrams(candidateWords)
  const sourceTrigrams = wordTrigrams(sourceWords)
  const sharedTrigrams = sharedItems(candidateTrigrams, sourceTrigrams)
  const tokenRatio =
    sharedTokens.length / Math.max(1, Math.min(candidateTokens.size, sourceTokens.size))
  const trigramRatio =
    sharedTrigrams.length / Math.max(1, Math.min(candidateTrigrams.size, sourceTrigrams.size))

  return {
    isNearCopy:
      (sharedTokens.length >= MIN_SHARED_TOKENS && tokenRatio >= TOKEN_RATIO_THRESHOLD) ||
      (sharedTrigrams.length >= MIN_SHARED_TRIGRAMS &&
        trigramRatio >= TRIGRAM_RATIO_THRESHOLD),
    tokenRatio: Number(tokenRatio.toFixed(3)),
    trigramRatio: Number(trigramRatio.toFixed(3)),
    sharedTokens: sharedTokens.slice(0, 12),
    sharedPhrases: sharedTrigrams.slice(0, 6),
  }
}
