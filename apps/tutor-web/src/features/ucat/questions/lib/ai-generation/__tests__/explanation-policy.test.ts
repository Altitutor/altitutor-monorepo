import {
  buildUcatExplanationPolicy,
  UCAT_EXPLANATION_POLICY_PROMPT,
} from '../explanation-rubric'

describe('buildUcatExplanationPolicy', () => {
  it('selects concise or structured QR presentation according to the reasoning', () => {
    const policy = buildUcatExplanationPolicy({
      sectionName: 'Quantitative Reasoning',
      questionType: 'multiple_choice',
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
      questionType: 'multiple_choice',
    })

    expect(policy).toContain('specific passage evidence')
    expect(policy).toContain('paragraph number')
    expect(policy).not.toContain('multiple dependent operations')
    expect(policy).not.toContain('calculator')
  })

  it('provides a conditional all-section policy for workflows without a fixed section', () => {
    expect(UCAT_EXPLANATION_POLICY_PROMPT).toContain('Decision Making explanations')
    expect(UCAT_EXPLANATION_POLICY_PROMPT).toContain('Quantitative Reasoning explanations')
    expect(UCAT_EXPLANATION_POLICY_PROMPT).toContain('Verbal Reasoning explanations')
    expect(UCAT_EXPLANATION_POLICY_PROMPT).toContain('Situational Judgement explanations')
  })
})
