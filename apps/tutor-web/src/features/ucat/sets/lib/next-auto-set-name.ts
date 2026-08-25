export function sectionNameAbbreviation(sectionName: string | null | undefined): string {
  const words = (sectionName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'Set'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('')
}

function incrementTrailingNumber(name: string): string | null {
  const match = name.trim().match(/^(.*?)(\d+)$/)
  if (!match) return null
  return `${match[1]}${Number(match[2]) + 1}`
}

export function nextAutoSetName({
  existingNamesNewestFirst,
  sectionName,
}: {
  existingNamesNewestFirst: string[]
  sectionName: string | null | undefined
}): string {
  const used = new Set(existingNamesNewestFirst.map((name) => name.trim()).filter(Boolean))
  const last = existingNamesNewestFirst.map((name) => name.trim()).find(Boolean)
  let candidate = last ? incrementTrailingNumber(last) : null
  if (!candidate) candidate = `${sectionNameAbbreviation(sectionName)} set 1`

  while (used.has(candidate)) {
    candidate = incrementTrailingNumber(candidate) ?? `${candidate} 1`
  }
  return candidate
}
