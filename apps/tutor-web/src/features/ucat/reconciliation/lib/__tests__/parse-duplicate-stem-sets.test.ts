import { parseDuplicateStemSets } from '../parse-duplicate-stem-sets'

function richName(text: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

describe('parseDuplicateStemSets', () => {
  it('converts ProseMirror set names to plain text with matching ids', () => {
    expect(
      parseDuplicateStemSets(
        [richName('VR Set 1'), richName('VR Set 2')],
        ['set-1', 'set-2'],
      ),
    ).toEqual([
      { id: 'set-1', name: 'VR Set 1' },
      { id: 'set-2', name: 'VR Set 2' },
    ])
  })

  it('falls back to Untitled when a name is empty', () => {
    expect(parseDuplicateStemSets([null], ['set-1'])).toEqual([
      { id: 'set-1', name: 'Untitled' },
    ])
  })

  it('returns plain-text names without ids when set ids are missing', () => {
    expect(parseDuplicateStemSets([richName('Orphan set')], null)).toEqual([
      { id: null, name: 'Orphan set' },
    ])
  })

  it('returns an empty list when there are no sets', () => {
    expect(parseDuplicateStemSets([], [])).toEqual([])
    expect(parseDuplicateStemSets(null, null)).toEqual([])
  })
})
