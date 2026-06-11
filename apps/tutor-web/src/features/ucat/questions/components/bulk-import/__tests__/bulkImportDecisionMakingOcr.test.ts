import { collectDecisionMakingLinesWithSyllogismImageOcr } from '../bulkImportDecisionMakingOcr'

const recognize = jest.fn()
const terminate = jest.fn()
const setParameters = jest.fn()
const createWorker = jest.fn()

jest.mock('tesseract.js', () => ({
  createWorker,
  PSM: { SINGLE_BLOCK: '6' },
}))

beforeEach(() => {
  recognize.mockReset()
  terminate.mockReset().mockResolvedValue({})
  setParameters.mockReset().mockResolvedValue({})
  createWorker.mockReset().mockResolvedValue({
    recognize,
    terminate,
    setParameters,
  })
})

describe('collectDecisionMakingLinesWithSyllogismImageOcr', () => {
  it('replaces a syllogism image token with five OCR statements', async () => {
    recognize.mockResolvedValue({
      data: {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  { text: 'This cake is burnt.', confidence: 96 },
                  { text: 'Anything that is burnt is baked.', confidence: 94 },
                  { text: 'Some cakes are not burnt.', confidence: 95 },
                  { text: 'All cakes are burnt.', confidence: 97 },
                  { text: 'If a cake is not burnt, it cannot be baked.', confidence: 93 },
                ],
              },
            ],
          },
        ],
      },
    })

    const result = await collectDecisionMakingLinesWithSyllogismImageOcr({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'This cake is baked.' }] },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text:
                "1. Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.",
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: { src: 'https://example.com/syllogism.png', fileId: 'img-1' },
            },
          ],
        },
      ],
    })

    expect(result.warnings).toEqual([])
    expect(result.extractedImageCount).toBe(1)
    expect(result.lines).toEqual([
      'This cake is baked.',
      "1. Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.",
      'This cake is burnt.',
      'Anything that is burnt is baked.',
      'Some cakes are not burnt.',
      'All cakes are burnt.',
      'If a cake is not burnt, it cannot be baked.',
    ])
    expect(recognize).toHaveBeenCalledWith('https://example.com/syllogism.png')
    expect(terminate).toHaveBeenCalled()
  })

  it('does not OCR unrelated images', async () => {
    const result = await collectDecisionMakingLinesWithSyllogismImageOcr({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Which statement is true?' }] },
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: { src: 'https://example.com/diagram.png', fileId: 'img-2' },
            },
          ],
        },
      ],
    })

    expect(result.imageCount).toBe(0)
    expect(createWorker).not.toHaveBeenCalled()
  })

  it('detects an unnumbered syllogism image token and warns when no URL is available', async () => {
    const result = await collectDecisionMakingLinesWithSyllogismImageOcr({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Stem text.' }] },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text:
                "Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.",
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: { fileId: 'img-1' },
            },
          ],
        },
      ],
    })

    expect(result.imageCount).toBe(1)
    expect(result.extractedImageCount).toBe(0)
    expect(result.warnings).toEqual([
      'A syllogism image could not be OCR parsed because it has no readable image URL.',
    ])
    expect(createWorker).toHaveBeenCalled()
  })
})
