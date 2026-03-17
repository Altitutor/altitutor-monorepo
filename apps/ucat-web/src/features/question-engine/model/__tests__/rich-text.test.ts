/**
 * Tests for rich-text utilities
 */

import { extractTextFromRichJson, type JsonLike } from '../rich-text';

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

  it('skips image nodes (returns empty string)', () => {
    const jsonWithImage = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] },
        { type: 'image', attrs: { src: 'https://example.com/image.png' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
    } as JsonLike;
    expect(extractTextFromRichJson(jsonWithImage)).toBe('Before After');
  });
});
