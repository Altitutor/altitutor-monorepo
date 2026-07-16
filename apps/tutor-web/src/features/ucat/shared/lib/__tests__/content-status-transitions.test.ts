import { getUcatContentStatusTransitionOptions } from '@/features/ucat/shared/types'

describe('getUcatContentStatusTransitionOptions', () => {
  it('only allows draft content to move to review', () => {
    expect(getUcatContentStatusTransitionOptions('draft').map((option) => option.value)).toEqual([
      'in_review',
    ])
  })

  it('allows reviewed content to move backward or publish', () => {
    expect(getUcatContentStatusTransitionOptions('in_review').map((option) => option.value)).toEqual([
      'draft',
      'published',
    ])
  })

  it('allows published content to move to draft or review', () => {
    expect(getUcatContentStatusTransitionOptions('published').map((option) => option.value)).toEqual([
      'draft',
      'in_review',
    ])
  })
})
