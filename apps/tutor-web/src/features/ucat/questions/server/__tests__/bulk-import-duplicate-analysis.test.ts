import {
  buildBulkImportDuplicateFindings,
  type BulkImportDuplicateCatalogStem,
  type BulkImportDuplicateDraft,
} from '@/features/ucat/questions/server/bulk-import-duplicate-analysis'

const richText = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

function draft(id: string, stemText: string): BulkImportDuplicateDraft {
  return {
    id,
    sectionId: '11111111-1111-4111-8111-111111111111',
    stemText: richText(stemText),
    questions: [{
      id: `${id}-question`,
      questionText: richText('Which answer is correct?'),
      responseType: 'multiple_choice',
      answerScheme: 'single_choice',
      answerExplanation: richText('Explanation'),
      options: [{
        id: `${id}-option`,
        answerText: richText('Answer A'),
        answerExplanation: richText('Correct'),
        answerKeyValue: 'correct',
      }],
    }],
  }
}

function catalog(id: string, stemText: string): BulkImportDuplicateCatalogStem {
  return {
    id,
    sectionId: '11111111-1111-4111-8111-111111111111',
    status: 'published',
    stemText: richText(stemText),
    questions: [{
      id: `${id}-question`,
      index: 0,
      question_text: richText('A different saved question'),
      response_type: 'multiple_choice',
      answer_scheme: 'single_choice',
      answer_options: [],
    }],
  }
}

describe('bulk import duplicate finding hydration', () => {
  it('hydrates a database stem-similarity match without classifying question content', () => {
    const imported = draft('draft-a', 'The imported stem')
    const saved = catalog('catalog-a', 'The saved stem')

    const findings = buildBulkImportDuplicateFindings(
      [imported],
      [saved],
      [{
        draftId: imported.id,
        matchSource: 'catalog',
        matchStemId: saved.id,
        similarity: 0.9632,
      }],
    )

    expect(findings).toEqual([expect.objectContaining({
      id: 'draft-a:catalog:catalog-a',
      similarity: 0.9632,
      draft: expect.objectContaining({ source: 'draft', stemId: 'draft-a' }),
      match: expect.objectContaining({ source: 'catalog', stemId: 'catalog-a' }),
    })])
  })

  it('hydrates one within-import pair in the order returned by the matcher', () => {
    const left = draft('draft-left', 'The same stem')
    const right = draft('draft-right', 'The same stem')

    const findings = buildBulkImportDuplicateFindings(
      [left, right],
      [],
      [{
        draftId: left.id,
        matchSource: 'draft',
        matchStemId: right.id,
        similarity: 1,
      }],
    )

    expect(findings).toEqual([expect.objectContaining({
      id: 'draft-left:draft:draft-right',
      similarity: 1,
      draft: expect.objectContaining({ stemId: 'draft-left' }),
      match: expect.objectContaining({ source: 'draft', stemId: 'draft-right' }),
    })])
  })

  it('drops matches whose detail can no longer be hydrated', () => {
    expect(buildBulkImportDuplicateFindings(
      [draft('draft-a', 'An imported stem')],
      [],
      [{
        draftId: 'draft-a',
        matchSource: 'catalog',
        matchStemId: 'deleted-catalog-stem',
        similarity: 1,
      }],
    )).toEqual([])
  })
})
