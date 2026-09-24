const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

export type ParsedQuestionStemIdInput = {
  ids: string[]
  invalidTokens: string[]
}

export function parseQuestionStemIdInput(input: string): ParsedQuestionStemIdInput {
  const tokens = input
    .split(/[\s,]+/u)
    .map((token) => token.trim())
    .filter(Boolean)

  const ids: string[] = []
  const invalidTokens: string[] = []
  const seen = new Set<string>()

  for (const token of tokens) {
    if (!UUID_PATTERN.test(token)) {
      invalidTokens.push(token)
      continue
    }

    const id = token.toLowerCase()
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }

  return { ids, invalidTokens }
}
