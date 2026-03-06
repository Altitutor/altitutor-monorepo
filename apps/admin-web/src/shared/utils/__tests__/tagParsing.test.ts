/**
 * Tests for tag parsing utilities (createTagMarker for clipboard)
 * Tag format: @[entityType:entityId:displayText]
 */

import { createTagMarker } from '../tagParsing';

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
