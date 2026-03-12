import {
  formatClassName,
  formatClassShortName,
  formatSessionType,
  getSessionTypeBadgeColor,
  formatSubjectDisplay,
  formatSubjectShortName,
  getSubjectColorStyle,
  getSubjectColorHex,
  getIconStrokeColor,
  getErrorMessage,
  getStripeErrorDetails,
} from '../index';
import type { Tables } from '@altitutor/shared';

describe('display utilities', () => {
  describe('formatClassName', () => {
    const mockClass: Tables<'classes'> = {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1,
      start_time: '14:00:00',
      end_time: '16:00:00',
      level: null,
      created_at: null,
      created_by: null,
      room: null,
      session_end_date: null,
      session_start_date: null,
      status: 'ACTIVE',
      updated_at: null,
      short_name: null,
      long_name: null,
    };

    const mockSubject: Tables<'subjects'> = {
      id: 'subject-1',
      name: 'Mathematics',
      short_name: 'MATH',
      long_name: 'SACE 12 Mathematics',
      curriculum: 'SACE',
      discipline: 'MATHEMATICS',
      year_level: 12,
      level: null,
      color: null,
      created_at: null,
      updated_at: null,
    };

    it('should return class long_name from DB when present', () => {
      const classWithLongName = { ...mockClass, long_name: 'SACE 12 Mathematics Mon 2:00 PM - 4:00 PM' };
      const result = formatClassName(classWithLongName, mockSubject);
      expect(result).toBe('SACE 12 Mathematics Mon 2:00 PM - 4:00 PM');
    });

    it('should return empty string when long_name is null', () => {
      const result = formatClassName(mockClass, mockSubject);
      expect(result).toBe('');
    });

    it('should return empty string without subject when long_name is null', () => {
      const result = formatClassName(mockClass, null);
      expect(result).toBe('');
    });

    it('should trim whitespace from long_name', () => {
      const classWithSpaces = { ...mockClass, long_name: '  SACE 12 Math  ' };
      const result = formatClassName(classWithSpaces, mockSubject);
      expect(result).toBe('SACE 12 Math');
    });
  });

  describe('formatClassShortName', () => {
    const mockClass: Tables<'classes'> = {
      id: 'class-1',
      subject_id: 'subject-1',
      day_of_week: 1,
      start_time: '14:00:00',
      end_time: '16:00:00',
      level: null,
      created_at: null,
      created_by: null,
      room: null,
      session_end_date: null,
      session_start_date: null,
      status: 'ACTIVE',
      updated_at: null,
      short_name: null,
      long_name: null,
    };

    const mockSubject: Tables<'subjects'> = {
      id: 'subject-1',
      name: 'Mathematics',
      short_name: 'MATH',
      long_name: 'SACE 12 Mathematics',
      curriculum: 'SACE',
      discipline: 'MATHEMATICS',
      year_level: 12,
      level: null,
      color: null,
      created_at: null,
      updated_at: null,
    };

    it('should return class short_name from DB when present', () => {
      const classWithShortName = { ...mockClass, short_name: 'MATH Mon 2:00 PM' };
      const result = formatClassShortName(classWithShortName, mockSubject);
      expect(result).toBe('MATH Mon 2:00 PM');
    });

    it('should return empty string when short_name is null', () => {
      const result = formatClassShortName(mockClass, mockSubject);
      expect(result).toBe('');
    });

    it('should trim whitespace from short_name', () => {
      const classWithSpaces = { ...mockClass, short_name: '  MATH  ' };
      const result = formatClassShortName(classWithSpaces, mockSubject);
      expect(result).toBe('MATH');
    });
  });

  describe('formatSessionType', () => {
    it('should format known session types', () => {
      expect(formatSessionType('CLASS')).toBe('Class');
      expect(formatSessionType('DRAFTING')).toBe('Drafting');
      expect(formatSessionType('TRIAL_SESSION')).toBe('Trial Session');
      expect(formatSessionType('SUBSIDY_INTERVIEW')).toBe('Subsidy Interview');
      expect(formatSessionType('EXAM_COURSE')).toBe('Exam Course');
      expect(formatSessionType('STAFF_INTERVIEW')).toBe('Staff Interview');
    });

    it('should return "Meeting" for null/undefined', () => {
      expect(formatSessionType(null)).toBe('Meeting');
      expect(formatSessionType(undefined)).toBe('Meeting');
    });

    it('should format unknown types by replacing underscores', () => {
      // Function replaces underscores and capitalizes first letter of each word
      // Note: If input is already uppercase, it stays uppercase
      const result1 = formatSessionType('UNKNOWN_TYPE');
      expect(result1).toBe('UNKNOWN TYPE'); // Underscores replaced with spaces
      
      const result2 = formatSessionType('some_other_type');
      expect(result2).toBe('Some Other Type'); // Lowercase gets capitalized
    });
  });

  describe('getSessionTypeBadgeColor', () => {
    it('should return correct colors for known types', () => {
      expect(getSessionTypeBadgeColor('CLASS')).toBe('bg-blue-100 text-blue-800');
      expect(getSessionTypeBadgeColor('DRAFTING')).toBe('bg-purple-100 text-purple-800');
      expect(getSessionTypeBadgeColor('TRIAL_SESSION')).toBe('bg-green-100 text-green-800');
      expect(getSessionTypeBadgeColor('SUBSIDY_INTERVIEW')).toBe('bg-yellow-100 text-yellow-800');
    });

    it('should return default gray for null/undefined', () => {
      expect(getSessionTypeBadgeColor(null)).toBe('bg-gray-100 text-gray-800');
      expect(getSessionTypeBadgeColor(undefined)).toBe('bg-gray-100 text-gray-800');
    });

    it('should return default gray for unknown types', () => {
      expect(getSessionTypeBadgeColor('UNKNOWN')).toBe('bg-gray-100 text-gray-800');
    });
  });

  describe('formatSubjectDisplay', () => {
    const mockSubject: Tables<'subjects'> = {
      id: 'subject-1',
      name: 'Mathematics',
      short_name: 'MATH',
      long_name: 'SACE 12 Mathematics',
      curriculum: 'SACE',
      discipline: 'MATHEMATICS',
      year_level: 12,
      level: null,
      color: null,
      created_at: null,
      updated_at: null,
    };

    it('should return long_name when available', () => {
      expect(formatSubjectDisplay(mockSubject)).toBe('SACE 12 Mathematics');
    });

    it('should return empty string when long_name not available', () => {
      const subjectNoLong = { ...mockSubject, long_name: null };
      expect(formatSubjectDisplay(subjectNoLong)).toBe('');
    });
  });

  describe('formatSubjectShortName', () => {
    const mockSubject: Tables<'subjects'> = {
      id: 'subject-1',
      name: 'Mathematics',
      short_name: 'MATH',
      long_name: 'SACE 12 Mathematics',
      curriculum: 'SACE',
      discipline: 'MATHEMATICS',
      year_level: 12,
      level: null,
      color: null,
      created_at: null,
      updated_at: null,
    };

    it('should return short_name when available', () => {
      expect(formatSubjectShortName(mockSubject)).toBe('MATH');
    });

    it('should fall back to long_name', () => {
      const subjectNoShort = { ...mockSubject, short_name: null };
      expect(formatSubjectShortName(subjectNoShort)).toBe('SACE 12 Mathematics');
    });

    it('should fall back to name', () => {
      const subjectNoShortOrLong = { ...mockSubject, short_name: null, long_name: null };
      expect(formatSubjectShortName(subjectNoShortOrLong)).toBe('Mathematics');
    });

    it('should return empty string when all names missing', () => {
      // Note: name is required (non-nullable), so we use empty string instead
      const subjectNoNames: Tables<'subjects'> = { ...mockSubject, short_name: null, long_name: null, name: '' };
      expect(formatSubjectShortName(subjectNoNames)).toBe('');
    });
  });

  describe('getSubjectColorStyle', () => {
    const mockSubject: Tables<'subjects'> = {
      id: 'subject-1',
      name: 'Mathematics',
      short_name: 'MATH',
      long_name: 'SACE 12 Mathematics',
      curriculum: 'SACE',
      discipline: 'MATHEMATICS',
      year_level: 12,
      level: null,
      color: '#FFFFFF',
      created_at: null,
      updated_at: null,
    };

    it('should return style with backgroundColor and textColorClass', () => {
      const result = getSubjectColorStyle(mockSubject);
      expect(result.style.backgroundColor).toBe('#FFFFFF');
      expect(result.textColorClass).toBe('text-gray-900'); // Light background = dark text
    });

    it('should return dark text for light backgrounds', () => {
      const lightSubject = { ...mockSubject, color: '#FFFFFF' };
      const result = getSubjectColorStyle(lightSubject);
      expect(result.textColorClass).toBe('text-gray-900');
    });

    it('should return light text for dark backgrounds', () => {
      const darkSubject = { ...mockSubject, color: '#000000' };
      const result = getSubjectColorStyle(darkSubject);
      expect(result.textColorClass).toBe('text-white');
    });

    it('should handle color without # prefix', () => {
      const subjectNoHash = { ...mockSubject, color: 'FFFFFF' };
      const result = getSubjectColorStyle(subjectNoHash);
      expect(result.style.backgroundColor).toBe('#FFFFFF');
    });

    it('should return defaults when no color', () => {
      const subjectNoColor = { ...mockSubject, color: null };
      const result = getSubjectColorStyle(subjectNoColor);
      expect(result.style.backgroundColor).toBeUndefined();
      expect(result.textColorClass).toBe('text-gray-800');
    });

    it('should handle null subject', () => {
      const result = getSubjectColorStyle(null);
      expect(result.style.backgroundColor).toBeUndefined();
      expect(result.textColorClass).toBe('text-gray-800');
    });
  });

  describe('getSubjectColorHex', () => {
    const mockSubject: Tables<'subjects'> = {
      id: 'subject-1',
      name: 'Mathematics',
      short_name: 'MATH',
      long_name: 'SACE 12 Mathematics',
      curriculum: 'SACE',
      discipline: 'MATHEMATICS',
      year_level: 12,
      level: null,
      color: 'FFFFFF',
      created_at: null,
      updated_at: null,
    };

    it('should add # prefix when missing', () => {
      expect(getSubjectColorHex(mockSubject)).toBe('#FFFFFF');
    });

    it('should keep # prefix when present', () => {
      const subjectWithHash = { ...mockSubject, color: '#FF0000' };
      expect(getSubjectColorHex(subjectWithHash)).toBe('#FF0000');
    });

    it('should return null when no color', () => {
      const subjectNoColor = { ...mockSubject, color: null };
      expect(getSubjectColorHex(subjectNoColor)).toBeNull();
    });
  });

  describe('getIconStrokeColor', () => {
    it('should return light color for dark backgrounds', () => {
      expect(getIconStrokeColor('#000000')).toBe('rgb(255, 255, 255)');
    });

    it('should return dark color for light backgrounds', () => {
      expect(getIconStrokeColor('#FFFFFF')).toBe('rgb(0, 0, 0)');
    });

    it('should add # prefix when missing', () => {
      expect(getIconStrokeColor('000000')).toBe('rgb(255, 255, 255)');
    });

    it('should return currentColor for null/undefined', () => {
      expect(getIconStrokeColor(null)).toBe('currentColor');
      expect(getIconStrokeColor(undefined)).toBe('currentColor');
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error');
      expect(getErrorMessage(error)).toBe('Test error');
    });

    it('should return string as-is', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should extract message from object with message property', () => {
      const error = { message: 'Object error' };
      expect(getErrorMessage(error)).toBe('Object error');
    });

    it('should return default message for unknown error types', () => {
      expect(getErrorMessage(null)).toBe('An unknown error occurred');
      expect(getErrorMessage(123)).toBe('An unknown error occurred');
    });
  });

  describe('getStripeErrorDetails', () => {
    it('should extract Stripe error details', () => {
      const stripeError = {
        type: 'card_error',
        code: 'card_declined',
        statusCode: 402,
        message: 'Your card was declined.',
      };
      const result = getStripeErrorDetails(stripeError);
      expect(result.type).toBe('card_error');
      expect(result.code).toBe('card_declined');
      expect(result.statusCode).toBe(402);
    });

    it('should return empty object for non-Stripe errors', () => {
      const regularError = new Error('Regular error');
      const result = getStripeErrorDetails(regularError);
      expect(result).toEqual({});
    });

    it('should handle partial Stripe error objects', () => {
      const partialError = { type: 'api_error' };
      const result = getStripeErrorDetails(partialError);
      expect(result.type).toBe('api_error');
      expect(result.code).toBeUndefined();
    });
  });
});
