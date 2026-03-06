/**
 * Tests for table sorting utilities
 * Tests sorting and filtering functions for students and classes
 */

import {
  sortStudentsByStatus,
  filterClassesBySearch,
  filterClassesByDay,
  sortClassesByDayAndTime,
} from '../tableSorting';
import type { Tables } from '@altitutor/shared';

describe('sortStudentsByStatus', () => {
  const mockStudents: Tables<'students'>[] = [
    {
      id: 'student-1',
      first_name: 'Alice',
      last_name: 'Doe',
      status: 'ACTIVE',
      curriculum: null,
      year_level: null,
      school: null,
      email: null,
      phone: null,
      active_at: null,
      registered_at: null,
      discontinued_at: null,
      created_at: null,
      updated_at: null,
      availability_monday: null,
      availability_tuesday: null,
      availability_wednesday: null,
      availability_thursday: null,
      availability_friday: null,
      availability_saturday_am: null,
      availability_saturday_pm: null,
      availability_sunday_am: null,
      availability_sunday_pm: null,
      created_by: null,
      user_id: null,
      invite_token: null,
      welcome_modal_acknowledged_at: null,
    },
    {
      id: 'student-2',
      first_name: 'Bob',
      last_name: 'Smith',
      status: 'TRIAL',
      curriculum: null,
      year_level: null,
      school: null,
      email: null,
      phone: null,
      active_at: null,
      registered_at: null,
      discontinued_at: null,
      created_at: null,
      updated_at: null,
      availability_monday: null,
      availability_tuesday: null,
      availability_wednesday: null,
      availability_thursday: null,
      availability_friday: null,
      availability_saturday_am: null,
      availability_saturday_pm: null,
      availability_sunday_am: null,
      availability_sunday_pm: null,
      created_by: null,
      user_id: null,
      invite_token: null,
      welcome_modal_acknowledged_at: null,
    },
    {
      id: 'student-3',
      first_name: 'Charlie',
      last_name: 'Brown',
      status: 'ACTIVE',
      curriculum: null,
      year_level: null,
      school: null,
      email: null,
      phone: null,
      active_at: null,
      registered_at: null,
      discontinued_at: null,
      created_at: null,
      updated_at: null,
      availability_monday: null,
      availability_tuesday: null,
      availability_wednesday: null,
      availability_thursday: null,
      availability_friday: null,
      availability_saturday_am: null,
      availability_saturday_pm: null,
      availability_sunday_am: null,
      availability_sunday_pm: null,
      created_by: null,
      user_id: null,
      invite_token: null,
      welcome_modal_acknowledged_at: null,
    },
  ];

  it('should sort students by status ascending', () => {
    const result = sortStudentsByStatus(mockStudents, 'asc');
    expect(result[0].status).toBe('ACTIVE');
    expect(result[1].status).toBe('ACTIVE');
    expect(result[2].status).toBe('TRIAL');
  });

  it('should sort students by status descending', () => {
    const result = sortStudentsByStatus(mockStudents, 'desc');
    expect(result[0].status).toBe('TRIAL');
    expect(result[1].status).toBe('ACTIVE');
    expect(result[2].status).toBe('ACTIVE');
  });

  it('should sort by first_name when statuses are equal', () => {
    const result = sortStudentsByStatus(mockStudents, 'asc');
    // Both ACTIVE students should be sorted by first_name
    expect(result[0].first_name).toBe('Alice');
    expect(result[1].first_name).toBe('Charlie');
  });

  it('should handle empty array', () => {
    expect(sortStudentsByStatus([], 'asc')).toEqual([]);
  });

  it('should handle null status values', () => {
    const studentsWithNullStatus = [
      { ...mockStudents[0], status: null },
      { ...mockStudents[1], status: 'ACTIVE' },
    ] as Tables<'students'>[];

    const result = sortStudentsByStatus(studentsWithNullStatus, 'asc');
    expect(result.length).toBe(2);
  });
});

describe('filterClassesBySearch', () => {
  const mockClasses: Tables<'classes'>[] = [
    {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1,
      start_time: '10:00',
      end_time: '11:00',
      level: 'Year 10',
      room: null,
      status: 'ACTIVE',
      session_start_date: null,
      session_end_date: null,
      created_at: null,
      updated_at: null,
      created_by: null,
    },
    {
      id: 'class-2',
      subject_id: 'subject-2',
      day_of_week: 2,
      start_time: '14:00',
      end_time: '15:00',
      level: null,
      room: null,
      status: 'ACTIVE',
      session_start_date: null,
      session_end_date: null,
      created_at: null,
      updated_at: null,
      created_by: null,
    },
  ];

  const getSubjectDisplay = (cls: Tables<'classes'>) => {
    if (cls.subject_id === 'subject-1') return 'Mathematics';
    if (cls.subject_id === 'subject-2') return 'English';
    return '';
  };

  it('should filter classes by search term', () => {
    const result = filterClassesBySearch(mockClasses, 'math', getSubjectDisplay);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('class-1');
  });

  it('should be case insensitive', () => {
    const result = filterClassesBySearch(mockClasses, 'MATH', getSubjectDisplay);
    expect(result).toHaveLength(1);
  });

  it('should return all classes when search term is empty', () => {
    const result = filterClassesBySearch(mockClasses, '', getSubjectDisplay);
    expect(result).toEqual(mockClasses);
  });

  it('should return empty array when no matches', () => {
    const result = filterClassesBySearch(mockClasses, 'Science', getSubjectDisplay);
    expect(result).toHaveLength(0);
  });
});

