/**
 * Tests for rich-text utilities
 */

import { extractTextFromRichJson } from '../rich-text';

describe('extractTextFromRichJson', () => {
  it('returns empty string for null', () => {
    expect(extractTextFromRichJson(null)).toBe('');
  });

  it('returns string for string value', () => {
    expect(extractTextFromRichJson('hello')).toBe('hello');
  });

  it('extracts text from content array (ProseMirror)', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    };
    expect(extractTextFromRichJson(json)).toBe('Hello');
  });

  it('joins multiple text nodes with space', () => {
    const json = { content: [{ text: 'A' }, { text: 'B' }] };
    expect(extractTextFromRichJson(json)).toBe('A B');
  });

  it('handles number and boolean', () => {
    expect(extractTextFromRichJson(42)).toBe('42');
    expect(extractTextFromRichJson(true)).toBe('true');
  });

  it('handles array of content', () => {
    expect(extractTextFromRichJson(['a', 'b'])).toBe('a b');
  });
});
