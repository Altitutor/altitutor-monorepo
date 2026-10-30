import React from 'react'
import { highlightText } from '../highlighting'

describe('highlightText', () => {
  it('treats regex metacharacters in the search query as literal text', () => {
    expect(() => highlightText('Find (?< literally', '(?<')).not.toThrow()

    const result = highlightText('Find (?< literally', '(?<')
    const highlighted = React.Children.toArray(result).find(
      (child) => React.isValidElement<{ className?: string }>(child) && child.props.className?.includes('font-semibold'),
    )

    expect(React.isValidElement<{ children?: React.ReactNode }>(highlighted) ? highlighted.props.children : null).toBe('(?<')
  })
})
