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

    const stems = parseDecisionMakingPlainText(input, { answerOptionIndicator: 'paren' });
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

  it('parses an unnumbered syllogism instruction followed by five statements', () => {
    const input = `Physicians are from either Melbourne or Sydney and practise in either General Medicine or Oncology. Some physicians are from Melbourne and the rest practise Oncology.

Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.

All physicians from Sydney practise General Medicine.
Some physicians from Melbourne practise Oncology.
No physicians from Sydney practise Oncology.
Some Oncology physicians are from Melbourne.
All physicians who practise General Medicine are from Sydney.`;

    const stems = parseDecisionMakingPlainText(input);
    expect(stems).toHaveLength(1);
    expect(stems[0]?.stemText).toContain('Physicians are from either Melbourne or Sydney');
    expect(stems[0]?.questions).toHaveLength(1);
    expect(stems[0]?.questions[0]?.questionType).toBe('syllogism');
    expect(stems[0]?.questions[0]?.text).toContain("Place 'Yes'");
    expect(stems[0]?.questions[0]?.options).toHaveLength(5);
    expect(stems[0]?.questions[0]?.options[0]?.text).toBe(
      'All physicians from Sydney practise General Medicine.'
    );
  });

  it('classifies multiple choice questions correctly', () => {
    const input = `Passage.

1. Which option is correct?
a) A
b) B
c) C`;

    const stems = parseDecisionMakingPlainText(input, { answerOptionIndicator: 'paren' });
    expect(stems[0]?.questions[0]?.questionType).toBe('multiple_choice');
  });

  it('parses item-stem numbered blocks by using the last paragraph before options as question text', () => {
    const input = `5.
A group of seven friends are going for a road trip to Rockhampton from Brisbane.
Bob and Alex should not travel in the same car.
Sangeetha and Joseph sit in the same row of the same car.
If Ellie and Alex sit in the same car with Ellie in the back row, determine the possible position of Bob?
A.
In the front row of the other car
B.
In the front row of the same car
C.
With Tarek in the back row of the other car
D.
With Candice in the back row of the other car`;

    const stems = parseDecisionMakingPlainText(input, {
      questionNumberPlacement: 'item_stem',
      answerOptionOnOwnLine: true,
    });

    expect(stems).toHaveLength(1);
    expect(stems[0]?.stemText).toContain('A group of seven friends');
    expect(stems[0]?.stemText).toContain('Sangeetha and Joseph');
    expect(stems[0]?.stemText).not.toContain('determine the possible position of Bob');
    expect(stems[0]?.questions).toHaveLength(1);
    expect(stems[0]?.questions[0]?.number).toBe(5);
    expect(stems[0]?.questions[0]?.text).toBe(
      'If Ellie and Alex sit in the same car with Ellie in the back row, determine the possible position of Bob?'
    );
    expect(stems[0]?.questions[0]?.options).toHaveLength(4);
    expect(stems[0]?.questions[0]?.options[0]?.text).toBe(
      'In the front row of the other car'
    );
  });
});
