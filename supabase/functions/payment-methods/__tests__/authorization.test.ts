import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import {
  isAdminStaff,
  validateAuthorization,
  validateRegistrationFlow,
} from '../shared/authorization.ts';

describe('Payment Methods Authorization', () => {
  describe('isAdminStaff', () => {
    it('should return true for active ADMINSTAFF', () => {
      expect(
        isAdminStaff({ role: 'ADMINSTAFF', status: 'ACTIVE' })
      ).toBe(true);
    });

    it('should return false for inactive ADMINSTAFF', () => {
      expect(
        isAdminStaff({ role: 'ADMINSTAFF', status: 'INACTIVE' })
      ).toBe(false);
    });

    it('should return false for TUTOR role', () => {
      expect(isAdminStaff({ role: 'TUTOR', status: 'ACTIVE' })).toBe(false);
    });

    it('should return false for null staff data', () => {
      expect(isAdminStaff(null)).toBe(false);
    });

    it('should return false for undefined status', () => {
      expect(
        isAdminStaff({ role: 'ADMINSTAFF', status: undefined })
      ).toBe(false);
    });
  });

  describe('validateAuthorization', () => {
    describe('Admin Staff', () => {
      it('should authorize admin staff with student ID', () => {
        const result = validateAuthorization(true, null, 'student-123');
        expect(result.authorized).toBe(true);
        expect(result.isAdminStaff).toBe(true);
        expect(result.studentId).toBe('student-123');
      });

      it('should reject admin staff without student ID', () => {
        const result = validateAuthorization(true, null, undefined);
        expect(result.authorized).toBe(false);
        expect(result.isAdminStaff).toBe(true);
        expect(result.error).toBe('Student ID required for admin operations');
      });

      it('should authorize admin staff even with authenticated student ID', () => {
        const result = validateAuthorization(true, 'student-456', 'student-123');
        expect(result.authorized).toBe(true);
        expect(result.isAdminStaff).toBe(true);
        expect(result.studentId).toBe('student-123');
      });
    });

    describe('Regular Students', () => {
      it('should authorize student accessing own payment methods', () => {
        const result = validateAuthorization(false, 'student-123', 'student-123');
        expect(result.authorized).toBe(true);
        expect(result.studentId).toBe('student-123');
      });

      it('should authorize student without explicit student ID (uses authenticated)', () => {
        const result = validateAuthorization(false, 'student-123', undefined);
        expect(result.authorized).toBe(true);
        expect(result.studentId).toBe('student-123');
      });

      it('should reject student accessing other student\'s payment methods', () => {
        const result = validateAuthorization(
          false,
          'student-123',
          'student-456'
        );
        expect(result.authorized).toBe(false);
        expect(result.studentId).toBe('student-123');
        expect(result.error).toBe(
          'Unauthorized: Cannot access other students\' payment methods'
        );
      });

      it('should reject when student not found', () => {
        const result = validateAuthorization(false, null, undefined);
        expect(result.authorized).toBe(false);
        expect(result.error).toBe('Student not found');
      });
    });
  });

  describe('validateRegistrationFlow', () => {
    it('should validate registration flow with token and student ID', () => {
      const result = validateRegistrationFlow(true, 'token-123', 'student-123');
      expect(result.valid).toBe(true);
      expect(result.studentId).toBe('student-123');
    });

    it('should reject when registration token flag is false', () => {
      const result = validateRegistrationFlow(false, 'token-123', 'student-123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Registration token required');
    });

    it('should reject when registration token is undefined', () => {
      const result = validateRegistrationFlow(true, undefined, 'student-123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Registration token is empty');
    });

    it('should reject when registration token is empty string', () => {
      const result = validateRegistrationFlow(true, '', 'student-123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Registration token is empty');
    });

    it('should reject when student ID is missing', () => {
      const result = validateRegistrationFlow(true, 'token-123', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Student ID required for registration flow');
    });
  });
});
