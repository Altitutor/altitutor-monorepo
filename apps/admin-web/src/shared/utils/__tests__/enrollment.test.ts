/**
 * Tests for enrollment utilities
 * Tests time overlap checking and date validation functions
 */

import {
  checkTimeOverlap,
  isDateTodayOrFuture,
  getMidnightAdelaide,
  getEnrollmentConflicts,
} from '../enrollment';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

// Mock Supabase client
jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

describe('checkTimeOverlap', () => {
  it('should return false for classes on different days', () => {
    const class1: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '10:00',
      end_time: '11:00',
    };
    
    const class2: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 2, // Tuesday
      start_time: '10:00',
      end_time: '11:00',
    };
    
    expect(checkTimeOverlap(class1, class2)).toBe(false);
  });

  it('should return true for overlapping times on same day', () => {
    const class1: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '10:00',
      end_time: '11:00',
    };
    
    const class2: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '10:30',
      end_time: '11:30',
    };
    
    expect(checkTimeOverlap(class1, class2)).toBe(true);
  });

  it('should return false when one class ends exactly when another starts', () => {
    const class1: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '10:00',
      end_time: '11:00',
    };
    
    const class2: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '11:00',
      end_time: '12:00',
    };
    
    expect(checkTimeOverlap(class1, class2)).toBe(false);
  });

  it('should return true when one class completely contains another', () => {
    const class1: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '10:00',
      end_time: '12:00',
    };
    
    const class2: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '10:30',
      end_time: '11:30',
    };
    
    expect(checkTimeOverlap(class1, class2)).toBe(true);
  });

  it('should return false for non-overlapping times on same day', () => {
    const class1: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '10:00',
      end_time: '11:00',
    };
    
    const class2: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '14:00',
      end_time: '15:00',
    };
    
    expect(checkTimeOverlap(class1, class2)).toBe(false);
  });

  it('should handle times that span across hours correctly', () => {
    const class1: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '09:30',
      end_time: '10:45',
    };
    
    const class2: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'> = {
      day_of_week: 1, // Monday
      start_time: '10:00',
      end_time: '11:00',
    };
    
    expect(checkTimeOverlap(class1, class2)).toBe(true);
  });
});

describe('isDateTodayOrFuture', () => {
  beforeEach(() => {
    // Mock Date.now() to a fixed date for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return true for today', () => {
    const today = new Date('2024-01-15T12:00:00Z');
    expect(isDateTodayOrFuture(today)).toBe(true);
  });

  it('should return true for future dates', () => {
    const futureDate = new Date('2024-01-16T12:00:00Z');
    expect(isDateTodayOrFuture(futureDate)).toBe(true);
  });

  it('should return false for past dates', () => {
    const pastDate = new Date('2024-01-14T12:00:00Z');
    expect(isDateTodayOrFuture(pastDate)).toBe(false);
  });

  it('should handle dates at midnight correctly', () => {
    const todayMidnight = new Date('2024-01-15T00:00:00Z');
    expect(isDateTodayOrFuture(todayMidnight)).toBe(true);
    
    const tomorrowMidnight = new Date('2024-01-16T00:00:00Z');
    expect(isDateTodayOrFuture(tomorrowMidnight)).toBe(true);
    
    const yesterdayMidnight = new Date('2024-01-14T00:00:00Z');
    expect(isDateTodayOrFuture(yesterdayMidnight)).toBe(false);
  });

  it('should ignore time component and compare dates only', () => {
    const todayMorning = new Date('2024-01-15T08:00:00Z');
    const todayEvening = new Date('2024-01-15T20:00:00Z');
    
    expect(isDateTodayOrFuture(todayMorning)).toBe(true);
    expect(isDateTodayOrFuture(todayEvening)).toBe(true);
  });
});

