import type { Tables } from '@altitutor/shared';
import {
  currentEnrolledClassIds,
  groupStudentClassesBySubject,
  isPreviousClassEnrollment,
} from '../classEnrollments';

const maths = { id: 'maths' } as Tables<'subjects'>;
const english = { id: 'english' } as Tables<'subjects'>;

function classItem(overrides: {
  classId: string;
  subject?: Tables<'subjects'>;
  unenrolledAt?: string | null;
  isPreviousEnrollment?: boolean;
}) {
  return {
    class: { id: overrides.classId },
    subject: overrides.subject,
    enrollment: { unenrolled_at: overrides.unenrolledAt ?? null },
    isPreviousEnrollment: overrides.isPreviousEnrollment,
  };
}

describe('isPreviousClassEnrollment', () => {
  const now = Date.parse('2026-09-03T00:00:00+09:30');

  it('treats a null unenrollment as current', () => {
    expect(isPreviousClassEnrollment(null, now)).toBe(false);
  });

  it('treats a future unenrollment as current', () => {
    expect(isPreviousClassEnrollment('2026-12-01T00:00:00+10:30', now)).toBe(false);
  });

  it('treats a past unenrollment as previous', () => {
    expect(isPreviousClassEnrollment('2026-03-01T00:00:00+10:30', now)).toBe(true);
  });
});

describe('currentEnrolledClassIds', () => {
  it('omits previous enrollments', () => {
    expect(
      currentEnrolledClassIds([
        classItem({ classId: 'current', isPreviousEnrollment: false }),
        classItem({ classId: 'previous', isPreviousEnrollment: true }),
      ])
    ).toEqual(['current']);
  });
});

describe('groupStudentClassesBySubject', () => {
  it('keeps assigned subjects even when they have no classes', () => {
    const groups = groupStudentClassesBySubject([], [maths], false);
    expect(groups).toEqual([
      {
        subjectId: 'maths',
        subject: maths,
        isAssignedSubject: true,
        classes: [],
      },
    ]);
  });

  it('hides previous enrollments until asked to show them', () => {
    const previous = classItem({
      classId: 'old-maths',
      subject: maths,
      unenrolledAt: '2026-03-01T00:00:00+10:30',
      isPreviousEnrollment: true,
    });
    const hidden = groupStudentClassesBySubject([previous], [maths], false);
    expect(hidden[0]?.classes).toEqual([]);

    const shown = groupStudentClassesBySubject([previous], [maths], true);
    expect(shown[0]?.classes).toEqual([previous]);
  });

  it('puts current cards before previous cards in a subject group', () => {
    const previous = classItem({
      classId: 'old-maths',
      subject: maths,
      isPreviousEnrollment: true,
      unenrolledAt: '2026-03-01T00:00:00+10:30',
    });
    const current = classItem({
      classId: 'new-maths',
      subject: maths,
      isPreviousEnrollment: false,
    });
    const groups = groupStudentClassesBySubject([previous, current], [maths], true);
    expect(groups[0]?.classes.map((item) => item.class.id)).toEqual(['new-maths', 'old-maths']);
  });

  it('keeps historical-only subjects when showing previous enrollments', () => {
    const previous = classItem({
      classId: 'old-english',
      subject: english,
      isPreviousEnrollment: true,
    });
    const groups = groupStudentClassesBySubject([previous], [maths], true);
    expect(groups.map((group) => group.subjectId)).toEqual(['maths', 'english']);
    expect(groups[1]).toMatchObject({
      subjectId: 'english',
      isAssignedSubject: false,
    });
  });
});
