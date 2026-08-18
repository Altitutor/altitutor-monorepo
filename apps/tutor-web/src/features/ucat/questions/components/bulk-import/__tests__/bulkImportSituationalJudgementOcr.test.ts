import {
  collectSituationalJudgementLinesWithScreenshotOcr,
  extractSituationalJudgementScreenshotLines,
} from '../bulkImportSituationalJudgementOcr'
import { parseSituationalJudgementPlainText } from '@/features/ucat/questions/lib/parsers/situationalJudgement'

const recognize = jest.fn()
const terminate = jest.fn()
const setParameters = jest.fn()
const createWorker = jest.fn()

jest.mock('tesseract.js', () => ({
  createWorker,
  PSM: { AUTO: '3' },
}))

beforeEach(() => {
  recognize.mockReset()
  terminate.mockReset().mockResolvedValue({})
  setParameters.mockReset().mockResolvedValue({})
  createWorker.mockReset().mockResolvedValue({ recognize, terminate, setParameters })
})

const screenshotParagraphs = [
  { text: 'Timothy is a patient on an intensive care ward who is struggling to breathe.', confidence: 96 },
  {
    text: 'Choose the one most appropriate action and the one least appropriate action that Dr Wilson should take.',
    confidence: 95,
  },
  { text: 'You will not receive any marks for this question unless you select both actions.', confidence: 94 },
  { text: 'Most Appropriate', confidence: 98 },
  { text: 'Least Appropriate', confidence: 98 },
  { text: 'Go and find the consultant and ask him to help.', confidence: 96 },
  { text: 'Ask one of the nurses on the ward to help immediately.', confidence: 95 },
  { text: 'Try to help Timothy himself until the consultant returns.', confidence: 97 },
]

describe('extractSituationalJudgementScreenshotLines', () => {
  it('removes screenshot chrome and emits parser-ready question lines', () => {
    expect(extractSituationalJudgementScreenshotLines(screenshotParagraphs)).toEqual([
      'Timothy is a patient on an intensive care ward who is struggling to breathe.',
      '1. Choose the one most appropriate action and the one least appropriate action that Dr Wilson should take.',
      'a. Go and find the consultant and ask him to help.',
      'b. Ask one of the nurses on the ward to help immediately.',
      'c. Try to help Timothy himself until the consultant returns.',
    ])
  })

  it('rejects low-confidence and incomplete screenshot OCR', () => {
    expect(extractSituationalJudgementScreenshotLines(
      screenshotParagraphs.map((paragraph) => ({ ...paragraph, confidence: 50 }))
    )).toBeNull()
    expect(extractSituationalJudgementScreenshotLines(screenshotParagraphs.slice(0, -1))).toBeNull()
  })
})

describe('collectSituationalJudgementLinesWithScreenshotOcr', () => {
  it('recovers logical sections when Tesseract packs spaced rows into one paragraph', async () => {
    const line = (
      text: string,
      y0: number,
      y1: number,
      confidence = 96,
      x0 = 10,
      x1 = 900
    ) => ({
      text,
      confidence,
      bbox: { x0, y0, x1, y1 },
    })
    recognize.mockResolvedValue({
      data: {
        blocks: [{
          paragraphs: [
            {
              confidence: 96,
              lines: [
                line('Daisy was upset by anonymous comments during her presentation.', 20, 40),
                line('Peter spoke to her after the presentation.', 44, 64),
                line(
                  'You will not receive any marks for this question unless you select both actions.',
                  160,
                  180
                ),
              ],
            },
            {
              lines: [line('that Peter should take.', 100, 120, 96, 650, 900)],
            },
            {
              lines: [line(
                'Choose both the one most appropriate action and the one least approj te action',
                100,
                120,
                96,
                10,
                630
              )],
            },
            { lines: [line('unreadable selection control', 220, 280, 5)] },
            { lines: [line('unreadable selection control', 300, 360, 8)] },
            {
              confidence: 96,
              lines: [
                line('Reassure Daisy that the presentation was good.', 420, 440),
                line('Offer to find out who posted the comments.', 500, 520),
                line('Discuss what went well and what she could do differently', 580, 600),
                line('in a future presentation.', 604, 624),
              ],
            },
          ],
        }],
      },
    })

    const result = await collectSituationalJudgementLinesWithScreenshotOcr({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'image', attrs: { src: 'https://example.com/packed.png' } }],
      }],
    })

    expect(result.extractedImageCount).toBe(1)
    expect(result.lines).toEqual([
      'Daisy was upset by anonymous comments during her presentation. Peter spoke to her after the presentation.',
      '1. Choose both the one most appropriate action and the one least appropriate action that Peter should take.',
      'a. Reassure Daisy that the presentation was good.',
      'b. Offer to find out who posted the comments.',
      'c. Discuss what went well and what she could do differently in a future presentation.',
    ])
  })

  it('replaces an SJ screenshot in place without disturbing surrounding questions', async () => {
    recognize.mockResolvedValue({
      data: {
        blocks: screenshotParagraphs.map((paragraph) => ({
          paragraphs: [{ text: paragraph.text, confidence: paragraph.confidence }],
        })),
      },
    })
    const result = await collectSituationalJudgementLinesWithScreenshotOcr({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Earlier scenario.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '1. How appropriate is this action?' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'a. Very appropriate' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'b. Appropriate but not ideal' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'c. Inappropriate but not awful' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'd. Very inappropriate' }] },
        {
          type: 'paragraph',
          content: [{
            type: 'image',
            attrs: { src: 'https://example.com/sj.png', fileId: 'sj-image' },
          }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Later scenario.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '1. How important is this action?' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'a. Very important' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'b. Important' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'c. Of minor importance' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'd. Not important at all' }] },
      ],
    })

    expect(result.extractedImageCount).toBe(1)
    expect(result.warnings).toEqual([])
    expect(parseSituationalJudgementPlainText(result.lines.join('\n'))).toHaveLength(3)
    expect(recognize).toHaveBeenCalledWith(
      'https://example.com/sj.png',
      {},
      { text: true, blocks: true }
    )
    expect(terminate).toHaveBeenCalled()
  })

  it('leaves unrelated SJ images in the document', async () => {
    recognize.mockResolvedValue({
      data: { blocks: [{ paragraphs: [{ text: 'A clinical diagram', confidence: 98 }] }] },
    })
    const result = await collectSituationalJudgementLinesWithScreenshotOcr({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'image', attrs: { src: 'https://example.com/diagram.png' } }],
      }],
    })

    expect(result.extractedImageCount).toBe(0)
    expect(result.lines[0]).toContain('[[IMG:')
  })
})
