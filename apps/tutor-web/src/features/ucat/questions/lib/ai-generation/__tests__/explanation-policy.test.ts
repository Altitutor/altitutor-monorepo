import {
  buildUcatExplanationPolicy,
  UCAT_EXPLANATION_POLICY_PROMPT,
} from '../explanation-rubric'

describe('buildUcatExplanationPolicy', () => {
  it('selects concise or structured QR presentation according to the reasoning', () => {
    const policy = buildUcatExplanationPolicy({
      sectionName: 'Quantitative Reasoning',
      responseType: 'multiple_choice',
    })

    expect(policy).toContain('shortest efficient method')
    expect(policy).toContain('one direct calculation')
    expect(policy).toContain('ordered steps with short titles')
    expect(policy).toContain('multiple dependent operations')
    expect(policy).toContain('calculator')
    expect(policy).toContain('\\(...\\)')
    expect(policy).toContain('\\[...\\]')
    expect(policy).not.toContain('Verbal Reasoning explanations')
    expect(policy).not.toContain('two to five short, titled or numbered steps')
  })

  it('keeps VR evidence-led without applying the QR presentation rule', () => {
    const policy = buildUcatExplanationPolicy({
      sectionName: 'Verbal Reasoning',
      responseType: 'multiple_choice',
    })

    expect(policy).toContain('specific passage evidence')
    expect(policy).toContain('paragraph number')
    expect(policy).not.toContain('multiple dependent operations')
    expect(policy).not.toContain('calculator')
  })

  it('encourages option-level explanations for multiple choice unless they would only repeat', () => {
    const policy = buildUcatExplanationPolicy({ responseType: 'multiple_choice' })

    expect(policy).toContain('Also provide option-level explanations for answer choices whenever they add distinct teaching')
    expect(policy).toContain('Omit an option-level explanation only when it would merely repeat')
    expect(policy).not.toContain('Include an option-level explanation only when')
  })

  it('uses drag_and_drop response wording', () => {
    const byResponse = buildUcatExplanationPolicy({ responseType: 'drag_and_drop' })

    expect(byResponse).toContain('For drag_and_drop')
    expect(byResponse).toContain('Add a question-level explanation when it is appropriate')
    expect(byResponse).not.toContain('Include a question-level explanation only when')
    expect(byResponse).not.toContain('For syllogism')
  })

  it('provides a conditional all-section policy for workflows without a fixed section', () => {
    expect(UCAT_EXPLANATION_POLICY_PROMPT).toContain('Decision Making explanations')
    expect(UCAT_EXPLANATION_POLICY_PROMPT).toContain('Quantitative Reasoning explanations')
    expect(UCAT_EXPLANATION_POLICY_PROMPT).toContain('Verbal Reasoning explanations')
    expect(UCAT_EXPLANATION_POLICY_PROMPT).toContain('Situational Judgement explanations')
    expect(UCAT_EXPLANATION_POLICY_PROMPT).toContain('For drag_and_drop')
    expect(UCAT_EXPLANATION_POLICY_PROMPT).not.toContain('For syllogism')
  })
})
