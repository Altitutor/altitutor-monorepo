import {
  applySyllogismManualEntryTargets,
  collectSyllogismManualEntryTargets,
  syllogismManualEntryIsComplete,
} from '../bulkImportSyllogismManual'
import { SYLLOGISM_IMAGE_PLACEHOLDER_LINES } from '@/features/ucat/questions/lib/parsers/decisionMaking'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'

function buildSyllogismStemDraft(): BulkImportStemDraft {
  const values: UcatQuestionStemFormValues = {
    sectionId: '00000000-0000-4000-8000-000000000001',
    categoryId: null,
    stemText: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Stem text' }] }],
    },
    accessScope: 'public',
    questions: [
      {
        questionText: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: "Place 'Yes' if the conclusion does follow." }],
            },
          ],
        },
        questionType: 'syllogism',
        syllogismAnswerPattern: null,
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: [],
        options: SYLLOGISM_IMAGE_PLACEHOLDER_LINES.map((text) => ({
          answerText: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
          },
          answerExplanation: null,
          isAnswer: false,
        })),
      },
    ],
  }

  return { id: 'stem-1', values }
}

describe('bulkImportSyllogismManual', () => {
  it('collects syllogism questions that still have OCR placeholders', () => {
    const targets = collectSyllogismManualEntryTargets([buildSyllogismStemDraft()])
    expect(targets).toHaveLength(1)
    expect(targets[0]?.statements).toEqual(['', '', '', '', ''])
  })

  it('requires all five manual statements before continuing', () => {
    const targets = collectSyllogismManualEntryTargets([buildSyllogismStemDraft()])
    expect(syllogismManualEntryIsComplete(targets)).toBe(false)

    const completeTargets = [
      {
        ...targets[0]!,
        statements: [
          'Statement one',
          'Statement two',
          'Statement three',
          'Statement four',
          'Statement five',
        ],
      },
    ]
    expect(syllogismManualEntryIsComplete(completeTargets)).toBe(true)
  })

  it('applies manual statements onto the parsed stem draft', () => {
    const draft = buildSyllogismStemDraft()
    const targets = collectSyllogismManualEntryTargets([draft])
    const updated = applySyllogismManualEntryTargets([draft], [
      {
        ...targets[0]!,
        statements: [
          'Statement one',
          'Statement two',
          'Statement three',
          'Statement four',
          'Statement five',
        ],
      },
    ])

    expect(updated[0]?.questions[0]?.options.map((option) => option.answerText)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({ text: 'Statement one' }),
              ]),
            }),
          ]),
        }),
      ])
    )
  })
})
