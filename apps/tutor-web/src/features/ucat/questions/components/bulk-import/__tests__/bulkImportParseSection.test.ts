import { parseCombinedDocumentForSection } from '../bulkImportParseSection'

const parsingOptions = {
  questionIndicator: 'dot' as const,
  answerOptionIndicator: 'dot' as const,
  questionNumberOnOwnLine: false,
  answerOptionOnOwnLine: false,
  requireConsecutiveQuestionNumbers: true,
}

describe('parseCombinedDocumentForSection', () => {
  it('shows image-backed Decision Making syllogisms as questions in sync preview', () => {
    const stems = parseCombinedDocumentForSection(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text:
                  'Physicians are from either Melbourne or Sydney and practise in either General Medicine or Oncology. Some physicians are from Melbourne and the rest practise Oncology.',
              },
            ],
          },
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
                attrs: {
                  fileId: 'img-1',
                  src: 'https://example.com/syllogism.png',
                },
              },
            ],
          },
        ],
      },
      'decision_making',
      parsingOptions
    )

    expect(stems).toHaveLength(1)
    expect(stems[0]?.stemText).toContain('Physicians are from either Melbourne or Sydney')
    expect(stems[0]?.questions).toHaveLength(1)
    expect(stems[0]?.questions[0]?.text).toContain("Place 'Yes'")
    expect(stems[0]?.questions[0]?.options).toHaveLength(5)
  })
})
