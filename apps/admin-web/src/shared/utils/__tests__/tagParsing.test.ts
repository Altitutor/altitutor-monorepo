/**
 * Tests for tag parsing utilities
 * Tag format: @[entityType:entityId:displayText]
 */

import {
  parseTags,
  createTagMarker,
  isPositionInTag,
  getTagAtPosition,
  wouldBreakTag,
  findMentionStart,
  extractMentionQuery,
  extractDisplayText,
} from '../tagParsing';

describe('parseTags', () => {
  it('should return empty array for text with no tags', () => {
    expect(parseTags('Hello world')).toEqual([]);
    expect(parseTags('')).toEqual([]);
  });

  it('should parse a single tag', () => {
    const text = 'Assigned to @[student:abc-123:John Doe] for review';
    const fullMatch = '@[student:abc-123:John Doe]';
    const startIndex = text.indexOf('@');
    const result = parseTags(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'student',
      id: 'abc-123',
      displayText: 'John Doe',
      startIndex,
      endIndex: startIndex + fullMatch.length,
      fullMatch,
    });
  });

  it('should parse multiple tags', () => {
    const text = '@[staff:s1:Jane] and @[student:s2:Bob]';
    const result = parseTags(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: 'staff',
      id: 's1',
      displayText: 'Jane',
    });
    expect(result[1]).toMatchObject({
      type: 'student',
      id: 's2',
      displayText: 'Bob',
    });
  });

  it('should handle display text with colons', () => {
    const text = '@[student:id:Name: With: Colons]';
    const result = parseTags(text);
    expect(result).toHaveLength(1);
    expect(result[0].displayText).toBe('Name: With: Colons');
  });
});

describe('createTagMarker', () => {
  it('should create tag marker string', () => {
    expect(createTagMarker('student', 'abc-123', 'John Doe')).toBe(
      '@[student:abc-123:John Doe]'
    );
  });

  it('should handle different entity types', () => {
    expect(createTagMarker('staff', 's1', 'Jane')).toBe('@[staff:s1:Jane]');
    expect(createTagMarker('parent', 'p1', 'Bob Parent')).toBe(
      '@[parent:p1:Bob Parent]'
    );
  });
});

describe('isPositionInTag', () => {
  const text = 'Hello @[student:abc:John Doe] world';
  const tagStart = text.indexOf('@');
  const tagEnd = tagStart + '@[student:abc:John Doe]'.length;

  it('should return true when position is inside tag', () => {
    expect(isPositionInTag(text, tagStart)).toBe(true); // at @
    expect(isPositionInTag(text, tagStart + 8)).toBe(true); // inside tag
    expect(isPositionInTag(text, tagEnd)).toBe(true); // at end (inclusive)
  });

  it('should return false when position is outside tag', () => {
    expect(isPositionInTag(text, 0)).toBe(false);
    expect(isPositionInTag(text, 5)).toBe(false);
    expect(isPositionInTag(text, tagEnd + 2)).toBe(false); // in "world"
  });

  it('should return false for text with no tags', () => {
    expect(isPositionInTag('plain text', 5)).toBe(false);
  });
});

describe('getTagAtPosition', () => {
  const text = 'Hello @[student:abc:John Doe] world';

  it('should return tag when position is inside tag', () => {
    const tag = getTagAtPosition(text, 15);
    expect(tag).not.toBeNull();
    expect(tag?.type).toBe('student');
    expect(tag?.id).toBe('abc');
    expect(tag?.displayText).toBe('John Doe');
  });

  it('should return null when position is outside tag', () => {
    expect(getTagAtPosition(text, 0)).toBeNull();
    expect(getTagAtPosition(text, 30)).toBeNull();
  });

  it('should return null for text with no tags', () => {
    expect(getTagAtPosition('plain text', 5)).toBeNull();
  });
});

describe('wouldBreakTag', () => {
  const text = 'Hello @[student:abc:John Doe] world';
  const tagStart = text.indexOf('@');
  const tagEnd = tagStart + '@[student:abc:John Doe]'.length;

  it('should return true when editing strictly inside tag', () => {
    expect(wouldBreakTag(text, tagStart + 1)).toBe(true); // after @
    expect(wouldBreakTag(text, tagStart + 8)).toBe(true); // inside tag
    expect(wouldBreakTag(text, tagEnd - 1)).toBe(true); // before ]
  });

  it('should return false when at tag boundaries (@ or ])', () => {
    expect(wouldBreakTag(text, tagStart)).toBe(false); // at @
    expect(wouldBreakTag(text, tagEnd)).toBe(false); // at ]
  });

  it('should return false when outside tag', () => {
    expect(wouldBreakTag(text, 0)).toBe(false);
    expect(wouldBreakTag(text, tagEnd + 2)).toBe(false);
  });

  it('should return false for text with no tags', () => {
    expect(wouldBreakTag('plain text', 5)).toBe(false);
  });
});

describe('findMentionStart', () => {
  it('should find @ when typing a mention', () => {
    expect(findMentionStart('Hello @', 7)).toBe(6);
    expect(findMentionStart('Hello @j', 8)).toBe(6);
    expect(findMentionStart('@', 1)).toBe(0);
  });

  it('should return -1 when space precedes cursor before @', () => {
    expect(findMentionStart('Hello @j', 6)).toBe(-1); // cursor at space
    expect(findMentionStart('some @ text', 10)).toBe(-1); // space before @
  });

  it('should return -1 when @ is part of complete tag marker', () => {
    const text = 'Assigned @[student:abc:John] to task';
    expect(findMentionStart(text, 30)).toBe(-1); // cursor after tag
  });

  it('should return -1 for empty string', () => {
    expect(findMentionStart('', 0)).toBe(-1);
  });

  it('should return -1 when no @ found', () => {
    expect(findMentionStart('Hello world', 5)).toBe(-1);
  });

  it('should allow newlines (multi-line support)', () => {
    expect(findMentionStart('Line1\n@j', 7)).toBe(6);
  });
});

describe('extractMentionQuery', () => {
  it('should extract query after @', () => {
    expect(extractMentionQuery('Hello @joh', 10)).toBe('joh');
    expect(extractMentionQuery('@alice', 6)).toBe('alice');
  });

  it('should return empty string when cursor is right after @', () => {
    expect(extractMentionQuery('Hello @', 7)).toBe('');
    expect(extractMentionQuery('@', 1)).toBe('');
  });

  it('should return null when no mention in progress', () => {
    expect(extractMentionQuery('Hello world', 5)).toBeNull();
  });

  it('should return empty string when cursor is right after @ with trailing space', () => {
    // Cursor at space after @ - implementation finds @ and returns empty query
    expect(extractMentionQuery('Hello @ ', 7)).toBe('');
  });

  it('should return null when @ is part of complete tag', () => {
    expect(extractMentionQuery('@[student:abc:John]', 18)).toBeNull();
  });
});

describe('extractDisplayText', () => {
  it('should replace tags with display text', () => {
    expect(extractDisplayText('Assigned to @[student:abc:John Doe] for review')).toBe(
      'Assigned to John Doe for review'
    );
  });

  it('should handle multiple tags', () => {
    expect(extractDisplayText('@[staff:s1:Jane] and @[student:s2:Bob]')).toBe(
      'Jane and Bob'
    );
  });

  it('should return text unchanged when no tags', () => {
    expect(extractDisplayText('Plain text')).toBe('Plain text');
  });

  it('should handle empty string', () => {
    expect(extractDisplayText('')).toBe('');
  });

  it('should handle display text with special characters', () => {
    expect(extractDisplayText('@[student:id:O\'Brien]')).toBe("O'Brien");
  });
});
