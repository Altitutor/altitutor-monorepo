/**
 * Tests for Decision Making parser
 */

import { isSyllogismQuestionText, parseDecisionMakingPlainText } from '../decisionMaking';

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({}) as typeof fetch;
});

describe('isSyllogismQuestionText', () => {
  it('returns true for "Place Yes if the conclusion does follow"', () => {
    expect(isSyllogismQuestionText('Place Yes if the conclusion does follow')).toBe(true);
  });

  it('returns true for "Place No if the conclusion does not follow"', () => {
    expect(isSyllogismQuestionText('Place No if the conclusion does not follow')).toBe(true);
  });

  it('returns true for "Place Yes/No if the conclusion does follow"', () => {
    expect(isSyllogismQuestionText('Place Yes/No if the conclusion does follow')).toBe(true);
  });

  it('returns true when has conclusion and follow', () => {
    expect(isSyllogismQuestionText('Does the conclusion follow?')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isSyllogismQuestionText('')).toBe(false);
  });

  it('returns false for multiple choice style', () => {
    expect(isSyllogismQuestionText('Which of the following is true?')).toBe(false);
  });
});

describe('parseDecisionMakingPlainText', () => {
  it('parses stem with numbered questions and options', () => {
    const input = `Stem passage here.

1. Question text?
a) Option A
b) Option B
c) Option C`;

    const stems = parseDecisionMakingPlainText(input);
    expect(stems).toHaveLength(1);
    expect(stems[0]?.stemText).toContain('Stem passage');
    expect(stems[0]?.questions).toHaveLength(1);
    expect(stems[0]?.questions[0]?.text).toContain('Question text');
    expect(stems[0]?.questions[0]?.options).toHaveLength(3);
    expect(stems[0]?.questions[0]?.options[0]?.label).toBe('a');
    expect(stems[0]?.questions[0]?.options[0]?.text).toBe('Option A');
  });

  it('classifies syllogism questions correctly', () => {
    const input = `Passage.

1. Place Yes if the conclusion does follow.
A
B
C
D
E`;

    const stems = parseDecisionMakingPlainText(input);
    expect(stems[0]?.questions[0]?.questionType).toBe('syllogism');
  });

  it('classifies multiple choice questions correctly', () => {
    const input = `Passage.

1. Which option is correct?
a) A
b) B
c) C`;

    const stems = parseDecisionMakingPlainText(input);
    expect(stems[0]?.questions[0]?.questionType).toBe('multiple_choice');
  });
});
