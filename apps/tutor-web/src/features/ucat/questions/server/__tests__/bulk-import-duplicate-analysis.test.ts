import {
  analyzeBulkImportDuplicates,
  canonicalDraftRichText,
  findCatalogDuplicateCandidateIds,
  type BulkImportDuplicateCatalogStem,
  type BulkImportDuplicateDraft,
} from '@/features/ucat/questions/server/bulk-import-duplicate-analysis'

const richText = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

function draft(
  id: string,
  stemText: string,
  questionText = 'Which answer is correct?',
): BulkImportDuplicateDraft {
  return {
    id,
    sectionId: '11111111-1111-4111-8111-111111111111',
    stemText: richText(stemText),
    questions: [
      {
        id: `${id}-question`,
        questionText: richText(questionText),
        responseType: 'multiple_choice', answerScheme: 'single_choice',
        answerExplanation: richText('Explanation'),
        options: [
          {
            id: `${id}-option-a`,
            answerText: richText('Answer A'),
            answerExplanation: richText('Correct'),
            answerKeyValue: 'correct',
          },
          {
            id: `${id}-option-b`,
            answerText: richText('Answer B'),
            answerExplanation: richText('Incorrect'),
            answerKeyValue: null,
          },
        ],
      },
    ],
  }
}

function catalog(
  id: string,
  stemText: string,
  questionText = 'Which answer is correct?',
): BulkImportDuplicateCatalogStem {
  const source = draft('source', stemText, questionText)
  return {
    id,
    sectionId: source.sectionId,
    status: 'published',
    stemText: source.stemText,
    stemComparisonText: canonicalDraftRichText(source.stemText),
    questionSearchText: canonicalDraftRichText(source.questions[0].questionText),
    answerOptionSearchText: source.questions[0].options
      .map((option) => canonicalDraftRichText(option.answerText))
      .join(' '),
    questions: [
      {
        id: 'persisted-question',
        index: 0,
        question_text: source.questions[0].questionText,
        response_type: 'multiple_choice',
        answer_scheme: 'single_choice',
        answer_explanation: source.questions[0].answerExplanation,
        answer_options: source.questions[0].options.map((option, index) => ({
          id: `persisted-option-${index}`,
          index,
          answer_text: option.answerText,
          answer_explanation: option.answerExplanation,
          answer_key_value: option.answerKeyValue,
        })),
      },
    ],
  }
}

describe('bulk import duplicate analysis', () => {
  it('distinguishes a complete duplicate from a shared-stem match', () => {
    const stemText = 'A clinic audited patient waiting times across four departments.'
    const exact = analyzeBulkImportDuplicates(
      [draft('draft-exact', stemText)],
      [catalog('catalog-exact', stemText)],
    )
    const shared = analyzeBulkImportDuplicates(
      [draft('draft-shared', stemText, 'What was the median waiting time?')],
      [catalog('catalog-shared', stemText)],
    )

    expect(exact).toHaveLength(1)
    expect(exact[0].kind).toBe('exact_duplicate')
    expect(exact[0].match.source).toBe('catalog')
    expect(exact[0].draft.questions).toEqual([
      expect.objectContaining({ id: 'draft-exact-question', questionIndex: 0 }),
    ])
    expect(exact[0].draft.questions[0].options).toHaveLength(2)
    expect(shared).toHaveLength(1)
    expect(shared[0].kind).toBe('shared_stem')
  })

  it('finds strict possible near-copies without overstating them as exact', () => {
    const original =
      'A community shuttle charges a booking fee of $42 plus $0.68 per kilometre travelled. A journey costs $178 in total, and the booking fee is waived on Sundays.'
    const changed =
      'A community shuttle charges a booking fee of $42 plus $0.68 per kilometre travelled. A journey costs $180 in total, and the booking fee is waived on Sundays.'
    const findings = analyzeBulkImportDuplicates(
      [draft('draft-near', changed, 'What is the charge for a 200 kilometre journey on Sunday?')],
      [catalog('catalog-near', original, 'What is the charge for a 200 kilometre journey on Sunday?')],
    )

    expect(findings).toHaveLength(1)
    expect(findings[0].kind).toBe('possible_near_copy')
    expect(findings[0].similarity?.isNearCopy).toBe(true)
    expect(
      Math.max(
        findings[0].similarity?.tokenRatio ?? 0,
        findings[0].similarity?.trigramRatio ?? 0,
      ),
    ).toBeGreaterThanOrEqual(0.9)
  })

  it('detects duplicate pairs inside the current import batch only once', () => {
    const stemText = 'The passage describes a long-running study of coastal erosion.'
    const findings = analyzeBulkImportDuplicates(
      [
        draft('draft-a', stemText),
        draft('draft-b', stemText),
        { ...draft('other-section', stemText), sectionId: '22222222-2222-4222-8222-222222222222' },
      ],
      [],
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      kind: 'exact_duplicate',
      draft: { stemId: 'draft-a' },
      match: { source: 'draft', stemId: 'draft-b' },
    })
  })

  it('retains media identity when canonicalising image-only stems', () => {
    const imageStem = (fileId: string) => ({
      type: 'doc',
      content: [{ type: 'image', attrs: { fileId } }],
    })

    expect(canonicalDraftRichText(imageStem('file-a'))).toBe('|media:file-a')
    expect(canonicalDraftRichText(imageStem('file-a'))).not.toBe(
      canonicalDraftRichText(imageStem('file-b')),
    )
  })

  it('hydrates only exact or strict near-copy catalog candidates', () => {
    const source = draft(
      'draft-candidate',
      'A ferry office sells day passes for $29 and charges $0.45 per kilometre after the first 12 kilometres. A passenger travels 80 kilometres and pays $59.60 in total.',
    )
    const exact = catalog('exact', canonicalDraftRichText(source.stemText))
    exact.stemText = source.stemText
    exact.stemComparisonText = canonicalDraftRichText(source.stemText)
    const unrelated = catalog(
      'unrelated',
      'A short passage considers whether a museum should extend its opening hours.',
    )

    expect(findCatalogDuplicateCandidateIds([source], [exact, unrelated])).toEqual(['exact'])
  })
})
