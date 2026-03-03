/**
 * Tests for variableReplacerParent utility
 * Tests replaceVariablesForParent and replaceVariablesForParentLegacy
 */

import {
  replaceVariablesForParent,
  replaceVariablesForParentLegacy,
  type StudentWithClasses,
} from '../variableReplacerParent';
import type { Tables } from '@altitutor/shared';

jest.mock('@/shared/utils/invites', () => ({
  getInviteUrlForStudent: jest.fn((token: string, path: string) =>
    `https://student.example.com/${path}/${token}`
  ),
}));

const getInviteUrlForStudent = jest.requireMock<{
  getInviteUrlForStudent: (token: string, path: 'invite' | 'register') => string;
}>('@/shared/utils/invites').getInviteUrlForStudent;

function createParent(overrides: Partial<Tables<'parents'>> = {}): Tables<'parents'> {
  return {
    id: 'parent-1',
    first_name: 'Jane',
    last_name: 'Smith',
    email: null,
    phone: null,
    user_id: null,
    invite_token: null,
    created_by: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function createStudent(overrides: Partial<Tables<'students'>> = {}): Tables<'students'> {
  return {
    id: 'student-1',
    first_name: 'Alice',
    last_name: 'Johnson',
    ...overrides,
  } as Tables<'students'>;
}

function createClass(overrides: Partial<Tables<'classes'>> = {}): Tables<'classes'> {
  return {
    id: 'class-1',
    day_of_week: 1, // Monday
    start_time: '14:00:00',
    end_time: '16:00:00',
    status: 'ACTIVE',
    subject_id: 'subject-1',
    ...overrides,
  } as Tables<'classes'>;
}

function createSubject(overrides: Partial<Tables<'subjects'>> = {}): Tables<'subjects'> {
  return {
    id: 'subject-1',
    long_name: 'SACE 12 Mathematics',
    short_name: '12MATH',
    name: 'Mathematics',
    ...overrides,
  } as Tables<'subjects'>;
}

function createStudentWithClasses(
  overrides: Partial<StudentWithClasses> = {}
): StudentWithClasses {
  const student = createStudent(overrides.student as Partial<Tables<'students'>>);
  const cls = createClass(overrides.classes?.[0]?.class as Partial<Tables<'classes'>>);
  const subject = createSubject(overrides.classes?.[0]?.subject ?? undefined);
  return {
    student: overrides.student ?? student,
    classes: overrides.classes ?? [{ class: cls, subject }],
    classesWithStartDates: overrides.classesWithStartDates,
    linkTokens: overrides.linkTokens,
  };
}

describe('replaceVariablesForParent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parent variables', () => {
    it('should replace {parent_first_name}', async () => {
      const parent = createParent({ first_name: 'Jane' });
      const result = await replaceVariablesForParent(
        'Hi {parent_first_name}!',
        parent,
        []
      );
      expect(result).toBe('Hi Jane!');
    });

    it('should replace {parent_full_name}', async () => {
      const parent = createParent({ first_name: 'Jane', last_name: 'Smith' });
      const result = await replaceVariablesForParent(
        'Dear {parent_full_name},',
        parent,
        []
      );
      expect(result).toBe('Dear Jane Smith,');
    });

    it('should replace {sender_name}', async () => {
      const parent = createParent();
      const result = await replaceVariablesForParent(
        'From {sender_name}',
        parent,
        [],
        'Admin Team'
      );
      expect(result).toBe('From Admin Team');
    });

    it('should replace parent variables case-insensitively', async () => {
      const parent = createParent({ first_name: 'Jane', last_name: 'Smith' });
      const result = await replaceVariablesForParent(
        '{PARENT_FIRST_NAME} {Parent_Full_Name}',
        parent,
        []
      );
      expect(result).toBe('Jane Jane Smith');
    });

    it('should use empty string when parent first_name is empty', async () => {
      const parent = createParent({ first_name: '' });
      const result = await replaceVariablesForParent(
        'Hi {parent_first_name}!',
        parent,
        []
      );
      expect(result).toBe('Hi !');
    });

    it('should use empty string when sender_name is null', async () => {
      const parent = createParent();
      const result = await replaceVariablesForParent(
        'From {sender_name}',
        parent,
        [],
        undefined
      );
      expect(result).toBe('From ');
    });
  });

  describe('student sub-variables', () => {
    it('should replace {parent.student1.first_name}', async () => {
      const parent = createParent();
      const students = [
        createStudentWithClasses({ student: createStudent({ first_name: 'Alice' }) }),
      ];
      const result = await replaceVariablesForParent(
        'Hi {parent.student1.first_name}!',
        parent,
        students
      );
      expect(result).toBe('Hi Alice!');
    });

    it('should replace {parent.student1.full_name}', async () => {
      const parent = createParent();
      const students = [
        createStudentWithClasses({
          student: createStudent({ first_name: 'Alice', last_name: 'Johnson' }),
        }),
      ];
      const result = await replaceVariablesForParent(
        'Student: {parent.student1.full_name}',
        parent,
        students
      );
      expect(result).toBe('Student: Alice Johnson');
    });

    it('should replace {parent.student1.classes}', async () => {
      const parent = createParent();
      const students = [
        createStudentWithClasses({
          classes: [
            {
              class: createClass({ day_of_week: 1, start_time: '14:00:00', end_time: '16:00:00' }),
              subject: createSubject({ long_name: 'SACE 12 Mathematics' }),
            },
          ],
        }),
      ];
      const result = await replaceVariablesForParent(
        'Classes:\n{parent.student1.classes}',
        parent,
        students
      );
      expect(result).toContain('- SACE 12 Mathematics Mon 2:00 PM - 4:00 PM');
    });

    it('should replace {parent.student1.classes} with "No classes enrolled" when empty', async () => {
      const parent = createParent();
      const students = [
        createStudentWithClasses({ classes: [] }),
      ];
      const result = await replaceVariablesForParent(
        'Classes: {parent.student1.classes}',
        parent,
        students
      );
      expect(result).toBe('Classes: No classes enrolled');
    });

    it('should replace {parent.student1.classes_with_start_date}', async () => {
      const parent = createParent();
      const startDate = new Date('2025-02-11'); // Tue 11th Feb
      const students = [
        createStudentWithClasses({
          classesWithStartDates: [
            {
              class: createClass({ day_of_week: 2 }),
              subject: createSubject({ long_name: 'SACE 12 Mathematics' }),
              startDate,
            },
          ],
        }),
      ];
      const result = await replaceVariablesForParent(
        'Classes: {parent.student1.classes_with_start_date}',
        parent,
        students
      );
      expect(result).toContain('starting on Tue 11th Feb');
    });

    it('should replace {parent.student1.registration_link} using getInviteUrlForStudent', async () => {
      const parent = createParent();
      const students = [
        createStudentWithClasses({
          linkTokens: { registrationToken: 'reg-token-123' },
        }),
      ];
      const result = await replaceVariablesForParent(
        'Register: {parent.student1.registration_link}',
        parent,
        students
      );
      expect(getInviteUrlForStudent).toHaveBeenCalledWith('reg-token-123', 'register');
      expect(result).toBe('Register: https://student.example.com/register/reg-token-123');
    });

    it('should replace {parent.student1.invite_link} using getInviteUrlForStudent', async () => {
      const parent = createParent();
      const students = [
        createStudentWithClasses({
          linkTokens: { inviteToken: 'invite-token-456' },
        }),
      ];
      const result = await replaceVariablesForParent(
        'Invite: {parent.student1.invite_link}',
        parent,
        students
      );
      expect(getInviteUrlForStudent).toHaveBeenCalledWith('invite-token-456', 'invite');
      expect(result).toBe('Invite: https://student.example.com/invite/invite-token-456');
    });

    it('should replace {parent.student1.forgot_password_link}', async () => {
      const parent = createParent();
      const students = [
        createStudentWithClasses({
          linkTokens: { forgotPasswordLink: 'https://example.com/reset-password' },
        }),
      ];
      const result = await replaceVariablesForParent(
        'Reset: {parent.student1.forgot_password_link}',
        parent,
        students
      );
      expect(result).toBe('Reset: https://example.com/reset-password');
    });

    it('should replace {parent.student2.*} for second student', async () => {
      const parent = createParent();
      const students = [
        createStudentWithClasses({ student: createStudent({ first_name: 'Alice' }) }),
        createStudentWithClasses({ student: createStudent({ first_name: 'Bob' }) }),
      ];
      const result = await replaceVariablesForParent(
        'Students: {parent.student1.first_name} and {parent.student2.first_name}',
        parent,
        students
      );
      expect(result).toBe('Students: Alice and Bob');
    });

    it('should use empty string when registration_link token is missing', async () => {
      const parent = createParent();
      const students = [
        createStudentWithClasses({ linkTokens: {} }),
      ];
      const result = await replaceVariablesForParent(
        'Register: {parent.student1.registration_link}',
        parent,
        students
      );
      expect(getInviteUrlForStudent).not.toHaveBeenCalled();
      expect(result).toBe('Register: ');
    });

    it('should use empty string when invite_link token is missing', async () => {
      const parent = createParent();
      const students = [
        createStudentWithClasses({ linkTokens: {} }),
      ];
      const result = await replaceVariablesForParent(
        'Invite: {parent.student1.invite_link}',
        parent,
        students
      );
      expect(getInviteUrlForStudent).not.toHaveBeenCalled();
      expect(result).toBe('Invite: ');
    });
  });

  describe('invalid student index', () => {
    it('should replace invalid student index with empty string', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const parent = createParent();
      const students = [
        createStudentWithClasses({ student: createStudent({ first_name: 'Alice' }) }),
      ];
      const result = await replaceVariablesForParent(
        'Hi {parent.student5.first_name}!',
        parent,
        students
      );
      expect(result).toBe('Hi !');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid student index 5 for parent parent-1'
      );
      consoleSpy.mockRestore();
    });

    it('should replace student0 (index -1) with empty string', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const parent = createParent();
      const students = [
        createStudentWithClasses({ student: createStudent({ first_name: 'Alice' }) }),
      ];
      const result = await replaceVariablesForParent(
        'Hi {parent.student0.first_name}!',
        parent,
        students
      );
      expect(result).toBe('Hi !');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid student index 0 for parent parent-1'
      );
      consoleSpy.mockRestore();
    });

    it('should replace student index beyond array length with empty string', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const parent = createParent();
      const students = [
        createStudentWithClasses({ student: createStudent({ first_name: 'Alice' }) }),
      ];
      const result = await replaceVariablesForParent(
        'Hi {parent.student2.first_name}!',
        parent,
        students
      );
      expect(result).toBe('Hi !');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid student index 2 for parent parent-1'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('unknown variable', () => {
    it('should replace unknown student variable with empty string', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const parent = createParent();
      const students = [
        createStudentWithClasses({ student: createStudent({ first_name: 'Alice' }) }),
      ];
      const result = await replaceVariablesForParent(
        'Hi {parent.student1.unknown_var}!',
        parent,
        students
      );
      expect(result).toBe('Hi !');
      expect(consoleSpy).toHaveBeenCalledWith('Unknown student variable: unknown_var');
      consoleSpy.mockRestore();
    });
  });

  describe('combined', () => {
    it('should replace multiple variables in one template', async () => {
      const parent = createParent({ first_name: 'Jane', last_name: 'Smith' });
      const students = [
        createStudentWithClasses({
          student: createStudent({ first_name: 'Alice', last_name: 'Johnson' }),
        }),
      ];
      const result = await replaceVariablesForParent(
        'Dear {parent_full_name}, your child {parent.student1.full_name} is enrolled.',
        parent,
        students,
        'Admin'
      );
      expect(result).toBe(
        'Dear Jane Smith, your child Alice Johnson is enrolled.'
      );
    });
  });
});