describe('getMidnightAdelaide', () => {
  it('should return midnight for a given date', () => {
    const date = new Date('2024-01-15T14:30:00');
    const result = getMidnightAdelaide(date);
    
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('should preserve year, month, and day', () => {
    const date = new Date('2024-01-15T14:30:00');
    const result = getMidnightAdelaide(date);
    
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(0); // January (0-indexed)
    expect(result.getDate()).toBe(15);
  });

  it('should handle dates at different times of day', () => {
    const morning = new Date('2024-01-15T08:00:00');
    const afternoon = new Date('2024-01-15T15:30:00');
    const evening = new Date('2024-01-15T22:45:00');
    
    const morningMidnight = getMidnightAdelaide(morning);
    const afternoonMidnight = getMidnightAdelaide(afternoon);
    const eveningMidnight = getMidnightAdelaide(evening);
    
    expect(morningMidnight.getTime()).toBe(afternoonMidnight.getTime());
    expect(afternoonMidnight.getTime()).toBe(eveningMidnight.getTime());
  });

  it('should handle edge cases like month boundaries', () => {
    const lastDayOfMonth = new Date('2024-01-31T23:59:59');
    const result = getMidnightAdelaide(lastDayOfMonth);
    
    expect(result.getDate()).toBe(31);
    expect(result.getMonth()).toBe(0);
    expect(result.getHours()).toBe(0);
  });
});

describe('getEnrollmentConflicts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return no conflicts when target class does not exist', async () => {
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const result = await getEnrollmentConflicts('student-1', 'class-1', new Date());

    expect(result).toEqual({
      sameSubjectWarning: null,
      timeOverlapWarnings: [],
    });
  });

  it('should return no conflicts when student has no enrollments', async () => {
    const targetClass = {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1,
      start_time: '10:00',
      end_time: '11:00',
      subject: { id: 'subject-1', name: 'Mathematics' },
    };

    const mockSelectTarget = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: targetClass,
          error: null,
        }),
      }),
    });

    const mockSelectEnrollments = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'classes') {
          return { select: mockSelectTarget };
        }
        if (table === 'classes_students') {
          return { select: mockSelectEnrollments };
        }
        return { select: jest.fn() };
      }),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const result = await getEnrollmentConflicts('student-1', 'class-1', new Date());

    expect(result).toEqual({
      sameSubjectWarning: null,
      timeOverlapWarnings: [],
    });
  });

  it('should detect same subject warning', async () => {
    const targetClass = {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1,
      start_time: '10:00',
      end_time: '11:00',
      subject: { id: 'subject-1', name: 'Mathematics' },
    };

    const enrolledClass = {
      id: 'class-2',
      subject_id: 'subject-1',
      day_of_week: 2, // Different day, so no time overlap
      start_time: '10:00',
      end_time: '11:00',
      subject: { id: 'subject-1', name: 'Mathematics' },
    };

    const mockSelectTarget = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: targetClass,
          error: null,
        }),
      }),
    });

    const mockSelectEnrollments = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: [
              {
                class_id: 'class-2',
                student_id: 'student-1',
                class: enrolledClass,
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'classes') {
          return { select: mockSelectTarget };
        }
        if (table === 'classes_students') {
          return { select: mockSelectEnrollments };
        }
        return { select: jest.fn() };
      }),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const result = await getEnrollmentConflicts('student-1', 'class-1', new Date());

    expect(result.sameSubjectWarning).toBe('Student is already enrolled in another Mathematics class');
    expect(result.timeOverlapWarnings).toEqual([]);
  });

  it('should detect time overlap warnings', async () => {
    const targetClass = {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1, // Monday
      start_time: '10:00',
      end_time: '11:00',
      subject: { id: 'subject-1', name: 'Mathematics' },
    };

    const enrolledClass = {
      id: 'class-2',
      subject_id: 'subject-2', // Different subject
      day_of_week: 1, // Same day
      start_time: '10:30', // Overlaps with target class
      end_time: '11:30',
      subject: { id: 'subject-2', name: 'English' },
    };

    const mockSelectTarget = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: targetClass,
          error: null,
        }),
      }),
    });

    const mockSelectEnrollments = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: [
              {
                class_id: 'class-2',
                student_id: 'student-1',
                class: enrolledClass,
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'classes') {
          return { select: mockSelectTarget };
        }
        if (table === 'classes_students') {
          return { select: mockSelectEnrollments };
        }
        return { select: jest.fn() };
      }),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const result = await getEnrollmentConflicts('student-1', 'class-1', new Date());

    expect(result.sameSubjectWarning).toBeNull();
    expect(result.timeOverlapWarnings).toHaveLength(1);
    expect(result.timeOverlapWarnings[0]).toContain('Time conflict with English class on Monday');
    expect(result.timeOverlapWarnings[0]).toContain('10:30-11:30');
  });

  it('should detect both same subject and time overlap', async () => {
    const targetClass = {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1,
      start_time: '10:00',
      end_time: '11:00',
      subject: { id: 'subject-1', name: 'Mathematics' },
    };

    const enrolledClass = {
      id: 'class-2',
      subject_id: 'subject-1', // Same subject
      day_of_week: 1, // Same day
      start_time: '10:30', // Overlaps
      end_time: '11:30',
      subject: { id: 'subject-1', name: 'Mathematics' },
    };

    const mockSelectTarget = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: targetClass,
          error: null,
        }),
      }),
    });

    const mockSelectEnrollments = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: [
              {
                class_id: 'class-2',
                student_id: 'student-1',
                class: enrolledClass,
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'classes') {
          return { select: mockSelectTarget };
        }
        if (table === 'classes_students') {
          return { select: mockSelectEnrollments };
        }
        return { select: jest.fn() };
      }),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const result = await getEnrollmentConflicts('student-1', 'class-1', new Date());

    expect(result.sameSubjectWarning).toBe('Student is already enrolled in another Mathematics class');
    expect(result.timeOverlapWarnings).toHaveLength(1);
    expect(result.timeOverlapWarnings[0]).toContain('Time conflict with Mathematics class');
  });

  it('should handle multiple time overlap warnings', async () => {
    const targetClass = {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1,
      start_time: '10:00',
      end_time: '11:00',
      subject: { id: 'subject-1', name: 'Mathematics' },
    };

    const enrolledClass1 = {
      id: 'class-2',
      subject_id: 'subject-2',
      day_of_week: 1,
      start_time: '10:30',
      end_time: '11:30',
      subject: { id: 'subject-2', name: 'English' },
    };

    const enrolledClass2 = {
      id: 'class-3',
      subject_id: 'subject-3',
      day_of_week: 1,
      start_time: '09:30',
      end_time: '10:30',
      subject: { id: 'subject-3', name: 'Science' },
    };

    const mockSelectTarget = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: targetClass,
          error: null,
        }),
      }),
    });

    const mockSelectEnrollments = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: [
              {
                class_id: 'class-2',
                student_id: 'student-1',
                class: enrolledClass1,
              },
              {
                class_id: 'class-3',
                student_id: 'student-1',
                class: enrolledClass2,
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'classes') {
          return { select: mockSelectTarget };
        }
        if (table === 'classes_students') {
          return { select: mockSelectEnrollments };
        }
        return { select: jest.fn() };
      }),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const result = await getEnrollmentConflicts('student-1', 'class-1', new Date());

    expect(result.timeOverlapWarnings).toHaveLength(2);
    expect(result.timeOverlapWarnings.some(w => w.includes('English'))).toBe(true);
    expect(result.timeOverlapWarnings.some(w => w.includes('Science'))).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockRejectedValue(new Error('Database error')),
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getEnrollmentConflicts('student-1', 'class-1', new Date());

    expect(result).toEqual({
      sameSubjectWarning: null,
      timeOverlapWarnings: [],
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle missing subject name gracefully', async () => {
    const targetClass = {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1,
      start_time: '10:00',
      end_time: '11:00',
      subject: { id: 'subject-1', name: 'Mathematics' },
    };

    const enrolledClass = {
      id: 'class-2',
      subject_id: 'subject-2',
      day_of_week: 1,
      start_time: '10:30',
      end_time: '11:30',
      subject: null, // Missing subject
    };

    const mockSelectTarget = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: targetClass,
          error: null,
        }),
      }),
    });

    const mockSelectEnrollments = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: [
              {
                class_id: 'class-2',
                student_id: 'student-1',
                class: enrolledClass,
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'classes') {
          return { select: mockSelectTarget };
        }
        if (table === 'classes_students') {
          return { select: mockSelectEnrollments };
        }
        return { select: jest.fn() };
      }),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const result = await getEnrollmentConflicts('student-1', 'class-1', new Date());

    expect(result.timeOverlapWarnings[0]).toContain('Unknown');
  });

  it('should exclude target class from enrollment checks', async () => {
    const targetClass = {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1,
      start_time: '10:00',
      end_time: '11:00',
      subject: { id: 'subject-1', name: 'Mathematics' },
    };

    const mockSelectTarget = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: targetClass,
          error: null,
        }),
      }),
    });

    const mockSelectEnrollments = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'classes') {
          return { select: mockSelectTarget };
        }
        if (table === 'classes_students') {
          return { select: mockSelectEnrollments };
        }
        return { select: jest.fn() };
      }),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const result = await getEnrollmentConflicts('student-1', 'class-1', new Date());

    expect(result).toEqual({
      sameSubjectWarning: null,
      timeOverlapWarnings: [],
    });

    // Verify that neq was called to exclude the target class
    const neqCall = mockSelectEnrollments().eq().or().neq;
    expect(neqCall).toHaveBeenCalledWith('class_id', 'class-1');
  });
});
