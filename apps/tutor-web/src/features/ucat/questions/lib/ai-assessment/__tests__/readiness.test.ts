import { evaluateUcatReadiness } from '@/features/ucat/questions/lib/ai-assessment/readiness'
import type { UcatAssessmentSnapshot } from '@/features/ucat/questions/lib/ai-assessment/schema'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

const QUESTION_ID = '00000000-0000-0000-0000-000000000010'
const PLACEMENT_INSTRUCTION =
  "Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow."

function baseSnapshot(): UcatAssessmentSnapshot {
  return {
    stemId: '00000000-0000-0000-0000-000000000001',
    status: 'in_review',
    sectionId: '00000000-0000-0000-0000-000000000002',
    sectionName: 'Decision Making',
    sectionNumber: 2,
    displayColumns: 1,
    categoryId: '00000000-0000-0000-0000-000000000003',
    categoryName: 'Logical Puzzles',
    accessScope: 'public',
    stemText: plainTextToProseMirror('A compact decision-making stem.'),
    stemTextPlain: 'A compact decision-making stem.',
    images: [],
    questions: [],
  }
}

function mcQuestion(): UcatAssessmentSnapshot['questions'][number] {
  return {
    id: QUESTION_ID,
    index: 1,
    questionText: plainTextToProseMirror('Which conclusion follows?'),
    questionTextPlain: 'Which conclusion follows?',
    answerExplanation: plainTextToProseMirror('A complete teaching explanation.'),
    answerExplanationPlain: 'A complete teaching explanation.',
    responseType: 'multiple_choice',
    answerScheme: 'single_choice',
    difficulty: 0.4,
    timeBurdenSeconds: 80,
    tagIds: [],
    tagNames: [],
    images: [],
    options: Array.from({ length: 4 }, (_, optionIndex) => ({
      id: `00000000-0000-0000-0000-${String(optionIndex + 1).padStart(12, '0')}`,
      index: optionIndex,
      answerText: plainTextToProseMirror(`Option ${optionIndex + 1}`),
      answerTextPlain: `Option ${optionIndex + 1}`,
      answerExplanation: null,
      answerExplanationPlain: '',
      answerKeyValue: optionIndex === 0 ? 'correct' as const : null,
      images: [],
    })),
  }
}

function placementQuestion(): UcatAssessmentSnapshot['questions'][number] {
  return {
    ...mcQuestion(),
    questionText: plainTextToProseMirror(PLACEMENT_INSTRUCTION),
    questionTextPlain: PLACEMENT_INSTRUCTION,
    answerExplanation: null,
    answerExplanationPlain: '',
    responseType: 'drag_and_drop',
    answerScheme: 'decision_making_binary_placement',
    options: Array.from({ length: 5 }, (_, optionIndex) => ({
      id: `00000000-0000-0000-0000-${String(optionIndex + 1).padStart(12, '0')}`,
      index: optionIndex,
      answerText: plainTextToProseMirror(`Conclusion ${optionIndex + 1}`),
      answerTextPlain: `Conclusion ${optionIndex + 1}`,
      answerExplanation: plainTextToProseMirror(`Why statement ${optionIndex + 1} is Yes or No.`),
      answerExplanationPlain: `Why statement ${optionIndex + 1} is Yes or No.`,
      answerKeyValue: optionIndex % 2 === 0 ? 'yes' as const : 'no' as const,
      images: [],
    })),
  }
}

function mostLeastQuestion(): UcatAssessmentSnapshot['questions'][number] {
  return {
    ...mcQuestion(),
    questionText: plainTextToProseMirror('Place the most and least appropriate actions.'),
    questionTextPlain: 'Place the most and least appropriate actions.',
    responseType: 'drag_and_drop',
    answerScheme: 'situational_judgement_most_least',
    options: ['Reassure the patient', 'Escalate immediately', 'Ignore the concern'].map((label, optionIndex) => ({
      id: `00000000-0000-0000-0000-${String(optionIndex + 1).padStart(12, '0')}`,
      index: optionIndex,
      answerText: plainTextToProseMirror(label),
      answerTextPlain: label,
      answerExplanation: null,
      answerExplanationPlain: '',
      answerKeyValue: optionIndex === 0 ? 'most' as const : optionIndex === 1 ? 'least' as const : null,
      images: [],
    })),
  }
}

