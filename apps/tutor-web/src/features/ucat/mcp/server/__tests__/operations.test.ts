import {
  applyLearningModuleOperations,
  applyMockOperations,
  applyQuestionSetOperations,
  applyQuestionStemOperations,
  blockFromInput,
  learningModuleDraftFromDetail,
  mockDraftFromDetail,
  questionSetDraftFromDetail,
  questionStemDraftFromDetail,
} from '@/features/ucat/mcp/server/operations'

const STEM_ID = '10000000-0000-0000-0000-000000000001'
const QUESTION_ONE = '20000000-0000-0000-0000-000000000001'
const QUESTION_TWO = '20000000-0000-0000-0000-000000000002'
const OPTION_ONE = '30000000-0000-0000-0000-000000000001'
const OPTION_TWO = '30000000-0000-0000-0000-000000000002'
const TAG_ID = '40000000-0000-0000-0000-000000000001'

function stemDetail() {
  return {
    id: STEM_ID,
    section_id: '50000000-0000-0000-0000-000000000001',
    question_stem_category_id: null,
    stem_text: { type: 'doc', content: [] },
    access_scope: 'private',
    tutor_source_note: null,
    questions: [
      {
        id: QUESTION_ONE,
        question_text: { type: 'doc', content: [] },
        answer_explanation: null,
        index: 1,
        difficulty: null,
        time_burden_seconds: null,
        question_type: 'multiple_choice',
        source_channel: 'individual',
        ai_generation_metadata: null,
        tags: [{ id: TAG_ID }],
        answer_options: [
          {
            id: OPTION_ONE,
            answer_text: { type: 'doc', content: [] },
            answer_explanation: null,
            index: 1,
            is_answer: true,
          },
          {
            id: OPTION_TWO,
            answer_text: { type: 'doc', content: [] },
            answer_explanation: null,
            index: 2,
            is_answer: false,
          },
        ],
      },
      {
        id: QUESTION_TWO,
        question_text: { type: 'doc', content: [] },
        answer_explanation: null,
        index: 2,
        difficulty: null,
        time_burden_seconds: null,
        question_type: 'multiple_choice',
        source_channel: 'individual',
        ai_generation_metadata: null,
        tags: [],
        answer_options: [],
      },
    ],
  }
}

describe('UCAT MCP typed operations', () => {
  it('does not remove omitted question-stem children', () => {
    const draft = questionStemDraftFromDetail(stemDetail())
    const updated = applyQuestionStemOperations(draft, [
      {
        type: 'set_metadata',
        tutorSourceNote: 'Keep every nested item',
      },
    ])

    expect(updated.questions.map((question) => question.id)).toEqual([
      QUESTION_ONE,
      QUESTION_TWO,
    ])
    expect(updated.questions[0].answer_options.map((option) => option.id)).toEqual([
      OPTION_ONE,
      OPTION_TWO,
    ])
  })

  it('removes only explicitly targeted nested questions and options', () => {
    const draft = questionStemDraftFromDetail(stemDetail())
    const updated = applyQuestionStemOperations(draft, [
      {
        type: 'remove_answer_option',
        questionId: QUESTION_ONE,
        optionId: OPTION_TWO,
      },
      {
        type: 'remove_question',
        questionId: QUESTION_TWO,
      },
    ])

    expect(updated.questions).toHaveLength(1)
    expect(updated.questions[0].id).toBe(QUESTION_ONE)
    expect(updated.questions[0].answer_options.map((option) => option.id)).toEqual([
      OPTION_ONE,
    ])
  })

  it('applies explicit set and mock membership changes in order', () => {
    const setDraft = questionSetDraftFromDetail({
      name: null,
      description: {},
      time_limit_seconds: null,
      access_scope: 'private',
      stems: [{ stem_id: STEM_ID }, { stem_id: QUESTION_TWO }],
    })
    const updatedSet = applyQuestionSetOperations(setDraft, [
      { type: 'remove_stem', stemId: STEM_ID },
      { type: 'add_stem', stemId: QUESTION_ONE, toIndex: 0 },
    ])
    expect(updatedSet.stemIds).toEqual([QUESTION_ONE, QUESTION_TWO])

    const mockDraft = mockDraftFromDetail({
      name: 'Mock',
      instructions_text: null,
      access_scope: 'private',
      sets: [{ id: STEM_ID }, { id: QUESTION_TWO }],
    })
    const updatedMock = applyMockOperations(mockDraft, [
      { type: 'move_set', setId: QUESTION_TWO, toIndex: 0 },
      { type: 'remove_set', setId: STEM_ID },
    ])
    expect(updatedMock.setIds).toEqual([QUESTION_TWO])
  })

  it('removes only the explicitly targeted lesson block', () => {
    const firstBlock = '60000000-0000-0000-0000-000000000001'
    const secondBlock = '60000000-0000-0000-0000-000000000002'
    const draft = learningModuleDraftFromDetail(
      {
        kind: 'lesson',
        title: 'Lesson',
        description: null,
        ucat_section_id: null,
        parent_ucat_learning_module_id: null,
        index: 0,
        access_scope: 'private',
        icon_key: 'book-open',
        estimated_minutes: null,
        study_plan_priority: 'recommended',
        study_plan_category_ids: [],
        study_plan_tag_ids: [],
      },
      [
        {
          id: firstBlock,
          block_type: 'text',
          index: 0,
          require_completion_before_next: true,
          content: {},
        },
        {
          id: secondBlock,
          block_type: 'video',
          index: 1,
          require_completion_before_next: true,
          content: { url: 'https://example.test/video' },
        },
      ],
    )

    const updated = applyLearningModuleOperations(draft, [
      { type: 'remove_block', blockId: firstBlock },
    ])

    expect(updated.blocks).toHaveLength(1)
    expect(updated.blocks[0].id).toBe(secondBlock)
    expect(updated.blocks[0].index).toBe(0)
  })

  it('normalizes plain text lesson blocks to TipTap/ProseMirror JSON', () => {
    const block = blockFromInput({
      blockType: 'text',
      requireCompletionBeforeNext: true,
      content: { body: 'Use elimination before calculation.' },
    })

    expect(block.content).toEqual({
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Use elimination before calculation.' }],
          },
        ],
      },
    })
  })
})
