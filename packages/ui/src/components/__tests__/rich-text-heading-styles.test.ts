import { OMIT_TYPOGRAPHY_HEADING_CLASSNAME } from '../rich-text-editor-styles'

describe('Rich-text heading styles', () => {
  it('targets headings that are direct children of the ProseMirror root', () => {
    const classes = OMIT_TYPOGRAPHY_HEADING_CLASSNAME.split(' ')

    expect(classes).toEqual(expect.arrayContaining([
      '[&_h1]:text-2xl',
      '[&_h2]:text-xl',
      '[&_h3]:text-lg',
      '[&_h1]:font-semibold',
      '[&_h2]:font-semibold',
      '[&_h3]:font-semibold',
    ]))
    expect(classes.some((className) => className.includes('.ProseMirror_h'))).toBe(false)
  })
})
