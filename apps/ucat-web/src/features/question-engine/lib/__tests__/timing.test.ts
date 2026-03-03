/**
 * Tests for timing utilities
 */

import {
  getCurrentSegmentTimeLimitSeconds,
  formatTimeRemaining,
} from '../timing';
import type {
  QuestionEngineExam,
  QuestionEngineState,
} from '@/features/question-engine/model/types';

function createBaseState(overrides: Partial<QuestionEngineState> = {}): QuestionEngineState {
  return {
    phase: 'question',
    instructionsIndex: 0,
    showReadyDialog: false,
    timerStartedAt: null,
    showTimeExpiredDialog: false,
    nextSegmentTimerStartedAt: null,
    currentIndex: 0,
    visitedQuestionIds: [],
    flaggedIds: [],
    selectedAnswers: {},
    showNavigator: false,
    showCalculator: false,
    showEndExamDialog: false,
    reviewFilter: null,
    reviewFilterIndex: 0,
    showReviewInstructionsDialog: false,
    showEndReviewDialog: false,
    viewingQuestionIndex: null,
    showExitResultsDialog: false,
    ...overrides,
  };
}

describe('getCurrentSegmentTimeLimitSeconds', () => {
  it('returns null for set mode when untimed', () => {
    const exam: QuestionEngineExam = {
      sourceType: 'set',
      sourceId: 's1',
      title: 'Set',
      questions: [],
      instructionsScreens: [],
      setModeTiming: { setTimeLimitSeconds: null, instructionsTimeLimitSeconds: null },
    };
    expect(getCurrentSegmentTimeLimitSeconds(exam, createBaseState())).toBeNull();
  });

  it('returns set time limit for question phase in set mode', () => {
    const exam: QuestionEngineExam = {
      sourceType: 'set',
      sourceId: 's1',
      title: 'Set',
      questions: [],
      instructionsScreens: [],
      setModeTiming: { setTimeLimitSeconds: 600, instructionsTimeLimitSeconds: 120 },
    };
    expect(
      getCurrentSegmentTimeLimitSeconds(exam, createBaseState({ phase: 'question' }))
    ).toBe(600);
  });

  it('returns instructions time limit for instructions phase in set mode', () => {
    const exam: QuestionEngineExam = {
      sourceType: 'set',
      sourceId: 's1',
      title: 'Set',
      questions: [],
      instructionsScreens: [],
      setModeTiming: { setTimeLimitSeconds: 600, instructionsTimeLimitSeconds: 120 },
    };
    expect(
      getCurrentSegmentTimeLimitSeconds(exam, createBaseState({ phase: 'instructions' }))
    ).toBe(120);
  });
});

describe('formatTimeRemaining', () => {
  it('formats seconds as MM:SS', () => {
    expect(formatTimeRemaining(90)).toBe('1:30');
    expect(formatTimeRemaining(0)).toBe('0:00');
    expect(formatTimeRemaining(125)).toBe('2:05');
  });
});
