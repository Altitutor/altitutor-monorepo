import {
  analyzeBulkImportDuplicatesFromCatalog,
  buildBulkImportDuplicateFindings,
  type BulkImportDuplicateCatalogStem,
  type BulkImportDuplicateDraft,
} from '@/features/ucat/questions/server/bulk-import-duplicate-analysis'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

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
  it('retains matching failure while recording only the failed phase and draft count', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const client = {
        rpc: jest.fn().mockResolvedValue({ data: null, error: { code: '57014', message: 'original timeout' } }),
      } as unknown as SupabaseClient<Database>
      await expect(analyzeBulkImportDuplicatesFromCatalog(client, [draft('private-id', 'private-content')])).rejects.toThrow('original timeout')
      expect(log).toHaveBeenCalledWith('[DEBUG-ucat-rpc-v1]', expect.objectContaining({
        operation: 'bulk_import_match', stems: 1, code: '57014', outcome: 'returned_error',
      }))
      expect(JSON.stringify(log.mock.calls)).not.toContain('private')
    } finally {
      log.mockRestore()
    }
  })
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
