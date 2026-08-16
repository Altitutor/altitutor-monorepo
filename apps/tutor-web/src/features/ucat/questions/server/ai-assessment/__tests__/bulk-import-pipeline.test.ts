import {
  BULK_IMPORT_AI_CALL_OPTIONS,
  automaticBulkAnswerRepairAgreesWithBlind,
  automaticBulkRepairPatchAllowed,
  blindQuestionIdsRequiredForReview,
  chunkBulkImportAuditQuestionIds,
  deriveBulkImportAssessment,
  reconcileBulkImportAiReview,
  runConditionalBulkImportReview,
} from '../bulk-import-pipeline'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

describe('bulk import AI review policy', () => {
  it('bounds six-question audit responses to three questions per concurrent call', () => {
    const questionIds = Array.from({ length: 6 }, (_, index) => `question-${index + 1}`)

    expect(chunkBulkImportAuditQuestionIds(questionIds)).toEqual([
      ['question-1', 'question-2', 'question-3'],
      ['question-4', 'question-5', 'question-6'],
    ])
  })

  it('uses low-reasoning latency budgets for the interactive bulk workflow', () => {
    expect(BULK_IMPORT_AI_CALL_OPTIONS).toEqual({
      blind: expect.objectContaining({ reasoningEffort: 'low', maxCompletionTokens: 3_000 }),
      auditRepair: expect.objectContaining({
        reasoningEffort: 'low',
        maxCompletionTokens: 6_000,
      }),
    })
  })

  it('requests blind verification only for answer discrepancies', () => {
    const questionId = '30000000-0000-4000-8000-000000000001'
    const repair = {
      overallSummary: 'No repairs.',
      repairs: [],
      unresolvedFindings: [],
    }
    expect(blindQuestionIdsRequiredForReview({
      audit: { overallSummary: 'No concerns.', categories: [], findings: [] },
      repair,
    })).toEqual([])
    expect(blindQuestionIdsRequiredForReview({
      audit: {
        overallSummary: 'The answer needs checking.',
        categories: [],
        findings: [{
          key: 'wrong-key',
          scopeType: 'question',
          questionId,
          category: 'answer_correctness_fairness',
          rating: 'concern',
          confidence: 0.9,
          title: 'Check the key',
          detail: 'The keyed answer may be wrong.',
          evidence: [],
          recommendedAction: 'review',
          suggestion: null,
        }],
      },
      repair,
    })).toEqual([questionId])
  })

  it('skips the blind model for an ordinary successful audit', async () => {
    const blindSolve = jest.fn()
    const auditRepair = {
      response: {
        audit: { overallSummary: 'Ready.', categories: [], findings: [] },
        repair: { overallSummary: 'Ready.', repairs: [], unresolvedFindings: [] },
      },
    }

    await expect(runConditionalBulkImportReview({
      auditAndRepair: async () => auditRepair,
      blindSolve,
    })).resolves.toEqual({
      auditRepair,
      blindSolution: null,
      blindQuestionIds: [],
    })
    expect(blindSolve).not.toHaveBeenCalled()
  })

  it('keeps edits that invalidate the blind solve out of the one-click repair path', () => {
    expect(automaticBulkRepairPatchAllowed({
      operation: 'remove_question',
      questionId: '00000000-0000-0000-0000-000000000001',
      beforeQuestionText: 'Question',
    })).toBe(false)
    expect(automaticBulkRepairPatchAllowed({
      operation: 'insert_option',
      questionId: '00000000-0000-0000-0000-000000000001',
      afterOptionId: null,
      option: {
        id: null,
        answerText: 'Distractor',
        answerExplanation: null,
        answerKeyValue: null,
      },
    })).toBe(false)
    expect(automaticBulkRepairPatchAllowed({
      operation: 'replace_option_and_key',
      questionId: '00000000-0000-0000-0000-000000000001',
      optionId: '00000000-0000-0000-0000-000000000002',
      beforeAnswerText: 'Ten',
      answerText: 'Eleven',
      answerExplanation: null,
    })).toBe(false)
    expect(automaticBulkRepairPatchAllowed({
      operation: 'replace_text',
      target: {
        kind: 'question',
        id: '00000000-0000-0000-0000-000000000001',
        field: 'question_text',
      },
      beforeText: 'Which option is correct ?',
      afterText: 'Which option is correct?',
    })).toBe(true)
  })

  it('requires a confident independent blind solve before changing an answer key', () => {
    const patch = {
      operation: 'set_answer_key' as const,
      questionId: '30000000-0000-4000-8000-000000000001',
      currentCorrectOptionId: '40000000-0000-4000-8000-000000000001',
      correctOptionId: '40000000-0000-4000-8000-000000000002',
    }
    const solution = {
      solutions: [{
        questionId: patch.questionId,
        selectedOptionId: patch.correctOptionId,
        confidence: 0.97,
        ambiguous: false,
        unsolvable: false,
        justification: 'The second option follows from the data.',
        placementAnswers: [],
      }],
    }

    expect(automaticBulkAnswerRepairAgreesWithBlind(patch, solution)).toBe(true)
    expect(automaticBulkAnswerRepairAgreesWithBlind(patch, {
      solutions: [{ ...solution.solutions[0], selectedOptionId: patch.currentCorrectOptionId }],
    })).toBe(false)
  })

  it('derives the final assessment from resolved audit keys without another AI assessment', () => {
    const questionId = '30000000-0000-4000-8000-000000000001'
    const audit = {
      overallSummary: 'The explanation is missing.',
      categories: [{
        scopeType: 'question' as const,
        questionId,
        category: 'explanation_quality' as const,
        rating: 'critical' as const,
        confidence: 0.99,
        summary: 'No teaching explanation is provided.',
        evidence: [],
      }],
      findings: [{
        key: 'missing-explanation',
        scopeType: 'question' as const,
        questionId,
        category: 'explanation_quality' as const,
        rating: 'critical' as const,
        confidence: 0.99,
        title: 'Missing explanation',
        detail: 'Add a worked explanation.',
        evidence: [],
        recommendedAction: 'fix' as const,
        suggestion: null,
      }],
    }
    const assessment = deriveBulkImportAssessment({
      audit,
      repair: {
        overallSummary: 'Added a worked explanation.',
        repairs: [{
          summary: 'Add explanation',
          rationale: 'Students need a worked method.',
          confidence: 0.99,
          resolvedFindingKeys: ['missing-explanation'],
          patches: [],
        }],
        unresolvedFindings: [],
      },
    })

    expect(assessment.findings).toEqual([])
    expect(assessment.categories[0]).toEqual(expect.objectContaining({
      rating: 'pass',
      summary: 'Resolved by AI repair: Add explanation',
    }))
  })
})

