/**
 * Tests for useSessionHelpers hook
 * Tests computed values and helper functions for sessions
 */

import { renderHook } from '@testing-library/react';
import type { Tables } from '@altitutor/shared';
import { useSessionHelpers } from '../useSessionHelpers';

type SessionWithSubject = Tables<'sessions'> & { subject?: Tables<'subjects'> | null; class?: { subject?: Tables<'subjects'> | null } | null };

describe('useSessionHelpers', () => {
  const mockSession: Partial<Tables<'sessions'>> = {
    id: 'session-1',
    start_at: '2024-01-15T10:00:00Z',
    end_at: '2024-01-15T11:00:00Z',
    type: 'DRAFTING',
  };

  const mockTutorLog: Partial<Tables<'tutor_logs'>> = {
    id: 'log-1',
    session_id: 'session-1',
  };

  describe('hasTutorLog', () => {
    it('should return true when tutor log exists', () => {
      const { result } = renderHook(() =>
        useSessionHelpers({
          session: mockSession as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: [],
          tutorLog: mockTutorLog as Tables<'tutor_logs'>,
          firstClassStaffId: null,
        })
      );

      expect(result.current.hasTutorLog).toBe(true);
    });

    it('should return false when tutor log does not exist', () => {
      const { result } = renderHook(() =>
        useSessionHelpers({
          session: mockSession as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: [],
          tutorLog: null,
          firstClassStaffId: null,
        })
      );

      expect(result.current.hasTutorLog).toBe(false);
    });
  });

  describe('isSessionInPast', () => {
    it('should return true for past session', () => {
      const pastSession = {
        ...mockSession,
        start_at: '2020-01-15T10:00:00Z',
      };

      const { result } = renderHook(() =>
        useSessionHelpers({
          session: pastSession as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: [],
          tutorLog: null,
          firstClassStaffId: null,
        })
      );

      expect(result.current.isSessionInPast).toBe(true);
    });

    it('should return false for future session', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureSession = {
        ...mockSession,
        start_at: futureDate.toISOString(),
      };

      const { result } = renderHook(() =>
        useSessionHelpers({
          session: futureSession as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: [],
          tutorLog: null,
          firstClassStaffId: null,
        })
      );

      expect(result.current.isSessionInPast).toBe(false);
    });

    it('should return false when start_at is null', () => {
      const sessionWithoutDate = {
        ...mockSession,
        start_at: null,
      };

      const { result } = renderHook(() =>
        useSessionHelpers({
          session: sessionWithoutDate as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: [],
          tutorLog: null,
          firstClassStaffId: null,
        })
      );

      expect(result.current.isSessionInPast).toBe(false);
    });
  });

  describe('subject', () => {
    it('should return subject from session.subject', () => {
      const subject = { id: 'subject-1', name: 'Math' };
      const sessionWithSubject = {
        ...mockSession,
        subject,
      };

      const { result } = renderHook(() =>
        useSessionHelpers({
          session: sessionWithSubject as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: [],
          tutorLog: null,
          firstClassStaffId: null,
        })
      );

      expect(result.current.subject).toEqual(subject);
    });

    it('should return subject from session.class.subject', () => {
      const subject = { id: 'subject-1', name: 'Math' };
      const sessionWithClassSubject = {
        ...mockSession,
        class: { subject },
      };

      const { result } = renderHook(() =>
        useSessionHelpers({
          session: sessionWithClassSubject as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: [],
          tutorLog: null,
          firstClassStaffId: null,
        })
      );

      expect(result.current.subject).toEqual(subject);
    });

    it('should return null when no subject available', () => {
      const { result } = renderHook(() =>
        useSessionHelpers({
          session: mockSession as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: [],
          tutorLog: null,
          firstClassStaffId: null,
        })
      );

      expect(result.current.subject).toBeNull();
    });
  });

  describe('getFirstStaffForLogging', () => {
    it('should return first staff ID from sessionsStaff', () => {
      const sessionsStaff = [
        { staff_id: 'staff-1' },
        { staff_id: 'staff-2' },
      ];

      const { result } = renderHook(() =>
        useSessionHelpers({
          session: mockSession as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: sessionsStaff as Tables<'sessions_staff'>[],
          tutorLog: null,
          firstClassStaffId: null,
        })
      );

      expect(result.current.getFirstStaffForLogging()).toBe('staff-1');
    });

    it('should return firstClassStaffId when sessionsStaff is empty', () => {
      const { result } = renderHook(() =>
        useSessionHelpers({
          session: mockSession as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: [],
          tutorLog: null,
          firstClassStaffId: 'class-staff-1',
        })
      );

      expect(result.current.getFirstStaffForLogging()).toBe('class-staff-1');
    });

    it('should return undefined when no staff available', () => {
      const { result } = renderHook(() =>
        useSessionHelpers({
          session: mockSession as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: [],
          tutorLog: null,
          firstClassStaffId: null,
        })
      );

      expect(result.current.getFirstStaffForLogging()).toBeUndefined();
    });

    it('should prioritize sessionsStaff over firstClassStaffId', () => {
      const sessionsStaff = [{ staff_id: 'staff-1' }];

      const { result } = renderHook(() =>
        useSessionHelpers({
          session: mockSession as SessionWithSubject,
          sessionsStudents: [],
          sessionsStaff: sessionsStaff as Tables<'sessions_staff'>[],
          tutorLog: null,
          firstClassStaffId: 'class-staff-1',
        })
      );

      expect(result.current.getFirstStaffForLogging()).toBe('staff-1');
    });
  });
});
