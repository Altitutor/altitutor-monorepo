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
  toRichTextJson,
  toStemRpcQuestions,
} from '@/features/ucat/mcp/server/operations'

const STEM_ID = '10000000-0000-0000-0000-000000000001'
const QUESTION_ONE = '20000000-0000-0000-0000-000000000001'
const QUESTION_TWO = '20000000-0000-0000-0000-000000000002'
const OPTION_ONE = '30000000-0000-0000-0000-000000000001'
const OPTION_TWO = '30000000-0000-0000-0000-000000000002'
const TAG_ID = '40000000-0000-0000-0000-000000000001'
const BLUEPRINT_ID = '70000000-0000-0000-0000-000000000001'

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
        response_type: 'multiple_choice',
        answer_scheme: 'single_choice',
        source_channel: 'individual',
        ai_generation_metadata: null,
        tags: [{ id: TAG_ID }],
        answer_options: [
          {
            id: OPTION_ONE,
            answer_text: { type: 'doc', content: [] },
            answer_explanation: null,
            index: 1,
            answer_key_value: 'correct',
          },
          {
            id: OPTION_TWO,
            answer_text: { type: 'doc', content: [] },
            answer_explanation: null,
            index: 2,
            answer_key_value: null,
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
        response_type: 'multiple_choice',
        answer_scheme: 'single_choice',
        source_channel: 'individual',
        ai_generation_metadata: null,
        tags: [],
        answer_options: [],
      },
    ],
  }
}

const CANONICAL_RESPONSE_TYPES = new Set(['multiple_choice', 'drag_and_drop'])
const CANONICAL_ANSWER_SCHEMES = new Set([
  'single_choice',
  'situational_judgement_rating',
  'decision_making_binary_placement',
  'situational_judgement_most_least',
])
const CANONICAL_ANSWER_KEYS = new Set(['correct', 'yes', 'no', 'most', 'least'])

function canonicalResponseContractViolations(questions: unknown): string[] {
  if (!Array.isArray(questions)) return ['questions_not_array']
  const violations: string[] = []
  questions.forEach((question, questionIndex) => {
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      violations.push(`question[${questionIndex}] is not an object`)
      return
    }
    const record = question as Record<string, unknown>
    if (!('response_type' in record) || record.response_type == null) {
      violations.push(`question[${questionIndex}] missing response_type`)
    } else if (
      typeof record.response_type !== 'string'
      || !CANONICAL_RESPONSE_TYPES.has(record.response_type)
    ) {
      violations.push(`question[${questionIndex}] invalid response_type`)
    }
    if (!('answer_scheme' in record) || record.answer_scheme == null) {
      violations.push(`question[${questionIndex}] missing answer_scheme`)
    } else if (
      typeof record.answer_scheme !== 'string'
      || !CANONICAL_ANSWER_SCHEMES.has(record.answer_scheme)
    ) {
      violations.push(`question[${questionIndex}] invalid answer_scheme`)
    }
    if (!Array.isArray(record.answer_options)) {
      violations.push(`question[${questionIndex}] answer_options is not an array`)
      return
    }
    record.answer_options.forEach((option, optionIndex) => {
      if (!option || typeof option !== 'object' || Array.isArray(option)) {
        violations.push(`question[${questionIndex}].option[${optionIndex}] is not an object`)
        return
      }
      const optionRecord = option as Record<string, unknown>
      if (!('answer_key_value' in optionRecord)) {
        violations.push(
          `question[${questionIndex}].option[${optionIndex}] missing answer_key_value`,
        )
      } else if (
        optionRecord.answer_key_value != null
        && (
          typeof optionRecord.answer_key_value !== 'string'
          || !CANONICAL_ANSWER_KEYS.has(optionRecord.answer_key_value)
        )
      ) {
        violations.push(
          `question[${questionIndex}].option[${optionIndex}] invalid answer_key_value`,
        )
      }
    })
  })
  return violations
}

