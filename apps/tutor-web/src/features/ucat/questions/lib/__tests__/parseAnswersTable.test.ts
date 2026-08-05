/**
 * Tests for parseAnswersTable utilities
 */

import {
  parseAnswersTable,
  letterToOptionIndex,
  parseDecisionMakingAnswers,
} from '../parseAnswersTable';

describe('parseAnswersTable', () => {
  it('parses plain text TSV', () => {
    const input = 'A\tExplanation for A\nB\tExplanation for B';
    const result = parseAnswersTable(input);
    expect(result).toEqual([
      { letter: 'A', explanation: 'Explanation for A' },
      { letter: 'B', explanation: 'Explanation for B' },
    ]);
  });

  it('skips header row', () => {
    const input = 'Answer\tExplanation\nA\tExp A\nB\tExp B';
    const result = parseAnswersTable(input);
    expect(result).toEqual([
      { letter: 'A', explanation: 'Exp A' },
      { letter: 'B', explanation: 'Exp B' },
    ]);
  });

  it('parses rows with question number', () => {
    const input = '1\tA\tExplanation one\n2\tB\tExplanation two';
    const result = parseAnswersTable(input);
    expect(result).toEqual([
      { letter: 'A', explanation: 'Explanation one' },
      { letter: 'B', explanation: 'Explanation two' },
    ]);
  });

  it('parses numbered rows without explanation cells', () => {
    const input = '1\tA\t\n2\tB';
    const result = parseAnswersTable(input);
    expect(result).toEqual([
      { letter: 'A', explanation: '' },
      { letter: 'B', explanation: '' },
    ]);
  });

  it('parses loose Google Docs/PDF solution copy with answer and explanation columns on separate lines', () => {
    const input = `* Solutions
Answer

Explanation
1
C
Rule: Set A has an even number of intersections.
Set B has an odd number of intersections.
2
B

3
A
This follows from the final sentence.`

    const result = parseAnswersTable(input)

    expect(result).toEqual([
      {
        letter: 'C',
        explanation:
          'Rule: Set A has an even number of intersections.\nSet B has an odd number of intersections.',
      },
      { letter: 'B', explanation: '' },
      { letter: 'A', explanation: 'This follows from the final sentence.' },
    ])
  })

  it('parses loose inline answer rows from copied solution text', () => {
    const input = `1. C Because the passage says so.
2 B
3) A The table total is 42.`

    const result = parseAnswersTable(input)

    expect(result).toEqual([
      { letter: 'C', explanation: 'Because the passage says so.' },
      { letter: 'B', explanation: '' },
      { letter: 'A', explanation: 'The table total is 42.' },
    ])
  })

  it('parses numbered answer lists without explanations', () => {
    const input = `1. C
2. A
3. B
4. C
5. B`

    expect(parseAnswersTable(input, { inputFormat: 'numbered_list' })).toEqual([
      { letter: 'C', explanation: '' },
      { letter: 'A', explanation: '' },
      { letter: 'B', explanation: '' },
      { letter: 'C', explanation: '' },
      { letter: 'B', explanation: '' },
    ])
  })

  it('returns empty array for empty input', () => {
    expect(parseAnswersTable('')).toEqual([]);
    expect(parseAnswersTable('   ')).toEqual([]);
  });

  it('returns empty array for null/undefined', () => {
    expect(parseAnswersTable(null as unknown as string)).toEqual([]);
    expect(parseAnswersTable(undefined as unknown as string)).toEqual([]);
  });
});

describe('letterToOptionIndex', () => {
  it('maps A-E to 0-4', () => {
    expect(letterToOptionIndex('A')).toBe(0);
    expect(letterToOptionIndex('B')).toBe(1);
    expect(letterToOptionIndex('E')).toBe(4);
  });

  it('handles lowercase', () => {
    expect(letterToOptionIndex('a')).toBe(0);
  });

  it('returns 0 for invalid letter', () => {
    expect(letterToOptionIndex('F')).toBe(0);
  });
});

describe('parseDecisionMakingAnswers', () => {
  it('parses syllogism Y/N pattern from line format', () => {
    const input = '1\nY\nN\nY\nN\nY';
    const result = parseDecisionMakingAnswers(input, ['syllogism']);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toHaveProperty('pattern');
    expect(result[0]?.pattern).toMatch(/^[YN]+$/);
  });

  it('parses a compact five-character syllogism pattern', () => {
    const result = parseDecisionMakingAnswers('YNNYN', ['syllogism']);
    expect(result).toEqual([{ pattern: 'YNNYN', optionExplanations: ['', '', '', '', ''] }]);
  });

  it('parses comma-separated Yes/No syllogism answers', () => {
    const result = parseDecisionMakingAnswers('No, yes, no, no, yes', ['syllogism']);
    expect(result).toEqual([{ pattern: 'NYNNY', optionExplanations: ['', '', '', '', ''] }]);
  });

  it('parses a compact pattern after a question number on its own line', () => {
    const result = parseDecisionMakingAnswers('1\nYNNYN', ['syllogism']);
    expect(result[0]?.pattern).toBe('YNNYN');
  });

  it('parses multiple choice letter', () => {
    const input = '1\nB';
    const result = parseDecisionMakingAnswers(input, ['multiple_choice']);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toHaveProperty('letter');
    expect(result[0]?.letter).toBe('B');
  });

  it('parses numbered answer lists for Decision Making', () => {
    const result = parseDecisionMakingAnswers(
      '1. C\n2. A\n3. B',
      ['multiple_choice', 'multiple_choice', 'multiple_choice'],
      { inputFormat: 'numbered_list' }
    )
    expect(result).toEqual([{ letter: 'C' }, { letter: 'A' }, { letter: 'B' }])
  })

  it('keeps explanation text from loose multiple choice line format', () => {
    const input = '1\nB\nOnly this option is supported by the stem.'
    const result = parseDecisionMakingAnswers(input, ['multiple_choice'])
    expect(result[0]).toEqual({
      letter: 'B',
      explanation: 'Only this option is supported by the stem.',
    })
  })

  it('keeps per-option explanations from loose syllogism line format', () => {
    const input = `1
Y
The first conclusion follows.
N
The second conclusion contradicts the stem.
Y
N
Y`
    const result = parseDecisionMakingAnswers(input, ['syllogism'])
    expect(result[0]?.pattern).toBe('YNYNY')
    expect(result[0]?.optionExplanations).toEqual([
      'The first conclusion follows.',
      'The second conclusion contradicts the stem.',
      '',
      '',
      '',
    ])
  })

  it('returns empty array for empty input', () => {
    expect(parseDecisionMakingAnswers('', ['syllogism'])).toEqual([]);
  });

  it('returns empty array for empty questionTypes', () => {
    expect(parseDecisionMakingAnswers('1\nA', [])).toEqual([]);
  });
});
