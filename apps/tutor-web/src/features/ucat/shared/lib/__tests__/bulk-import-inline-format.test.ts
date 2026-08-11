import {
  encodeBulkImportMarkedText,
  execRegexOnTokenizedLine,
  plainTextWithIndexMap,
  stripBulkImportFormatTokens,
  stripBulkImportListItemPrefix,
} from '../bulk-import-inline-format'

describe('bulk-import inline format tokens', () => {
  it('encodes bold and italic marks as nested tokens', () => {
    expect(encodeBulkImportMarkedText('market', [{ type: 'bold' }])).toBe('[[B:]]market[[/B:]]')
    expect(encodeBulkImportMarkedText('share', [{ type: 'italic' }])).toBe('[[I:]]share[[/I:]]')
    expect(
      encodeBulkImportMarkedText('both', [{ type: 'bold' }, { type: 'italic' }])
    ).toBe('[[B:]][[I:]]both[[/I:]][[/B:]]')
  })

  it('strips format tokens while preserving image placeholders', () => {
    expect(
      stripBulkImportFormatTokens('[[B:]]Hello[[/B:]] [[IMG:f=abc]] [[LI:]]world')
    ).toBe('Hello [[IMG:f=abc]] world')
  })

  it('strips the list-item prefix only', () => {
    expect(stripBulkImportListItemPrefix('[[LI:]]Blue Skies')).toBe('Blue Skies')
    expect(stripBulkImportListItemPrefix('  [[LI:]]indented')).toBe('  indented')
  })

  it('maps plain indices back through format tokens for regex captures', () => {
    const line = '[[B:]]1.[[/B:]] The [[I:]]figure[[/I:]] below'
    const { plain } = plainTextWithIndexMap(line)
    expect(plain).toBe('1. The figure below')

    const match = execRegexOnTokenizedLine(line, /^\s*(\d+)\.\s+(.*\S)\s*$/u)
    expect(match?.[1]).toBe('1')
    expect(match?.[2]).toBe('The [[I:]]figure[[/I:]] below')
  })
})