describe('UCAT MCP typed operations', () => {
  it('emits a canonical response contract when updating only an explanation', () => {
    const updated = applyQuestionStemOperations(questionStemDraftFromDetail(stemDetail()), [{
      type: 'update_question',
      questionId: QUESTION_ONE,
      changes: { answerExplanation: 'Option A is the only supported conclusion.' },
    }])
    const payload = JSON.parse(JSON.stringify(toStemRpcQuestions(updated)))

    expect(canonicalResponseContractViolations(payload)).toEqual([])
    expect(payload[0]).toMatchObject({
      response_type: 'multiple_choice',
      answer_scheme: 'single_choice',
      answer_options: [
        { answer_key_value: 'correct' },
        { answer_key_value: null },
      ],
    })
    expect(Object.prototype.hasOwnProperty.call(payload[0].answer_options[1], 'answer_key_value')).toBe(true)
  })

  it('emits a canonical response contract when updating a binary-placement option explanation', () => {
    const updated = applyQuestionStemOperations(questionStemDraftFromDetail({
      ...stemDetail(),
      questions: [{
        id: QUESTION_ONE,
        question_text: { type: 'doc', content: [] },
        answer_explanation: null,
        index: 1,
        difficulty: null,
        time_burden_seconds: null,
        response_type: 'drag_and_drop',
        answer_scheme: 'decision_making_binary_placement',
        source_channel: 'individual',
        ai_generation_metadata: null,
        tags: [],
        answer_options: [
          {
            id: OPTION_ONE,
            answer_text: { type: 'doc', content: [] },
            answer_explanation: null,
            index: 1,
            answer_key_value: 'yes',
          },
          {
            id: OPTION_TWO,
            answer_text: { type: 'doc', content: [] },
            answer_explanation: null,
            index: 2,
            answer_key_value: 'no',
          },
        ],
      }],
    }), [{
      type: 'update_answer_option',
      questionId: QUESTION_ONE,
      optionId: OPTION_ONE,
      changes: { answerExplanation: 'This conclusion follows from the two premises.' },
    }])
    const payload = JSON.parse(JSON.stringify(toStemRpcQuestions(updated)))

    expect(canonicalResponseContractViolations(payload)).toEqual([])
    expect(payload[0]).toMatchObject({
      response_type: 'drag_and_drop',
      answer_scheme: 'decision_making_binary_placement',
      answer_options: [
        { answer_key_value: 'yes' },
        { answer_key_value: 'no' },
      ],
    })
  })

  it('carries the canonical response contract through an add-question operation', () => {
    const draft = questionStemDraftFromDetail(stemDetail())
    const updated = applyQuestionStemOperations(draft, [{
      type: 'add_question',
      question: {
        questionText: 'Place each conclusion as Yes or No.',
        responseType: 'drag_and_drop',
        answerScheme: 'decision_making_binary_placement',
        tagIds: [],
        options: Array.from({ length: 5 }, (_, index) => ({
          answerText: `Conclusion ${index + 1}`,
          answerKeyValue: index < 2 ? 'yes' as const : 'no' as const,
        })),
      },
    }])

    expect(updated.questions.at(-1)).toMatchObject({
      response_type: 'drag_and_drop',
      answer_scheme: 'decision_making_binary_placement',
      answer_options: [
        { answer_key_value: 'yes' },
        { answer_key_value: 'yes' },
        { answer_key_value: 'no' },
        { answer_key_value: 'no' },
        { answer_key_value: 'no' },
      ],
    })
  })

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
      authoring_note: null,
      description: {},
      time_limit_seconds: null,
      timing_mode: 'untimed',
      pace_multiplier: null,
      fixed_time_limit_seconds: null,
      set_format: 'partial_section',
      reference_blueprint_id: BLUEPRINT_ID,
      access_scope: 'private',
      section_id: '50000000-0000-0000-0000-000000000001',
      stems: [{ stem_id: STEM_ID }, { stem_id: QUESTION_TWO }],
    })
    const updatedSet = applyQuestionSetOperations(setDraft, [
      { type: 'remove_stem', stemId: STEM_ID },
      { type: 'add_stem', stemId: QUESTION_ONE, toIndex: 0 },
    ])
    expect(updatedSet.stemIds).toEqual([QUESTION_ONE, QUESTION_TWO])
    expect(updatedSet.sectionId).toBe('50000000-0000-0000-0000-000000000001')

    const emptySet = questionSetDraftFromDetail({
      name: null,
      authoring_note: null,
      description: {},
      time_limit_seconds: null,
      timing_mode: 'untimed',
      pace_multiplier: null,
      fixed_time_limit_seconds: null,
      set_format: 'partial_section',
      reference_blueprint_id: BLUEPRINT_ID,
      access_scope: 'private',
      section_id: '50000000-0000-0000-0000-000000000001',
      stems: [],
    })
    const retargeted = applyQuestionSetOperations(emptySet, [
      { type: 'set_metadata', sectionId: '50000000-0000-0000-0000-000000000002' },
    ])
    expect(retargeted.sectionId).toBe('50000000-0000-0000-0000-000000000002')

    const mockDraft = mockDraftFromDetail({
      name: 'Mock',
      authoring_note: null,
      instructions_text: null,
      access_scope: 'private',
      blueprint_id: BLUEPRINT_ID,
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

  it('normalizes Markdown lesson blocks to structured TipTap/ProseMirror JSON', () => {
    const block = blockFromInput({
      blockType: 'text',
      requireCompletionBeforeNext: true,
      content: {
        body: {
          format: 'markdown',
          value: '## Strategy\n\n- Eliminate impossible answers\n- Estimate before calculating',
        },
      },
    })

    expect(block.content.body).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
        },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem' },
            { type: 'listItem' },
          ],
        },
      ],
    })
  })

  it('normalizes model-authored Markdown strings instead of storing visible syntax', () => {
    expect(toRichTextJson('The result is **0% (D)**.')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'The result is ' },
            { type: 'text', text: '0% (D)', marks: [{ type: 'bold' }] },
            { type: 'text', text: '.' },
          ],
        },
      ],
    })
  })

  it('rejects native rich text that would display formatting source literally', () => {
    expect(() => toRichTextJson({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'The result is **0% (D)**.' }],
        },
      ],
    })).toThrow('unparsed formatting syntax (markdown_emphasis)')
  })
})
