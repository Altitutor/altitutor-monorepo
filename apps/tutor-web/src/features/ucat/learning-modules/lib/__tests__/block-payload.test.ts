import { toBlockPayload, validateBlocksForSave } from '../block-payload'
import type { DraftBlock } from '../learning-module-editor-types'
import { buildPendingGeneratedAssessmentContent } from '../pending-generated-assessment'

function questionStemBlock(content: Record<string, unknown> = {}, questionStemId: string | null = '11111111-1111-4111-8111-111111111111'): DraftBlock {
  return {
    id: null,
    clientId: 'block-1',
    block_type: 'question_stem',
    require_completion_before_next: true,
    content,
    question_stem_id: questionStemId,
    question_id: null,
    file_id: null,
    skill_trainer_id: null,
  }
}

function questionBlock(content: Record<string, unknown> = {}, questionId: string | null = '22222222-2222-4222-8222-222222222222'): DraftBlock {
  return {
    id: null,
    clientId: 'block-2',
    block_type: 'question',
    require_completion_before_next: true,
    content,
    question_stem_id: null,
    question_id: questionId,
    file_id: null,
    skill_trainer_id: null,
  }
}

describe('learning module block payload validation', () => {
  it('preserves existing block IDs and omits IDs for new blocks', () => {
    const existing = questionStemBlock()
    existing.id = '33333333-3333-4333-8333-333333333333'
    const created = questionBlock()

    const payload = toBlockPayload([existing, created])

    expect(payload[0].id).toBe(existing.id)
    expect(payload[1]).not.toHaveProperty('id')
  })

  it('allows pending generated stem placeholders with IDs on unpublished lessons', () => {
    expect(
      validateBlocksForSave(
        [questionStemBlock({ pendingGeneratedStem: true, generationRunId: 'run-1' })],
        { isPublished: false },
      ),
    ).toBeNull()
  })

  it('allows run-backed placeholders without IDs on unpublished lessons', () => {
    expect(
      validateBlocksForSave(
        [
          questionStemBlock(
            buildPendingGeneratedAssessmentContent({
              generationRunId: 'run-1',
              generationBlockIntent: 'question_stem',
            }),
            null,
          ),
          questionBlock(
            buildPendingGeneratedAssessmentContent({
              generationRunId: 'run-2',
              generationBlockIntent: 'question',
            }),
            null,
          ),
        ],
        { isPublished: false },
      ),
    ).toBeNull()
  })

  it('rejects pending generated assessment placeholders on published lessons', () => {
    expect(
      validateBlocksForSave(
        [
          questionStemBlock(
            buildPendingGeneratedAssessmentContent({
              generationRunId: 'run-1',
              generationBlockIntent: 'question_stem',
            }),
          ),
        ],
        { isPublished: true },
      ),
    ).toContain('pending generated assessment placeholders can only be saved on unpublished lessons')
  })

  it('still requires IDs for ordinary assessment blocks', () => {
    expect(validateBlocksForSave([questionStemBlock({}, null)], { isPublished: false })).toContain(
      'select a question stem before saving',
    )
    expect(validateBlocksForSave([questionBlock({}, null)], { isPublished: false })).toContain(
      'select a question before saving',
    )
  })
})
