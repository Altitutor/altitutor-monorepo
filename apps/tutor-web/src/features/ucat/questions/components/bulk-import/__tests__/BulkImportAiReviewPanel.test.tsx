import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { BulkImportAiReviewPanel } from '../BulkImportAiReviewPanel'

describe('BulkImportAiReviewPanel', () => {
  it('shows the post-repair assessment and marks resolved audit categories as fixed', () => {
    render(
      <BulkImportAiReviewPanel
        activeQuestionId="question-1"
        activeQuestionIndex={0}
        phase="ready"
        stale={false}
        result={{
          id: 'stem-1',
          promptVersion: 11,
          fingerprints: null,
          audit: {
            overallSummary: 'The calculation is sound but the explanation needs teaching detail.',
            categories: [
              {
                scopeType: 'question',
                questionId: 'question-1',
                category: 'answer_correctness_fairness',
                rating: 'pass',
                confidence: 0.98,
                summary: 'The keyed answer is uniquely correct.',
                evidence: ['The independent calculation gives $2.98.'],
              },
              {
                scopeType: 'question',
                questionId: 'question-1',
                category: 'explanation_quality',
                rating: 'concern',
                confidence: 0.96,
                summary: 'The explanation proves the answer but does not teach the shortest method.',
                evidence: [],
              },
            ],
            findings: [],
          },
          assessment: {
            overallSummary: 'Repaired and ready.',
            categories: [
              {
                scopeType: 'question',
                questionId: 'question-1',
                category: 'answer_correctness_fairness',
                rating: 'pass',
                confidence: 0.98,
                summary: 'The keyed answer is uniquely correct.',
                evidence: ['The independent calculation gives $2.98.'],
              },
              {
                scopeType: 'question',
                questionId: 'question-1',
                category: 'explanation_quality',
                rating: 'pass',
                confidence: 0.99,
                summary: 'Resolved by AI repair: Rewrote the question-level explanation.',
                evidence: [],
              },
            ],
            findings: [],
          },
          blindSolution: null,
          values: null,
          appliedRepairs: ['Rewrote the question-level explanation.'],
          provenance: null,
          reviewToken: null,
          reused: false,
          error: null,
          timings: {
            totalMs: 1_500,
            auditRepairMs: 1_000,
            verificationPreparationMs: 10,
            blindVerificationMs: 450,
            reconciliationMs: 40,
          },
        }}
      />,
    )

    expect(screen.getByText('Answer correctness & fairness')).toBeInTheDocument()
    expect(screen.getByText('The keyed answer is uniquely correct.')).toBeInTheDocument()
    expect(screen.getByText('Explanation quality')).toBeInTheDocument()
    expect(screen.queryByText(
      'The explanation proves the answer but does not teach the shortest method.',
    )).not.toBeInTheDocument()
    expect(screen.getByText('Fixed automatically')).toBeInTheDocument()
    expect(screen.getByText('Resolved by AI repair: Rewrote the question-level explanation.'))
      .toBeInTheDocument()
    expect(screen.getByText('1.5 s')).toBeInTheDocument()
    expect(screen.getByText('Audit & repairs')).toBeInTheDocument()
  })

  it('offers finding decisions in the detailed review panel', () => {
    const onApproveFinding = jest.fn()
    const onKeepFinding = jest.fn()
    render(
      <BulkImportAiReviewPanel
        activeQuestionId="question-1"
        activeQuestionIndex={0}
        phase="manual_review"
        stale={false}
        onApproveFinding={onApproveFinding}
        onKeepFinding={onKeepFinding}
        result={{
          id: 'stem-1',
          promptVersion: 11,
          fingerprints: null,
          audit: null,
          assessment: {
            overallSummary: 'One edit needs approval.',
            categories: [],
            findings: [{
              key: 'wording-fix',
              scopeType: 'question',
              questionId: 'question-1',
              category: 'presentation_integrity',
              rating: 'concern',
              confidence: 0.9,
              title: 'Repair wording',
              detail: 'A bounded wording edit is available.',
              evidence: [],
              recommendedAction: 'fix',
              suggestion: {
                id: 'suggestion-1',
                summary: 'Clarify the wording',
                rationale: 'Removes ambiguity.',
                application: 'approval_required',
                patches: [],
              },
            }],
          },
          blindSolution: null,
          values: null,
          appliedRepairs: [],
          provenance: null,
          reviewToken: null,
          reused: false,
          error: null,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Approve fix' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep as-is' }))

    expect(onApproveFinding).toHaveBeenCalledWith('wording-fix')
    expect(onKeepFinding).toHaveBeenCalledWith('wording-fix')
  })
})
