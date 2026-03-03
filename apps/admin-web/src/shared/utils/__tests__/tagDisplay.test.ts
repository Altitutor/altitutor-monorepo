/**
 * Tests for tagDisplay utility
 * Converts text with tag markers to plain display text
 */

import { renderTextWithTagsAsPlainText } from '../tagDisplay';

describe('renderTextWithTagsAsPlainText', () => {
  it('should replace tags with display text', () => {
    expect(
      renderTextWithTagsAsPlainText('Assigned to @[student:abc:John Doe] for review')
    ).toBe('Assigned to John Doe for review');
  });

  it('should handle multiple tags', () => {
    expect(
      renderTextWithTagsAsPlainText('@[staff:s1:Jane] and @[student:s2:Bob]')
    ).toBe('Jane and Bob');
  });

  it('should return text unchanged when no tags', () => {
    expect(renderTextWithTagsAsPlainText('Plain text')).toBe('Plain text');
  });

  it('should return empty string for null', () => {
    expect(renderTextWithTagsAsPlainText(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(renderTextWithTagsAsPlainText(undefined)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(renderTextWithTagsAsPlainText('')).toBe('');
  });

  it('should handle display text with special characters', () => {
    expect(renderTextWithTagsAsPlainText('Contact @[parent:p1:O\'Brien]')).toBe(
      "Contact O'Brien"
    );
  });
});
