/**
 * Intermediate tokens for bulk-import ProseMirror ↔ logical-line round-trips.
 * Bold/italic/list-item structure is encoded into the string line format so
 * question/option regexes can still match after stripping these tokens.
 *
 * Ordered/numbered lists are intentionally NOT encoded here: collectors keep
 * flattening them to `1. ` / `2. ` plain prefixes so stem/question parsing works.
 */

export const BULK_IMPORT_BOLD_OPEN = '[[B:]]'
export const BULK_IMPORT_BOLD_CLOSE = '[[/B:]]'
export const BULK_IMPORT_ITALIC_OPEN = '[[I:]]'
export const BULK_IMPORT_ITALIC_CLOSE = '[[/I:]]'
export const BULK_IMPORT_LIST_ITEM_PREFIX = '[[LI:]]'

const FORMAT_TOKEN_RE = /\[\[(?:\/?[BI]|LI):\]\]/gu

export type BulkImportInlineMarkType = 'bold' | 'italic'

export function stripBulkImportFormatTokens(text: string): string {
  return text.replace(FORMAT_TOKEN_RE, '')
}

export function encodeBulkImportMarkedText(
  text: string,
  marks: ReadonlyArray<{ type?: string | null } | null | undefined> | null | undefined
): string {
  if (!text) return text
  const types = new Set(
    (marks ?? [])
      .map((mark) => mark?.type)
      .filter((type): type is string => typeof type === 'string' && type.length > 0)
  )
  let encoded = text
  // Italic innermost so nested [[B:]][[I:]]…[[/I:]][[/B:]] round-trips cleanly.
  if (types.has('italic')) {
    encoded = `${BULK_IMPORT_ITALIC_OPEN}${encoded}${BULK_IMPORT_ITALIC_CLOSE}`
  }
  if (types.has('bold')) {
    encoded = `${BULK_IMPORT_BOLD_OPEN}${encoded}${BULK_IMPORT_BOLD_CLOSE}`
  }
  return encoded
}

export function isBulkImportListItemLine(line: string): boolean {
  return line.trimStart().startsWith(BULK_IMPORT_LIST_ITEM_PREFIX)
}

export function stripBulkImportListItemPrefix(line: string): string {
  const trimmedStart = line.trimStart()
  if (!trimmedStart.startsWith(BULK_IMPORT_LIST_ITEM_PREFIX)) return line
  const leadingWs = line.slice(0, line.length - trimmedStart.length)
  return leadingWs + trimmedStart.slice(BULK_IMPORT_LIST_ITEM_PREFIX.length)
}

/** Plain text plus map from each plain index → index in the tokenized source. */
export function plainTextWithIndexMap(tokenized: string): {
  plain: string
  indexMap: number[]
} {
  const plainChars: string[] = []
  const indexMap: number[] = []
  let i = 0
  while (i < tokenized.length) {
    if (tokenized.startsWith('[[', i)) {
      const close = tokenized.indexOf(']]', i + 2)
      if (close !== -1) {
        const token = tokenized.slice(i, close + 2)
        if (/^\[\[(?:\/?[BI]|LI):\]\]$/u.test(token)) {
          i = close + 2
          continue
        }
        // Preserve [[IMG:…]] / [[TABLE:…]] (and unknown tokens) in plain text.
        for (let j = i; j < close + 2; j += 1) {
          plainChars.push(tokenized[j]!)
          indexMap.push(j)
        }
        i = close + 2
        continue
      }
    }
    plainChars.push(tokenized[i]!)
    indexMap.push(i)
    i += 1
  }
  return { plain: plainChars.join(''), indexMap }
}

/**
 * Run a ^-anchored regex against the format-stripped line, returning capture
 * groups sliced from the original tokenized string (marks preserved in bodies).
 */
export function execRegexOnTokenizedLine(
  tokenizedLine: string,
  regex: RegExp
): RegExpExecArray | null {
  const { plain, indexMap } = plainTextWithIndexMap(tokenizedLine)
  const flags = regex.flags.includes('d') ? regex.flags : `${regex.flags}d`
  const withIndices = new RegExp(regex.source, flags)
  const match = withIndices.exec(plain)
  if (!match) return null

  const indices = match.indices
  if (!indices) {
    // Engine without `d` support: fall back to stripped groups only.
    return match
  }

  const sliceTokenized = (start: number, end: number): string => {
    if (start >= end) return ''
    const originStart = indexMap[start] ?? tokenizedLine.length
    const originEnd =
      end >= indexMap.length ? tokenizedLine.length : (indexMap[end] ?? tokenizedLine.length)
    return tokenizedLine.slice(originStart, originEnd)
  }

  const tokenizedGroups: string[] = [sliceTokenized(indices[0]![0], indices[0]![1])]
  for (let g = 1; g < match.length; g += 1) {
    const span = indices[g]
    if (!span || match[g] == null) {
      tokenizedGroups.push(match[g] as unknown as string)
      continue
    }
    tokenizedGroups.push(sliceTokenized(span[0], span[1]))
  }

  const result = tokenizedGroups as unknown as RegExpExecArray
  const fullSpan = indices[0]
  result.index = fullSpan ? (indexMap[fullSpan[0]] ?? 0) : match.index
  result.input = tokenizedLine
  result.groups = match.groups
  return result
}
