/**
 * Tests for Decision Making parser
 */

import {
  getDecisionMakingStemCategoryName,
  getDecisionMakingTagPathsForQuestion,
  isPlacementQuestionText,
  parseDecisionMakingPlainText,
} from '../decisionMaking';

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({}) as typeof fetch;
});

describe('isPlacementQuestionText', () => {
  it('returns true for "Place Yes if the conclusion does follow"', () => {
    expect(isPlacementQuestionText('Place Yes if the conclusion does follow')).toBe(true);
  });

  it('returns true for "Place No if the conclusion does not follow"', () => {
    expect(isPlacementQuestionText('Place No if the conclusion does not follow')).toBe(true);
  });

  it('returns true for "Place Yes/No if the conclusion does follow"', () => {
    expect(isPlacementQuestionText('Place Yes/No if the conclusion does follow')).toBe(true);
  });

  it('returns true when has conclusion and follow', () => {
    expect(isPlacementQuestionText('Does the conclusion follow?')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isPlacementQuestionText('')).toBe(false);
  });

  it('returns false for multiple choice style', () => {
    expect(isPlacementQuestionText('Which of the following is true?')).toBe(false);
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
    expect(stems[0]?.questions[0]).toMatchObject({
      responseType: 'drag_and_drop',
      answerScheme: 'decision_making_binary_placement',
    });
  });

  it('parses an unnumbered syllogism instruction followed by five statements', () => {
    const input = `Physicians are from either Melbourne or Sydney and practice in either General Medicine or Oncology. Some physicians are from Melbourne and the rest practice Oncology.

Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.

All physicians from Sydney practice General Medicine.
Some physicians from Melbourne practice Oncology.
No physicians from Sydney practice Oncology.
Some Oncology physicians are from Melbourne.
All physicians who practice General Medicine are from Sydney.`;

    const stems = parseDecisionMakingPlainText(input);
    expect(stems).toHaveLength(1);
    expect(stems[0]?.stemText).toContain('Physicians are from either Melbourne or Sydney');
    expect(stems[0]?.questions).toHaveLength(1);
    expect(stems[0]?.questions[0]).toMatchObject({
      responseType: 'drag_and_drop',
      answerScheme: 'decision_making_binary_placement',
    });
    expect(stems[0]?.questions[0]?.text).toContain("Place 'Yes'");
    expect(stems[0]?.questions[0]?.options).toHaveLength(5);
    expect(stems[0]?.questions[0]?.options[0]?.text).toBe(
      'All physicians from Sydney practice General Medicine.'
    );
  });

  it('classifies multiple choice questions correctly', () => {
    const input = `Passage.

1. Which option is correct?
a) A
b) B
c) C`;

    const stems = parseDecisionMakingPlainText(input, { answerOptionIndicator: 'paren' });
    expect(stems[0]?.questions[0]?.responseType).toBe('multiple_choice');
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

describe('getDecisionMakingStemCategoryName', () => {
  it('lets a trusted category heading win over conflicting content signals', () => {
    const stems = parseDecisionMakingPlainText(`Interpreting Information and Drawing Conclusions
The table shows that all architects are readers and no readers attended in May.

1. Place Yes if the conclusion follows. Place No if the conclusion does not follow.
A. First statement
B. Second statement
C. Third statement
D. Fourth statement
E. Fifth statement`)

    expect(getDecisionMakingStemCategoryName(stems[0]!)).toBe(
      'Interpreting Information and Drawing Conclusions'
    )
  })

  it('classifies mixed universal and particular syllogism premises as Syllogisms', () => {
    const input = `All the patients in the respiratory ward who are smokers are women. Patient A is not a smoker. All the smokers on the ward live in the city. Patient B lives in the city.

Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.

Patient A is a man
All of the female patients on the respiratory ward live in the city
Patient B is a woman
There are no female non-smokers
All male patients on the ward are non-smokers`

    const stems = parseDecisionMakingPlainText(input)
    expect(getDecisionMakingStemCategoryName(stems[0]!)).toBe('Syllogisms')
  })

  it('classifies exhaustive no-other-except premises as Syllogisms', () => {
    const input = `Jane has a lot of dogs. She has Dobermans and white or grey Alsatians. She has no other type of dog except brown Rottweilers.

Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.

Jane has a brown Rottweiler
Some of Jane's dogs are Dobermans
Jane has no black Alsatians
All Jane's Rottweilers are brown
Jane has at least three types of dog`

    const stems = parseDecisionMakingPlainText(input)
    expect(getDecisionMakingStemCategoryName(stems[0]!)).toBe('Syllogisms')
  })

  it('classifies prose Yes/No information passages as Interpreting Information and Drawing Conclusions', () => {
    const input = `For small independent companies, where the company values are not the priority, selling their business out to larger corporate companies can boost sales significantly. Small companies can benefit from the expertise and vast resources that large corporations can certainly offer. Provided that it is well managed, independent companies that have been bought out by corporate companies can expand their businesses at a rate that is not achievable had they not have had the input of large corporations. The involvement of a corporate company is known to compromise the devotion of some customers, particularly those who prefer independent companies.

Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.

The input of a large corporation is purely advantageous to small independent companies
A small company whose company values are the priority, should not sell their business to larger corporate companies
All independent companies that have sold their business out to large corporations will see their business expand at a faster rate
Large corporate companies have greater expertise and more resources than small independent companies
Some people will be deterred from remaining as customers if they know that the company has been bought out by a large corporation`

    const stems = parseDecisionMakingPlainText(input)
    expect(getDecisionMakingStemCategoryName(stems[0]!)).toBe(
      'Interpreting Information and Drawing Conclusions'
    )
  })

  it('classifies dice re-roll expected-value questions as probabilistic reasoning', () => {
    const input = `Damien and Martin are playing a game using a fair six-sided dice. Damien states that he will pay Martin $10 multiplied by the number on the dice that Martin rolls. Martin rolls the dice and it lands on a "three". Damien says that he will let Martin roll the dice once more if he wants to.

Note - if Martin decides to re-roll the dice, it replaces his original roll and is not added on.

In order to make the most amount of money possible, should Martin accept Damien's offer to roll the dice again?

A. Yes, since Martin is highly likely to win more money if he rolls again.
B. Yes, since there is a 50% probability that Martin will win more money.
C. No, since Martin is unlikely to win more money if he rolls again.
D. No, since there is a 50% probability that Martin will not win more money.`;

    const stems = parseDecisionMakingPlainText(input, { answerOptionOnOwnLine: true });
    expect(stems).toHaveLength(1);
    expect(getDecisionMakingStemCategoryName(stems[0]!)).toBe(
      'Probabilistic and Statistical Reasoning'
    );
  });

  it('keeps seating-chart logical puzzles as logical puzzles', () => {
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
    expect(getDecisionMakingStemCategoryName(stems[0]!)).toBe('Logical Puzzles');
  });

  it('detects probabilistic reasoning from option text when stem and question lack keywords', () => {
    const stems = parseDecisionMakingPlainText(
      `A short scenario with no explicit odds language in the stem.

1. Should the player take the offer?
a) Yes, because there is a 50% probability of a better outcome.
b) No.`,
      { answerOptionIndicator: 'paren' }
    );
    expect(getDecisionMakingStemCategoryName(stems[0]!)).toBe(
      'Probabilistic and Statistical Reasoning'
    );
  });
});

describe('getDecisionMakingTagPathsForQuestion', () => {
  it('tags syllogisms with deductive operators', () => {
    const stem = parseDecisionMakingPlainText(`All exhibits in the east wing are insured. If an exhibit is made of gold, it is kept in the east wing.

1. Place Yes if the conclusion does follow. Place No if the conclusion does not follow.
A. Some insured exhibits are made of gold.
B. No gold exhibits are uninsured.
C. All east wing exhibits are made of gold.
D. Some exhibits are not insured.
E. All insured exhibits are in the east wing.`)[0]!;

    expect(getDecisionMakingTagPathsForQuestion({
      stem,
      question: stem.questions[0]!,
    })).toEqual(expect.arrayContaining([
      ['Deductive logic', 'Quantifiers: all / some / none'],
      ['Deductive logic', 'Conditional reasoning'],
      ['Deductive logic', 'Must be true / necessarily follows'],
      ['Decision wording traps', 'Yes/no sufficiency'],
    ]));
  });

  it('tags seating and matching puzzles as rule-based reasoning', () => {
    const stem = parseDecisionMakingPlainText(`5.
A group of seven friends are going for a road trip.
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
With Candice in the back row of the other car`, {
      questionNumberPlacement: 'item_stem',
      answerOptionOnOwnLine: true,
    })[0]!;

    expect(getDecisionMakingTagPathsForQuestion({
      stem,
      question: stem.questions[0]!,
    })).toEqual(expect.arrayContaining([
      ['Rule-based problem solving', 'Seating or spatial arrangement'],
      ['Rule-based problem solving', 'Multi-constraint deduction'],
    ]));
  });

  it('tags probability method and comparison traps', () => {
    const stem = parseDecisionMakingPlainText(`A bag contains five red balls and three blue balls. Two balls are selected without replacement.

1. What is the probability that the chance of selecting two red balls is greater than selecting two blue balls?
A. It is greater than the chance of two blue balls.
B. It is less than the chance of two blue balls.`)[0]!;

    expect(getDecisionMakingTagPathsForQuestion({
      stem,
      question: stem.questions[0]!,
    })).toEqual(expect.arrayContaining([
      ['Probability and data reasoning', 'Basic probability'],
      ['Probability and data reasoning', 'Without replacement / combinations'],
      ['Probability and data reasoning', 'Fraction / percentage comparison'],
      ['Decision wording traps', 'Greater than / less than comparison'],
    ]));
  });

  it('tags recognising-assumption questions by argument pattern', () => {
    const stem = parseDecisionMakingPlainText(`Will decreasing university fees reduce unemployment levels?

1. Select the strongest argument from the statements below.
A. Yes, because cheaper degrees will encourage more people to gain qualifications.
B. No, because government policy should focus on public health instead.
C. Yes, because universities are important.`)[0]!;

    expect(getDecisionMakingTagPathsForQuestion({
      stem,
      question: stem.questions[0]!,
    })).toEqual(expect.arrayContaining([
      ['Argument evaluation', 'Strongest argument'],
      ['Argument evaluation', 'Causal assumption'],
      ['Argument evaluation', 'Policy or public benefit'],
    ]));
  });

  it('tags Venn questions without applying broad set tags to ordinary puzzles', () => {
    const vennStem = parseDecisionMakingPlainText(`The diagram shows three groups: students who play tennis, cricket and hockey.

1. How many students play tennis only and did not play cricket?
A. 2
B. 3`)[0]!;

    expect(getDecisionMakingTagPathsForQuestion({
      stem: vennStem,
      question: vennStem.questions[0]!,
    })).toEqual(expect.arrayContaining([
      ['Set and Venn reasoning', 'Region counting'],
      ['Set and Venn reasoning', 'Only / neither / complements'],
      ['Set and Venn reasoning', 'Three-plus sets'],
    ]));

    const ordinaryStem = parseDecisionMakingPlainText(`A group of friends choose red or blue folders.

1. Which friend must choose blue?
A. Anna
B. Ben`)[0]!;

    expect(getDecisionMakingTagPathsForQuestion({
      stem: ordinaryStem,
      question: ordinaryStem.questions[0]!,
    }).some((path) => path[0] === 'Set and Venn reasoning')).toBe(false);
  });
});