describe('reconcileBulkImportAiReview', () => {
  it('applies a valid explanation repair while isolating a disputed answer-key repair', async () => {
    const questionId = '30000000-0000-4000-8000-000000000001'
    const firstOptionId = '40000000-0000-4000-8000-000000000001'
    const secondOptionId = '40000000-0000-4000-8000-000000000002'
    const richText = (text: string) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })
    const values: UcatQuestionStemFormValues = {
      sectionId: '10000000-0000-4000-8000-000000000001',
      categoryId: null,
      stemText: richText('Stem'),
      accessScope: 'public',
      questions: [{
        id: questionId,
        questionText: richText('Which option follows?'),
        responseType: 'multiple_choice', answerScheme: 'single_choice',
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: null,
        tagIds: [],
        options: [
          {
            id: firstOptionId,
            answerText: richText('First'),
            answerExplanation: null,
            answerKeyValue: 'correct',
          },
          {
            id: secondOptionId,
            answerText: richText('Second'),
            answerExplanation: null,
            answerKeyValue: null,
          },
        ],
      }],
    }
    const audit = {
      overallSummary: 'The explanation is missing and the key may be wrong.',
      categories: [
        {
          scopeType: 'question' as const,
          questionId,
          category: 'explanation_quality' as const,
          rating: 'critical' as const,
          confidence: 0.99,
          summary: 'No explanation is supplied.',
          evidence: [],
        },
        {
          scopeType: 'question' as const,
          questionId,
          category: 'answer_correctness_fairness' as const,
          rating: 'critical' as const,
          confidence: 0.95,
          summary: 'The second option appears correct.',
          evidence: [],
        },
      ],
      findings: [
        {
          key: 'missing-explanation',
          scopeType: 'question' as const,
          questionId,
          category: 'explanation_quality' as const,
          rating: 'critical' as const,
          confidence: 0.99,
          title: 'Missing explanation',
          detail: 'Add a worked explanation.',
          evidence: [],
          recommendedAction: 'fix' as const,
          suggestion: null,
        },
        {
          key: 'wrong-key',
          scopeType: 'question' as const,
          questionId,
          category: 'answer_correctness_fairness' as const,
          rating: 'critical' as const,
          confidence: 0.95,
          title: 'Answer key may be wrong',
          detail: 'Change the key to the second option.',
          evidence: [],
          recommendedAction: 'fix' as const,
          suggestion: null,
        },
      ],
    }

    const result = await reconcileBulkImportAiReview({
      values,
      blindSolution: {
        solutions: [{
          questionId,
          selectedOptionId: firstOptionId,
          placementAnswers: [],
          justification: 'The first option follows from the stem.',
          confidence: 0.99,
          ambiguous: false,
          unsolvable: false,
        }],
      },
      audit,
      repair: {
        overallSummary: 'Added the explanation and proposed a corrected key.',
        repairs: [
          {
            summary: 'Add explanation',
            rationale: 'Students need a worked method.',
            confidence: 0.99,
            resolvedFindingKeys: ['missing-explanation'],
            patches: [{
              operation: 'set_text',
              target: {
                kind: 'question',
                id: questionId,
                field: 'answer_explanation',
              },
              beforeText: null,
              afterText: 'The first option follows because it is directly supported.',
            }],
          },
          {
            summary: 'Change answer key',
            rationale: 'The audit selected the second option.',
            confidence: 0.95,
            resolvedFindingKeys: ['wrong-key'],
            patches: [{
              operation: 'set_answer_key',
              questionId,
              currentCorrectOptionId: firstOptionId,
              correctOptionId: secondOptionId,
            }],
          },
        ],
        unresolvedFindings: [],
      },
    })

    expect(result.values.questions[0]?.answerExplanation).not.toBeNull()
    expect(result.values.questions[0]?.options.find((option) => option.answerKeyValue === 'correct')?.id)
      .toBe(firstOptionId)
    expect(result.appliedRepairs).toEqual(['Add explanation'])
    expect(result.assessment.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'wrong-key' }),
    ]))
    expect(result.assessment.categories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'answer_correctness_fairness',
        rating: 'pass',
        summary: expect.stringContaining('current answer key'),
      }),
    ]))

    const agreed = await reconcileBulkImportAiReview({
      values,
      blindSolution: {
        solutions: [{
          questionId,
          selectedOptionId: secondOptionId,
          placementAnswers: [],
          justification: 'The second option follows from the stem.',
          confidence: 0.99,
          ambiguous: false,
          unsolvable: false,
        }],
      },
      audit,
      repair: {
        overallSummary: 'Corrected the key.',
        repairs: [{
          summary: 'Change answer key',
          rationale: 'The audit and blind solver selected the second option.',
          confidence: 0.99,
          resolvedFindingKeys: ['wrong-key'],
          patches: [{
            operation: 'set_answer_key',
            questionId,
            currentCorrectOptionId: firstOptionId,
            correctOptionId: secondOptionId,
          }],
        }],
        unresolvedFindings: [],
      },
    })

    expect(agreed.values.questions[0]?.options.find((option) => option.answerKeyValue === 'correct')?.id)
      .toBe(secondOptionId)
    expect(agreed.appliedRepairs).toEqual(['Change answer key'])
    expect(agreed.assessment.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'wrong-key' }),
    ]))
  })

  it('turns a low-confidence repair into an approval instead of failing or applying it', async () => {
    const questionId = '30000000-0000-4000-8000-000000000001'
    const richText = (text: string) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })
    const values: UcatQuestionStemFormValues = {
      sectionId: '10000000-0000-4000-8000-000000000001',
      categoryId: null,
      stemText: richText('Stem'),
      accessScope: 'public',
      questions: [{
        id: questionId,
        questionText: richText('Question'),
        responseType: 'multiple_choice', answerScheme: 'single_choice',
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: null,
        tagIds: [],
        options: [{
          id: '40000000-0000-4000-8000-000000000001',
          answerText: richText('Answer'),
          answerExplanation: null,
          answerKeyValue: 'correct',
        }],
      }],
    }
    const result = await reconcileBulkImportAiReview({
      values,
      blindSolution: { solutions: [] },
      audit: {
        overallSummary: 'An explanation is missing.',
        categories: [],
        findings: [{
          key: 'missing-explanation',
          scopeType: 'question',
          questionId,
          category: 'explanation_quality',
          rating: 'concern',
          confidence: 0.79,
          title: 'Missing explanation',
          detail: 'Add a teaching explanation.',
          evidence: [],
          recommendedAction: 'fix',
          suggestion: null,
        }],
      },
      repair: {
        overallSummary: 'Proposed an explanation.',
        repairs: [{
          summary: 'Add explanation',
          rationale: 'Students need a worked method.',
          confidence: 0.79,
          resolvedFindingKeys: ['missing-explanation'],
          patches: [{
            operation: 'set_text',
            target: { kind: 'question', id: questionId, field: 'answer_explanation' },
            beforeText: null,
            afterText: 'Start by identifying what the question asks, then test each option.',
          }],
        }],
        unresolvedFindings: [],
      },
    })

    expect(result.values.questions[0]?.answerExplanation).toBeNull()
    expect(result.appliedRepairs).toEqual([])
    expect(result.assessment.findings[0]).toEqual(expect.objectContaining({
      key: 'missing-explanation',
      detail: expect.stringContaining('79%'),
      suggestion: expect.objectContaining({ application: 'approval_required' }),
    }))
  })

  it('applies a semantic repair after a targeted blind solve verifies the repaired question', async () => {
    const questionId = '30000000-0000-4000-8000-000000000001'
    const correctOptionId = '40000000-0000-4000-8000-000000000001'
    const richText = (text: string) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })
    const values: UcatQuestionStemFormValues = {
      sectionId: '10000000-0000-4000-8000-000000000001',
      categoryId: null,
      stemText: richText('Stem'),
      accessScope: 'public',
      questions: [{
        id: questionId,
        questionText: richText('Which option follows?'),
        responseType: 'multiple_choice', answerScheme: 'single_choice',
        answerExplanation: richText('The first option follows.'),
        difficulty: null,
        timeBurdenSeconds: null,
        tagIds: [],
        options: [
          {
            id: correctOptionId,
            answerText: richText('First'),
            answerExplanation: null,
            answerKeyValue: 'correct',
          },
          {
            id: '40000000-0000-4000-8000-000000000002',
            answerText: richText('Second'),
            answerExplanation: null,
            answerKeyValue: null,
          },
        ],
      }],
    }
    const verifySemanticRepair = jest.fn(async () => {
      throw new Error('A second blind solve should not run')
    })

    const result = await reconcileBulkImportAiReview({
      values,
      blindSolution: {
        solutions: [{
          questionId,
          selectedOptionId: correctOptionId,
          placementAnswers: [],
          justification: 'The first option follows.',
          confidence: 0.99,
          ambiguous: false,
          unsolvable: false,
        }],
      },
      preverifiedSemanticBlindSolution: {
        solutions: [{
          questionId,
          selectedOptionId: correctOptionId,
          placementAnswers: [],
          justification: 'The first option still necessarily follows.',
          confidence: 0.99,
          ambiguous: false,
          unsolvable: false,
        }],
      },
      audit: {
        overallSummary: 'The question wording is imprecise.',
        categories: [{
          scopeType: 'question',
          questionId,
          category: 'presentation_integrity',
          rating: 'concern',
          confidence: 0.98,
          summary: 'The wording should require the strongest conclusion.',
          evidence: [],
        }],
        findings: [{
          key: 'imprecise-wording',
          scopeType: 'question',
          questionId,
          category: 'presentation_integrity',
          rating: 'concern',
          confidence: 0.98,
          title: 'Imprecise wording',
          detail: 'Change “follows” to “must follow”.',
          evidence: [],
          recommendedAction: 'fix',
          suggestion: null,
        }],
      },
      repair: {
        overallSummary: 'Clarified the question wording.',
        repairs: [{
          summary: 'Clarify question wording',
          rationale: 'UCAT questions should ask for the necessary conclusion.',
          confidence: 0.98,
          resolvedFindingKeys: ['imprecise-wording'],
          patches: [{
            operation: 'replace_text',
            target: {
              kind: 'question',
              id: questionId,
              field: 'question_text',
            },
            beforeText: 'Which option follows?',
            afterText: 'Which option must follow?',
          }],
        }],
        unresolvedFindings: [],
      },
      verifySemanticRepair,
    })

    expect(verifySemanticRepair).not.toHaveBeenCalled()
    expect(proseMirrorToPlainText(result.values.questions[0]?.questionText))
      .toBe('Which option must follow?')
    expect(result.appliedRepairs).toEqual(['Clarify question wording'])
    expect(result.assessment.findings).toEqual([])
    expect(result.blindSolution.solutions[0]?.justification)
      .toBe('The first option still necessarily follows.')
  })
})
