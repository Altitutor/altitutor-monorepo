/**
 * Tests for filtering utilities
 * Tests staff and student filtering functions
 */

import {
  filterAvailableStaff,
  filterStudentsBySearch,
} from '../filtering';

describe('filterAvailableStaff', () => {
  const mockStaff = [
    { id: 'staff-1', name: 'John' },
    { id: 'staff-2', name: 'Jane' },
    { id: 'staff-3', name: 'Bob' },
  ];

  it('should filter out staff already in session', () => {
    const existingStaffIds = new Set(['staff-1', 'staff-3']);
    const result = filterAvailableStaff(mockStaff, existingStaffIds);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('staff-2');
  });

  it('should return all staff when none are in session', () => {
    const existingStaffIds = new Set<string>();
    const result = filterAvailableStaff(mockStaff, existingStaffIds);

    expect(result).toHaveLength(3);
    expect(result).toEqual(mockStaff);
  });

  it('should return empty array when all staff are in session', () => {
    const existingStaffIds = new Set(['staff-1', 'staff-2', 'staff-3']);
    const result = filterAvailableStaff(mockStaff, existingStaffIds);

    expect(result).toHaveLength(0);
  });

  it('should handle empty staff array', () => {
    const result = filterAvailableStaff([], new Set(['staff-1']));
    expect(result).toHaveLength(0);
  });

  it('should work with different object types', () => {
    const typedStaff = [
      { id: 'staff-1', first_name: 'John', last_name: 'Doe' },
      { id: 'staff-2', first_name: 'Jane', last_name: 'Smith' },
    ];

    const existingStaffIds = new Set(['staff-1']);
    const result = filterAvailableStaff(typedStaff, existingStaffIds);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('staff-2');
  });
});

describe('filterStudentsBySearch', () => {
  const mockStudents = [
    {
      id: 'student-1',
      first_name: 'John',
      last_name: 'Doe',
      status: 'ACTIVE',
    },
    {
      id: 'student-2',
      first_name: 'Jane',
      last_name: 'Smith',
      status: 'ACTIVE',
    },
    {
      id: 'student-3',
      first_name: 'Bob',
      last_name: 'Johnson',
      status: 'TRIAL',
    },
    {
      id: 'student-4',
      first_name: 'Alice',
      last_name: 'Williams',
      status: 'ACTIVE',
    },
  ];

  it('should return empty array for empty search query', () => {
    const result = filterStudentsBySearch(mockStudents, '', ['ACTIVE']);
    expect(result).toHaveLength(0);
  });

  it('should return empty array for whitespace-only query', () => {
    const result = filterStudentsBySearch(mockStudents, '   ', ['ACTIVE']);
    expect(result).toHaveLength(0);
  });

  it('should filter by first name', () => {
    const result = filterStudentsBySearch(mockStudents, 'John', ['ACTIVE']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('student-1');
  });

  it('should filter by last name', () => {
    const result = filterStudentsBySearch(mockStudents, 'Smith', ['ACTIVE']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('student-2');
  });

  it('should filter by full name', () => {
    const result = filterStudentsBySearch(mockStudents, 'John Doe', ['ACTIVE']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('student-1');
  });

  it('should be case insensitive', () => {
    const result = filterStudentsBySearch(mockStudents, 'JOHN', ['ACTIVE']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('student-1');
  });

  it('should filter by status', () => {
    const result = filterStudentsBySearch(mockStudents, 'Bob', ['ACTIVE']);
    expect(result).toHaveLength(0); // Bob is TRIAL, not ACTIVE
  });

  it('should include multiple statuses', () => {
    const result = filterStudentsBySearch(mockStudents, 'Bob', ['ACTIVE', 'TRIAL']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('student-3');
  });

  it('should apply limit when specified', () => {
    const result = filterStudentsBySearch(mockStudents, 'a', ['ACTIVE'], 2);
    expect(result).toHaveLength(2);
  });

  it('should return all matches when limit is not specified', () => {
    const result = filterStudentsBySearch(mockStudents, 'a', ['ACTIVE']);
    // Should match: Jane, Alice (both have 'a' in first or last name)
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle students with null names', () => {
    const studentsWithNulls = [
      {
        id: 'student-1',
        first_name: null,
        last_name: 'Doe',
        status: 'ACTIVE',
      },
      {
        id: 'student-2',
        first_name: 'Jane',
        last_name: null,
        status: 'ACTIVE',
      },
    ];

    const result1 = filterStudentsBySearch(studentsWithNulls, 'Doe', ['ACTIVE']);
    expect(result1).toHaveLength(1);
    expect(result1[0].id).toBe('student-1');

    const result2 = filterStudentsBySearch(studentsWithNulls, 'Jane', ['ACTIVE']);
    expect(result2).toHaveLength(1);
    expect(result2[0].id).toBe('student-2');
  });

  it('should handle partial matches', () => {
    const result = filterStudentsBySearch(mockStudents, 'Joh', ['ACTIVE']);
    expect(result).toHaveLength(1); // John Doe (Bob Johnson is TRIAL, not ACTIVE)
    expect(result[0].id).toBe('student-1');
    
    // Test with multiple statuses to get both
    const resultWithMultipleStatuses = filterStudentsBySearch(mockStudents, 'Joh', ['ACTIVE', 'TRIAL']);
    expect(resultWithMultipleStatuses).toHaveLength(2); // John Doe and Bob Johnson
  });

  it('should handle empty students array', () => {
    const result = filterStudentsBySearch([], 'John', ['ACTIVE']);
    expect(result).toHaveLength(0);
  });
});
