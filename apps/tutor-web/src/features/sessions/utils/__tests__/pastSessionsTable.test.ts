import {
  collectPastSessionStaffOptions,
  collectPastSessionStudentOptions,
  collectPastSessionSubjectOptions,
  collectPastSessionTypeValues,
  filterPastSessions,
  matchesPastSessionFilters,
  matchesPastSessionSearch,
  parsePastSessionFiltersFromToolbar,
  pastSessionLocalDateKey,
  pastSessionsHaveActiveFilters,
} from '../pastSessionsTable';
import type { SessionStaff, SessionStudent } from '../session-helpers';

const staff = (overrides: Partial<SessionStaff> = {}): SessionStaff => ({
  id: 'staff-1',
  first_name: 'Jane',
  last_name: 'Tutor',
  role: 'TUTOR',
  ...overrides,
});

const student = (overrides: Partial<SessionStudent> = {}): SessionStudent => ({
  id: 'student-1',
  first_name: 'Alice',
  last_name: 'Chen',
  year_level: 12,
  ...overrides,
});

const session = {
  start_at: '2026-03-15T06:45:00.000Z',
  session_type: 'CLASS' as const,
  subject_id: 'subject-math',
  subject_curriculum: 'SACE',
  subject_year_level: 12,
  subject_name: 'Mathematics',
  class_level: 'Methods',
  staff: [staff()],
  students: [student()],
};

describe('matchesPastSessionSearch', () => {
  it('matches subject, staff, students, and ISO date', () => {
    expect(matchesPastSessionSearch(session, 'methods')).toBe(true);
    expect(matchesPastSessionSearch(session, 'jane')).toBe(true);
    expect(matchesPastSessionSearch(session, 'alice')).toBe(true);
    expect(matchesPastSessionSearch(session, '2026-03-15')).toBe(true);
  });

  it('rejects unrelated terms and accepts blank search', () => {
    expect(matchesPastSessionSearch(session, 'physics')).toBe(false);
    expect(matchesPastSessionSearch(session, '  ')).toBe(true);
  });
});

describe('matchesPastSessionFilters', () => {
  it('filters by type, subject, staff, and student', () => {
    expect(matchesPastSessionFilters(session, { types: ['CLASS'] })).toBe(true);
    expect(matchesPastSessionFilters(session, { types: ['CHECK_IN'] })).toBe(false);
    expect(matchesPastSessionFilters(session, { subjectIds: ['subject-math'] })).toBe(true);
    expect(matchesPastSessionFilters(session, { subjectIds: ['other'] })).toBe(false);
    expect(matchesPastSessionFilters(session, { staffIds: ['staff-1'] })).toBe(true);
    expect(matchesPastSessionFilters(session, { staffIds: ['staff-2'] })).toBe(false);
    expect(matchesPastSessionFilters(session, { studentIds: ['student-1'] })).toBe(true);
    expect(matchesPastSessionFilters(session, { studentIds: ['student-2'] })).toBe(false);
  });

  it('filters by inclusive local date range', () => {
    const dateKey = pastSessionLocalDateKey(session.start_at);
    expect(dateKey).toBeTruthy();
    expect(matchesPastSessionFilters(session, { from: dateKey, to: dateKey })).toBe(true);
    expect(matchesPastSessionFilters(session, { from: '2099-01-01' })).toBe(false);
    expect(matchesPastSessionFilters(session, { to: '2000-01-01' })).toBe(false);
  });
});

describe('filterPastSessions', () => {
  it('applies search and filters together', () => {
    const other = {
      ...session,
      session_id: 'other',
      subject_name: 'Physics',
      subject_id: 'subject-physics',
      students: [student({ id: 'student-2', first_name: 'Bob' })],
    };
    const result = filterPastSessions([session, other], 'alice', { types: ['CLASS'] });
    expect(result).toHaveLength(1);
    expect(result[0]?.subject_id).toBe('subject-math');
  });
});

describe('collectPastSession*Options', () => {
  it('collects unique sorted type, subject, staff, and student options', () => {
    const second = {
      ...session,
      session_type: 'CHECK_IN' as const,
      subject_id: 'subject-physics',
      subject_name: 'Physics',
      subject_curriculum: null,
      subject_year_level: null,
      class_level: null,
      staff: [staff({ id: 'staff-2', first_name: 'Sam', last_name: 'Helper' })],
      students: [student({ id: 'student-2', first_name: 'Bob', last_name: 'Lee' })],
    };

    expect(collectPastSessionTypeValues([session, second])).toEqual(['CHECK_IN', 'CLASS']);
    expect(collectPastSessionSubjectOptions([session, second]).map((o) => o.label)).toEqual([
      'Physics',
      'SACE Year 12 Mathematics Methods',
    ]);
    expect(collectPastSessionStaffOptions([session, second]).map((o) => o.label)).toEqual([
      'Jane Tutor',
      'Sam Helper',
    ]);
    expect(collectPastSessionStudentOptions([session, second]).map((o) => o.label)).toEqual([
      'Alice Chen',
      'Bob Lee',
    ]);
  });
});

describe('parsePastSessionFiltersFromToolbar', () => {
  it('reads toolbar filter keys', () => {
    expect(
      parsePastSessionFiltersFromToolbar({
        type: ['CLASS'],
        subject: ['subject-math'],
        staff: ['staff-1'],
        student: ['student-1'],
        from: ['2026-03-01'],
        to: ['2026-03-31'],
      }),
    ).toEqual({
      types: ['CLASS'],
      subjectIds: ['subject-math'],
      staffIds: ['staff-1'],
      studentIds: ['student-1'],
      from: '2026-03-01',
      to: '2026-03-31',
    });
  });
});

describe('pastSessionsHaveActiveFilters', () => {
  it('detects search or any selected filter', () => {
    expect(pastSessionsHaveActiveFilters('', {})).toBe(false);
    expect(pastSessionsHaveActiveFilters('math', {})).toBe(true);
    expect(pastSessionsHaveActiveFilters('', { types: ['CLASS'] })).toBe(true);
    expect(pastSessionsHaveActiveFilters('', { from: '2026-01-01' })).toBe(true);
  });
});
