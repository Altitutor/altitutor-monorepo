import { validateBlocksForSave } from '../block-payload'
import type { DraftBlock } from '../learning-module-editor-types'
import { buildPendingGeneratedAssessmentContent } from '../pending-generated-assessment'

function questionStemBlock(content: Record<string, unknown> = {}, questionStemId: string | null = '11111111-1111-4111-8111-111111111111'): DraftBlock {
  return {
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
  it('allows pending generated stem placeholders with IDs in private lesson drafts', () => {
    expect(validateBlocksForSave([questionStemBlock({ pendingGeneratedStem: true, generationRunId: 'run-1' })], { isPrivate: true })).toBeNull()
  })

  it('allows run-backed placeholders without IDs in private lesson drafts', () => {
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
        { isPrivate: true },
      ),
    ).toBeNull()
  })

  it('rejects pending generated assessment placeholders in public lessons', () => {
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
        { isPrivate: false },
      ),
    ).toContain('pending generated assessment placeholders can only be saved in private lesson drafts')
  })

  it('still requires IDs for ordinary assessment blocks', () => {
    expect(validateBlocksForSave([questionStemBlock({}, null)], { isPrivate: true })).toContain(
      'select a question stem before saving',
    )
    expect(validateBlocksForSave([questionBlock({}, null)], { isPrivate: true })).toContain(
      'select a question before saving',
    )
  })
})
