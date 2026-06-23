import {
  mapParsedStemsToFormValues,
  parseCombinedDocumentForSection,
} from '../bulkImportParseSection'

const parsingOptions = {
  questionIndicator: 'dot' as const,
  answerOptionIndicator: 'dot' as const,
  questionNumberOnOwnLine: false,
  answerOptionOnOwnLine: false,
  requireConsecutiveQuestionNumbers: true,
  decisionMakingQuestionNumberPlacement: 'question' as const,
  quantitativeReasoningQuestionNumberPlacement: 'question' as const,
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

  it('parses Decision Making documents where question numbers mark item stems', () => {
    const stems = parseCombinedDocumentForSection(
      {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: '5.' }] },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'A group of seven friends are going for a road trip to Rockhampton from Brisbane.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Bob and Alex should not travel in the same car.' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text:
                  'If Ellie and Alex sit in the same car with Ellie in the back row, determine the possible position of Bob?',
              },
            ],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'A.' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'In the front row of the other car' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'B.' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'In the front row of the same car' }],
          },
        ],
      },
      'decision_making',
      {
        ...parsingOptions,
        answerOptionOnOwnLine: true,
        decisionMakingQuestionNumberPlacement: 'item_stem',
      }
    )

    expect(stems).toHaveLength(1)
    expect(stems[0]?.stemText).toContain('A group of seven friends')
    expect(stems[0]?.stemText).not.toContain('determine the possible position of Bob')
    expect(stems[0]?.questions[0]?.number).toBe(5)
    expect(stems[0]?.questions[0]?.text).toContain('determine the possible position of Bob')
    expect(stems[0]?.questions[0]?.options).toHaveLength(2)
  })

  it('deduplicates QR repeated stems when question numbers mark each stem block', () => {
    const stems = parseCombinedDocumentForSection(
      {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: '1.' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'The table below depicts income over the years.' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'image', attrs: { fileId: 'img-1', src: 'https://example.com/1.png' } }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'What is the ratio between Charlie and Rahul?' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'A.' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '53 : 87' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'B.' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '87 : 53' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '2.' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'The table below depicts income over the years.' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'image', attrs: { fileId: 'img-2', src: 'https://example.com/2.png' } }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Who achieved the maximum increase?' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'A.' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Nancy' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'B.' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'David' }] },
        ],
      },
      'quantitative_reasoning',
      {
        ...parsingOptions,
        answerOptionOnOwnLine: true,
        quantitativeReasoningQuestionNumberPlacement: 'item_stem',
      }
    )

    expect(stems).toHaveLength(1)
    expect(stems[0]?.stemText).toContain('The table below depicts income')
    expect(stems[0]?.questions).toHaveLength(2)
    expect(stems[0]?.questions.map((q) => q.number)).toEqual([1, 2])
  })

  it('auto-selects Situational Judgement categories from question wording', () => {
    const sectionId = 'sj-section'
    const categories = [
      { id: 'cat-appropriate', ucat_section_id: sectionId, name: 'How Appropriate' },
      { id: 'cat-important', ucat_section_id: sectionId, name: 'How Important' },
    ]

    const forms = mapParsedStemsToFormValues(
      [
        {
          stemText:
            'A junior doctor notices a colleague documenting care late. How appropriate are each of these responses to the situation?',
          questions: [
            {
              number: 1,
              text: 'Speak with the colleague privately.',
              options: [
                { label: 'a', text: 'A very appropriate thing to do' },
                { label: 'b', text: 'Appropriate, but not ideal' },
              ],
            },
          ],
        },
        {
          stemText:
            'A patient asks for advice before discharge. How important are each of the following considerations?',
          questions: [
            {
              number: 2,
              text: 'Escalating a safety concern.',
              options: [
                { label: 'a', text: 'Very important' },
                { label: 'b', text: 'Important' },
              ],
            },
          ],
        },
      ],
      'situational_judgement',
      sectionId,
      categories
    )

    expect(forms.map((form) => form.categoryId)).toEqual(['cat-appropriate', 'cat-important'])
  })
})