describe('filterClassesByDay', () => {
  const mockClasses: Tables<'classes'>[] = [
    {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1, // Monday
      start_time: '10:00',
      end_time: '11:00',
      level: null,
      room: null,
      status: 'ACTIVE',
      session_start_date: null,
      session_end_date: null,
      created_at: null,
      updated_at: null,
      created_by: null,
    },
    {
      id: 'class-2',
      subject_id: 'subject-2',
      day_of_week: 2, // Tuesday
      start_time: '14:00',
      end_time: '15:00',
      level: null,
      room: null,
      status: 'ACTIVE',
      session_start_date: null,
      session_end_date: null,
      created_at: null,
      updated_at: null,
      created_by: null,
    },
    {
      id: 'class-3',
      subject_id: 'subject-3',
      day_of_week: 1, // Monday
      start_time: '15:00',
      end_time: '16:00',
      level: null,
      room: null,
      status: 'ACTIVE',
      session_start_date: null,
      session_end_date: null,
      created_at: null,
      updated_at: null,
      created_by: null,
    },
  ];

  it('should filter classes by day of week', () => {
    const result = filterClassesByDay(mockClasses, [1]);
    expect(result).toHaveLength(2);
    expect(result.every(cls => cls.day_of_week === 1)).toBe(true);
  });

  it('should filter by multiple days', () => {
    const result = filterClassesByDay(mockClasses, [1, 2]);
    expect(result).toHaveLength(3);
  });

  it('should return all classes when filter is empty', () => {
    const result = filterClassesByDay(mockClasses, []);
    expect(result).toEqual(mockClasses);
  });

  it('should return empty array when no matches', () => {
    const result = filterClassesByDay(mockClasses, [5]);
    expect(result).toHaveLength(0);
  });
});

describe('sortClassesByDayAndTime', () => {
  const mockClasses: Tables<'classes'>[] = [
    {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 2, // Tuesday
      start_time: '14:00',
      end_time: '15:00',
      level: null,
      room: null,
      status: 'ACTIVE',
      session_start_date: null,
      session_end_date: null,
      created_at: null,
      updated_at: null,
      created_by: null,
    },
    {
      id: 'class-2',
      subject_id: 'subject-2',
      day_of_week: 1, // Monday
      start_time: '15:00',
      end_time: '16:00',
      level: null,
      room: null,
      status: 'ACTIVE',
      session_start_date: null,
      session_end_date: null,
      created_at: null,
      updated_at: null,
      created_by: null,
    },
    {
      id: 'class-3',
      subject_id: 'subject-3',
      day_of_week: 1, // Monday
      start_time: '10:00',
      end_time: '11:00',
      level: null,
      room: null,
      status: 'ACTIVE',
      session_start_date: null,
      session_end_date: null,
      created_at: null,
      updated_at: null,
      created_by: null,
    },
    {
      id: 'class-4',
      subject_id: 'subject-4',
      day_of_week: 0, // Sunday (should be last)
      start_time: '09:00',
      end_time: '10:00',
      level: null,
      room: null,
      status: 'ACTIVE',
      session_start_date: null,
      session_end_date: null,
      created_at: null,
      updated_at: null,
      created_by: null,
    },
  ];

  it('should sort classes by day of week (Monday first)', () => {
    const result = sortClassesByDayAndTime(mockClasses);
    expect(result[0].day_of_week).toBe(1); // Monday
    expect(result[1].day_of_week).toBe(1); // Monday
    expect(result[2].day_of_week).toBe(2); // Tuesday
    expect(result[3].day_of_week).toBe(0); // Sunday (last)
  });

  it('should sort by start time when same day', () => {
    const result = sortClassesByDayAndTime(mockClasses);
    // Both Monday classes should be sorted by time
    const mondayClasses = result.filter(cls => cls.day_of_week === 1);
    expect(mondayClasses[0].start_time).toBe('10:00');
    expect(mondayClasses[1].start_time).toBe('15:00');
  });

  it('should place Sunday at the end', () => {
    const result = sortClassesByDayAndTime(mockClasses);
    expect(result[result.length - 1].day_of_week).toBe(0); // Sunday
  });

  it('should handle empty array', () => {
    expect(sortClassesByDayAndTime([])).toEqual([]);
  });

  it('should handle classes with same day and time', () => {
    const duplicateClasses: Tables<'classes'>[] = [
      {
        id: 'class-1',
        subject_id: 'subject-1',
        day_of_week: 1,
        start_time: '10:00',
        end_time: '11:00',
        level: null,
        room: null,
        status: 'ACTIVE',
        session_start_date: null,
        session_end_date: null,
        created_at: null,
        updated_at: null,
        created_by: null,
      },
      {
        id: 'class-2',
        subject_id: 'subject-2',
        day_of_week: 1,
        start_time: '10:00',
        end_time: '11:00',
        level: null,
        room: null,
        status: 'ACTIVE',
        session_start_date: null,
        session_end_date: null,
        created_at: null,
        updated_at: null,
        created_by: null,
      },
    ];

    const result = sortClassesByDayAndTime(duplicateClasses);
    expect(result).toHaveLength(2);
  });
});
