import { validateBlocksForSave } from '../block-payload'
import type { DraftBlock } from '../learning-module-editor-types'

function questionStemBlock(content: Record<string, unknown> = {}): DraftBlock {
  return {
    clientId: 'block-1',
    block_type: 'question_stem',
    require_completion_before_next: true,
    content,
    question_stem_id: '11111111-1111-4111-8111-111111111111',
    question_id: null,
    file_id: null,
    skill_trainer_id: null,
  }
}

describe('learning module block payload validation', () => {
  it('allows pending generated stem placeholders in private lesson drafts', () => {
    expect(validateBlocksForSave([questionStemBlock({ pendingGeneratedStem: true })], { isPrivate: true })).toBeNull()
  })

  it('rejects pending generated stem placeholders in public lessons', () => {
    expect(validateBlocksForSave([questionStemBlock({ pendingGeneratedStem: true })], { isPrivate: false }))
      .toContain('pending generated stems can only be saved in private lesson drafts')
  })
})
