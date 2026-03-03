/**
 * Tests for review utilities
 */

import {
  getReviewQuestionStatus,
  getReviewFilterIndices,
  getIncompleteCount,
} from '../review';
import type { QuestionItem } from '@/features/question-engine/model/types';

function createQuestion(id: string, index: number): QuestionItem {
  return {
    id,
    index,
    questionSetId: 'set-1',
    stemId: 'stem-1',
    sectionName: 'Section',
    sectionDisplayColumns: 1,
    stemText: '',
    questionText: '',
    questionType: 'multiple_choice',
    options: [],
  };
}

describe('getReviewQuestionStatus', () => {
  it('returns "complete" when question has an answer', () => {
    expect(getReviewQuestionStatus('q1', [], { q1: 'opt-a' })).toBe('complete');
  });

  it('returns "incomplete" when visited but not answered', () => {
    expect(getReviewQuestionStatus('q1', ['q1'], {})).toBe('incomplete');
  });

  it('returns "unseen" when not visited and not answered', () => {
    expect(getReviewQuestionStatus('q1', [], {})).toBe('unseen');
  });
});

describe('getReviewFilterIndices', () => {
  const questions = [
    createQuestion('q1', 0),
    createQuestion('q2', 1),
    createQuestion('q3', 2),
  ];

  it('returns all indices for "all" filter', () => {
    expect(getReviewFilterIndices(questions, 'all', [], {}, [])).toEqual([0, 1, 2]);
  });

  it('returns only incomplete/unseen for "incomplete" filter', () => {
    expect(
      getReviewFilterIndices(questions, 'incomplete', ['q1'], { q2: 'opt-b' }, [])
    ).toEqual([0, 2]);
  });

  it('returns only flagged indices for "flagged" filter', () => {
    expect(getReviewFilterIndices(questions, 'flagged', [], {}, ['q1', 'q3'])).toEqual([0, 2]);
  });
});

describe('getIncompleteCount', () => {
  const questions = [
    createQuestion('q1', 0),
    createQuestion('q2', 1),
    createQuestion('q3', 2),
  ];

  it('returns 0 when all answered', () => {
    expect(getIncompleteCount(questions, [], { q1: 'a', q2: 'b', q3: 'c' })).toBe(0);
  });

  it('returns 3 when none answered', () => {
    expect(getIncompleteCount(questions, [], {})).toBe(3);
  });
});