describe('replaceVariablesForParentLegacy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should replace student variables using first student', async () => {
    const student = createStudent({ first_name: 'Alice', last_name: 'Johnson' });
    const classes = [
      {
        class: createClass(),
        subject: createSubject({ long_name: 'SACE 12 Mathematics' }),
      },
    ];
    const result = await replaceVariablesForParentLegacy(
      'Hi {parent.student1.first_name} {parent.student1.last_name}!',
      student,
      classes
    );
    expect(result).toBe('Hi Alice Johnson!');
  });

  it('should pass sender_name through', async () => {
    const student = createStudent({ first_name: 'Alice' });
    const result = await replaceVariablesForParentLegacy(
      'From {sender_name}',
      student,
      [],
      'Support Team'
    );
    expect(result).toBe('From Support Team');
  });

  it('should pass registration_link through options', async () => {
    const student = createStudent();
    const result = await replaceVariablesForParentLegacy(
      'Register: {parent.student1.registration_link}',
      student,
      [],
      undefined,
      { registrationToken: 'legacy-reg-token' }
    );
    expect(getInviteUrlForStudent).toHaveBeenCalledWith('legacy-reg-token', 'register');
    expect(result).toBe('Register: https://student.example.com/register/legacy-reg-token');
  });

  it('should pass invite_link through options', async () => {
    const student = createStudent();
    const result = await replaceVariablesForParentLegacy(
      'Invite: {parent.student1.invite_link}',
      student,
      [],
      undefined,
      { inviteToken: 'legacy-invite-token' }
    );
    expect(getInviteUrlForStudent).toHaveBeenCalledWith('legacy-invite-token', 'invite');
    expect(result).toBe('Invite: https://student.example.com/invite/legacy-invite-token');
  });

  it('should pass forgot_password_link through options', async () => {
    const student = createStudent();
    const result = await replaceVariablesForParentLegacy(
      'Reset: {parent.student1.forgot_password_link}',
      student,
      [],
      undefined,
      { forgotPasswordLink: 'https://example.com/reset' }
    );
    expect(result).toBe('Reset: https://example.com/reset');
  });

  it('should pass classes_with_start_date through options', async () => {
    const student = createStudent();
    const startDate = new Date('2025-03-15');
    const result = await replaceVariablesForParentLegacy(
      'Classes: {parent.student1.classes_with_start_date}',
      student,
      [],
      undefined,
      {
        classesWithStartDates: [
          {
            class: createClass({ day_of_week: 6 }),
            subject: createSubject({ long_name: 'SACE 12 Mathematics' }),
            startDate,
          },
        ],
      }
    );
    expect(result).toContain('starting on Sat 15th Mar');
  });

  it('should use empty parent for legacy (parent_first_name and parent_full_name empty)', async () => {
    const student = createStudent({ first_name: 'Alice' });
    const result = await replaceVariablesForParentLegacy(
      'Parent: {parent_first_name} {parent_full_name}',
      student,
      []
    );
    expect(result).toBe('Parent:  ');
  });

  it('should replace classes when provided', async () => {
    const student = createStudent();
    const classes = [
      {
        class: createClass({ day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00' }),
        subject: createSubject({ long_name: 'SACE 12 Mathematics' }),
      },
    ];
    const result = await replaceVariablesForParentLegacy(
      'Classes: {parent.student1.classes}',
      student,
      classes
    );
    expect(result).toContain('- SACE 12 Mathematics Tue 10:00 AM - 11:00 AM');
  });
});
