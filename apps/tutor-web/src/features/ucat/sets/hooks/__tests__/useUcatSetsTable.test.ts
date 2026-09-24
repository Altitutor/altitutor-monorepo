import { resolveSetTableName } from '@/features/ucat/sets/lib/set-table-name'

describe('resolveSetTableName', () => {
  it('prefers the deterministic display name over the retired rich-text name', () => {
    expect(
      resolveSetTableName({
        display_name: 'Verbal Reasoning Full Set 2',
        name: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Legacy name' }],
            },
          ],
        },
      }),
    ).toBe('Verbal Reasoning Full Set 2')
  })

  it('falls back to the tutor note for an unnumbered authoring row', () => {
    expect(resolveSetTableName({ authoring_note: 'Slow benchmark' })).toBe(
      'Slow benchmark',
    )
  })
})
