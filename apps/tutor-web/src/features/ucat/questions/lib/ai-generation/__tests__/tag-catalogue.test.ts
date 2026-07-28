import { buildAiGenerationTagCatalogue } from '../tag-catalogue'

describe('buildAiGenerationTagCatalogue', () => {
  it('includes descendants whose section is inherited from their root tag', () => {
    const catalogue = buildAiGenerationTagCatalogue([
      {
        id: 'vr-root',
        name: 'Evidence handling',
        description: 'Find and use passage evidence.',
        parentId: null,
        sectionId: 'vr',
      },
      {
        id: 'vr-child',
        name: 'Inference',
        description: 'Draw a supported conclusion.',
        parentId: 'vr-root',
        sectionId: null,
      },
      {
        id: 'qr-root',
        name: 'Percentages',
        description: 'Work with proportions out of 100.',
        parentId: null,
        sectionId: 'qr',
      },
    ], 'vr')

    expect(catalogue).toEqual([
      expect.objectContaining({
        id: 'vr-root',
        path: 'Evidence handling',
      }),
      expect.objectContaining({
        id: 'vr-child',
        path: 'Evidence handling / Inference',
        parentId: 'vr-root',
      }),
    ])
  })
})
