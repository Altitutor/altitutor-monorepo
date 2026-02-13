/**
 * Tests for entity formatters
 */

import { getEntityDisplayText } from '../entityFormatters';
import type { CommandPaletteEntityResult } from '../../types';
import type { Tables } from '@altitutor/shared';

// Mock the formatClassShortName and formatClassName utilities
jest.mock('@/shared/utils', () => ({
  formatClassShortName: jest.fn((classData: any, subject: any) => {
    const subjectName = subject?.name || '';
    return `Short ${subjectName}`;
  }),
  formatClassName: jest.fn((classData: any, subject: any) => {
    const subjectName = subject?.name || '';
    return `Full ${subjectName}`;
  }),
}));

describe('getEntityDisplayText', () => {
  describe('student entities', () => {
    it('should format student with first and last name', () => {
      const result: CommandPaletteEntityResult = {
        type: 'student',
        id: 'student-1',
        data: {
          id: 'student-1',
          first_name: 'John',
          last_name: 'Doe',
          school: 'Test School',
        } as Tables<'students'>,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('John Doe');
      expect(display.subtitle).toBe('Test School');
    });

    it('should handle student with only first name', () => {
      const result: CommandPaletteEntityResult = {
        type: 'student',
        id: 'student-2',
        data: {
          id: 'student-2',
          first_name: 'Jane',
          last_name: '',
          status: 'ACTIVE',
          availability_friday: null,
          availability_monday: null,
          availability_saturday_am: null,
          availability_saturday_pm: null,
          availability_sunday_am: null,
          availability_sunday_pm: null,
          availability_thursday: null,
          availability_tuesday: null,
          availability_wednesday: null,
          created_at: null,
          created_by: null,
          curriculum: null,
          email: null,
          invite_token: null,
          phone: null,
          school: null,
          updated_at: null,
          user_id: null,
          welcome_modal_acknowledged_at: null,
          year_level: null,
        },
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Jane');
      expect(display.subtitle).toBeNull();
    });

    it('should use fallback for student without names', () => {
      const result: CommandPaletteEntityResult = {
        type: 'student',
        id: 'student-12345678',
        data: {
          id: 'student-12345678',
          first_name: '',
          last_name: '',
          status: 'ACTIVE',
          availability_friday: null,
          availability_monday: null,
          availability_saturday_am: null,
          availability_saturday_pm: null,
          availability_sunday_am: null,
          availability_sunday_pm: null,
          availability_thursday: null,
          availability_tuesday: null,
          availability_wednesday: null,
          created_at: null,
          created_by: null,
          curriculum: null,
          email: null,
          invite_token: null,
          phone: null,
          school: null,
          updated_at: null,
          user_id: null,
          welcome_modal_acknowledged_at: null,
          year_level: null,
        },
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Student student-');
      expect(display.subtitle).toBeNull();
    });
  });

  describe('staff entities', () => {
    it('should format staff with name and role', () => {
      const result: CommandPaletteEntityResult = {
        type: 'staff',
        id: 'staff-1',
        data: {
          id: 'staff-1',
          first_name: 'Alice',
          last_name: 'Smith',
          role: 'TUTOR',
          status: 'ACTIVE',
          email: 'alice@example.com',
          phone_number: '+1234567890',
        },
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Alice Smith');
      expect(display.subtitle).toBe('TUTOR');
    });

    it('should handle staff without role', () => {
      const result: CommandPaletteEntityResult = {
        type: 'staff',
        id: 'staff-2',
        data: {
          id: 'staff-2',
          first_name: 'Bob',
          last_name: 'Jones',
          role: '',
          status: 'ACTIVE',
          email: 'bob@example.com',
          phone_number: '+1234567890',
        },
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Bob Jones');
      expect(display.subtitle).toBeNull();
    });
  });

  describe('parent entities', () => {
    it('should format parent with name and email', () => {
      const result: CommandPaletteEntityResult = {
        type: 'parent',
        id: 'parent-1',
        data: {
          id: 'parent-1',
          first_name: 'Parent',
          last_name: 'One',
          email: 'parent@example.com',
          phone: null,
        },
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Parent One');
      expect(display.subtitle).toBe('parent@example.com');
    });

    it('should use phone when email is not available', () => {
      const result: CommandPaletteEntityResult = {
        type: 'parent',
        id: 'parent-2',
        data: {
          id: 'parent-2',
          first_name: 'Parent',
          last_name: 'Two',
          email: null,
          phone: '1234567890',
        },
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Parent Two');
      expect(display.subtitle).toBe('1234567890');
    });

    it('should handle parent without contact info', () => {
      const result: CommandPaletteEntityResult = {
        type: 'parent',
        id: 'parent-3',
        data: {
          id: 'parent-3',
          first_name: 'Parent',
          last_name: 'Three',
          email: null,
          phone: null,
        },
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Parent Three');
      expect(display.subtitle).toBeNull();
    });
  });

  describe('class entities', () => {
    it('should format class using formatClassShortName and formatClassName', () => {
      const result: CommandPaletteEntityResult = {
        type: 'class',
        id: 'class-1',
        data: {
          id: 'class-1',
          subject: {
            name: 'Math',
          },
        } as any,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Short Math');
      expect(display.subtitle).toBe('Full Math');
    });
  });

  describe('subject entities', () => {
    it('should use long_name when available', () => {
      const result: CommandPaletteEntityResult = {
        type: 'subject',
        id: 'subject-1',
        data: {
          id: 'subject-1',
          long_name: 'Mathematics',
          short_name: 'Math',
          name: 'math',
          curriculum: 'IB',
        } as Tables<'subjects'>,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Mathematics');
      expect(display.subtitle).toBe('IB');
    });

    it('should fallback to short_name when long_name is not available', () => {
      const result: CommandPaletteEntityResult = {
        type: 'subject',
        id: 'subject-2',
        data: {
          id: 'subject-2',
          long_name: null,
          short_name: 'Eng',
          name: 'english',
          curriculum: null,
        } as Tables<'subjects'>,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Eng');
      expect(display.subtitle).toBeNull();
    });

    it('should fallback to name when neither long_name nor short_name is available', () => {
      const result: CommandPaletteEntityResult = {
        type: 'subject',
        id: 'subject-3',
        data: {
          id: 'subject-3',
          long_name: null,
          short_name: null,
          name: 'Science',
          curriculum: null,
        } as Tables<'subjects'>,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Science');
      expect(display.subtitle).toBeNull();
    });
  });

  describe('topic entities', () => {
    it('should format topic with name and subject', () => {
      const result: CommandPaletteEntityResult = {
        type: 'topic',
        id: 'topic-1',
        data: {
          id: 'topic-1',
          name: 'Algebra',
          subject: {
            long_name: 'Mathematics',
            short_name: 'Math',
            name: 'math',
          } as Tables<'subjects'>,
        } as any,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Algebra');
      expect(display.subtitle).toBe('Mathematics');
    });

    it('should fallback to short_name when long_name is not available', () => {
      const result: CommandPaletteEntityResult = {
        type: 'topic',
        id: 'topic-2',
        data: {
          id: 'topic-2',
          name: 'Geometry',
          subject: {
            long_name: null,
            short_name: 'Math',
            name: 'math',
          } as Tables<'subjects'>,
        } as any,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Geometry');
      expect(display.subtitle).toBe('Math');
    });

    it('should fallback to name when neither long_name nor short_name is available', () => {
      const result: CommandPaletteEntityResult = {
        type: 'topic',
        id: 'topic-3',
        data: {
          id: 'topic-3',
          name: 'Calculus',
          subject: {
            long_name: null,
            short_name: null,
            name: 'math',
          } as Tables<'subjects'>,
        } as any,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Calculus');
      expect(display.subtitle).toBe('math');
    });

    it('should handle topic without subject', () => {
      const result: CommandPaletteEntityResult = {
        type: 'topic',
        id: 'topic-4',
        data: {
          id: 'topic-4',
          name: 'Topic Name',
          subject: null,
        } as any,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Topic Name');
      expect(display.subtitle).toBeNull();
    });
  });

  describe('file entities', () => {
    it('should format file with subject, code, topic name, and filename', () => {
      const result: CommandPaletteEntityResult = {
        type: 'file',
        id: 'file-1',
        data: {
          id: 'file-1',
          code: 'A1',
          subject: {
            short_name: 'Math',
          },
          topic: {
            name: 'Algebra',
          },
          file: {
            filename: 'worksheet.pdf',
          },
        } as any,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Math A1 Algebra');
      expect(display.subtitle).toBe('worksheet.pdf');
    });

    it('should handle file without code', () => {
      const result: CommandPaletteEntityResult = {
        type: 'file',
        id: 'file-2',
        data: {
          id: 'file-2',
          code: null,
          subject: {
            short_name: 'Eng',
          },
          topic: {
            name: 'Grammar',
          },
          file: {
            filename: 'notes.pdf',
          },
        } as any,
      };

      const display = getEntityDisplayText(result);
      expect(display.title).toBe('Eng Grammar');
      expect(display.subtitle).toBe('notes.pdf');
    });

    it('should handle file without subject short_name', () => {
      const result: CommandPaletteEntityResult = {
        type: 'file',
        id: 'file-3',
        data: {
          id: 'file-3',
          code: 'B2',
          subject: {
            short_name: null,
          },
          topic: {
            name: 'Topic',
          },
          file: {
            filename: 'file.pdf',
          },
        } as any,
      };

      const display = getEntityDisplayText(result);
      // trim() removes leading space, so we expect "B2 Topic"
      expect(display.title).toBe('B2 Topic');
      expect(display.subtitle).toBe('file.pdf');
    });
  });
});
