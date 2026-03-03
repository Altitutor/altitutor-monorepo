/**
 * Tests for type helper utilities
 */

import { isNotNull, hasProperty } from '../helpers';

describe('isNotNull', () => {
  it('returns true for defined non-null values', () => {
    expect(isNotNull(0)).toBe(true);
    expect(isNotNull('')).toBe(true);
    expect(isNotNull(false)).toBe(true);
    expect(isNotNull({})).toBe(true);
  });

  it('returns false for null and undefined', () => {
    expect(isNotNull(null)).toBe(false);
    expect(isNotNull(undefined)).toBe(false);
  });
});

describe('hasProperty', () => {
  it('returns true when object has the key', () => {
    expect(hasProperty({ foo: 1 }, 'foo')).toBe(true);
    expect(hasProperty({ a: null }, 'a')).toBe(true);
  });

  it('returns false when object is null or not an object', () => {
    expect(hasProperty(null, 'foo')).toBe(false);
    expect(hasProperty(undefined, 'foo')).toBe(false);
    expect(hasProperty('string', 'foo')).toBe(false);
  });

  it('returns false when key is not in object', () => {
    expect(hasProperty({ a: 1 }, 'b')).toBe(false);
  });
});
