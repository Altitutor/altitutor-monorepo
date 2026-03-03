import {
  getUserRole,
  isAdminStaff,
  isTutor,
  isStudent,
  isStaff,
} from '../index';
import type { User } from '../../types';

describe('auth utils', () => {
  const mockUser = { id: 'user-1', email: 'test@example.com' } as User;

  describe('getUserRole', () => {
    it('should return null for any user (roles now checked via database)', () => {
      expect(getUserRole(mockUser)).toBeNull();
    });

    it('should return null when user is null', () => {
      expect(getUserRole(null)).toBeNull();
    });
  });

  describe('isAdminStaff', () => {
    it('should return false for any user (roles now checked via database)', () => {
      expect(isAdminStaff(mockUser)).toBe(false);
    });

    it('should return false when user is null', () => {
      expect(isAdminStaff(null)).toBe(false);
    });
  });

  describe('isTutor', () => {
    it('should return false for any user (roles now checked via database)', () => {
      expect(isTutor(mockUser)).toBe(false);
    });

    it('should return false when user is null', () => {
      expect(isTutor(null)).toBe(false);
    });
  });

  describe('isStudent', () => {
    it('should return false for any user (roles now checked via database)', () => {
      expect(isStudent(mockUser)).toBe(false);
    });

    it('should return false when user is null', () => {
      expect(isStudent(null)).toBe(false);
    });
  });

  describe('isStaff', () => {
    it('should return false for any user (roles now checked via database)', () => {
      expect(isStaff(mockUser)).toBe(false);
    });

    it('should return false when user is null', () => {
      expect(isStaff(null)).toBe(false);
    });
  });
});
