/**
 * Tests for enum color utilities
 */

import {
  getStudentStatusColor,
  getSubjectDisciplineColor,
  getEnumColor,
  getBooleanColor,
} from '../enum-colors';

describe('getStudentStatusColor', () => {
  it('returns correct color for ACTIVE', () => {
    expect(getStudentStatusColor('ACTIVE')).toBe('bg-green-100 text-green-800');
  });

  it('returns gray for null/undefined', () => {
    expect(getStudentStatusColor(null)).toBe('bg-gray-100 text-gray-800');
    expect(getStudentStatusColor(undefined)).toBe('bg-gray-100 text-gray-800');
  });
});

describe('getSubjectDisciplineColor', () => {
  it('returns correct color for MATHEMATICS', () => {
    expect(getSubjectDisciplineColor('MATHEMATICS')).toBe(
      'bg-orange-100 text-orange-800'
    );
  });

  it('returns gray for null/undefined', () => {
    expect(getSubjectDisciplineColor(null)).toBe('bg-gray-100 text-gray-800');
    expect(getSubjectDisciplineColor(undefined)).toBe(
      'bg-gray-100 text-gray-800'
    );
  });
});

describe('getEnumColor', () => {
  it('returns mapped color for valid value', () => {
    const map = { A: 'bg-blue-100', B: 'bg-red-100' } as const;
    expect(getEnumColor('A', map)).toBe('bg-blue-100');
  });

  it('returns gray for null/undefined', () => {
    const map = { A: 'bg-blue-100' } as const;
    expect(getEnumColor(null, map)).toBe('bg-gray-100 text-gray-800');
  });
});

describe('getBooleanColor', () => {
  it('returns green for true', () => {
    expect(getBooleanColor(true)).toBe('bg-green-100 text-green-800');
  });

  it('returns gray for false', () => {
    expect(getBooleanColor(false)).toBe('bg-gray-100 text-gray-800');
  });

  it('returns gray for null/undefined', () => {
    expect(getBooleanColor(null)).toBe('bg-gray-100 text-gray-800');
    expect(getBooleanColor(undefined)).toBe('bg-gray-100 text-gray-800');
  });
});