describe('evaluateUcatReadiness', () => {
  it('accepts Interpreting Information stored as binary placement', () => {
    const snapshot = baseSnapshot()
    snapshot.categoryName = 'Interpreting Information and Drawing Conclusions'
    snapshot.questions = [placementQuestion()]

    expect(evaluateUcatReadiness(snapshot).map((check) => check.code)).toEqual([])
  })

  it('accepts Interpreting Information stored as multiple choice', () => {
    const snapshot = baseSnapshot()
    snapshot.categoryName = 'Interpreting Information and Drawing Conclusions'
    snapshot.questions = [mcQuestion()]

    expect(evaluateUcatReadiness(snapshot).map((check) => check.code)).toEqual([])
  })

  it('does not require non-syllogism Decision Making items to be multiple choice', () => {
    const snapshot = baseSnapshot()
    snapshot.categoryName = 'Logical Puzzles'
    snapshot.questions = [placementQuestion()]

    const checks = evaluateUcatReadiness(snapshot)
    expect(checks.map((check) => check.code)).not.toContain('dm_response_type')
    expect(checks.map((check) => check.message).join(' ')).not.toMatch(/multiple-choice/i)
  })

  it('checks Decision Making response contracts without coupling them to category', () => {
    const snapshot = baseSnapshot()
    snapshot.categoryName = 'Interpreting Information and Drawing Conclusions'
    snapshot.questions = [{
      ...placementQuestion(),
      answerScheme: 'single_choice',
    }]

    expect(evaluateUcatReadiness(snapshot)).toContainEqual(expect.objectContaining({
      code: 'dm_placement_answer_scheme',
      severity: 'error',
    }))
    expect(evaluateUcatReadiness(snapshot).map((check) => check.code)).not.toContain('dm_response_type')
  })

  it('names binary-placement structure checks after the answer scheme', () => {
    const snapshot = baseSnapshot()
    snapshot.categoryName = 'Interpreting Information and Drawing Conclusions'
    const question = placementQuestion()
    question.options = question.options.slice(0, 2)
    question.options[1]!.answerExplanationPlain = ''
    snapshot.questions = [question]

    const codes = evaluateUcatReadiness(snapshot).map((check) => check.code)
    expect(codes).toEqual(expect.arrayContaining([
      'dm_placement_option_count',
      'missing_placement_option_explanation',
    ]))
    expect(codes).not.toEqual(expect.arrayContaining([
      'syllogism_option_count',
      'missing_syllogism_option_explanation',
    ]))
  })

  it('accepts Most/Least Appropriate as a drag-and-drop stem', () => {
    const snapshot = baseSnapshot()
    snapshot.sectionName = 'Situational Judgement'
    snapshot.sectionNumber = 4
    snapshot.categoryName = 'Most/Least Appropriate'
    snapshot.questions = [mostLeastQuestion()]

    expect(evaluateUcatReadiness(snapshot).map((check) => check.code)).toEqual([])
  })

  it('does not force Most/Least Appropriate questions onto a multiple-choice response', () => {
    const snapshot = baseSnapshot()
    snapshot.sectionName = 'Situational Judgement'
    snapshot.sectionNumber = 4
    snapshot.categoryName = 'Most/Least Appropriate'
    snapshot.questions = [mostLeastQuestion()]

    const checks = evaluateUcatReadiness(snapshot)
    expect(checks.map((check) => check.code)).not.toContain('sj_response_type')
    expect(checks.map((check) => check.code)).not.toContain('sjt_category')
  })
})
