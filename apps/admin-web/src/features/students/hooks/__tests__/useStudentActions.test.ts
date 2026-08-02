/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import type { Tables } from '@altitutor/shared';
import { useStudentActions } from '../useStudentActions';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

function makeStudent(status: Tables<'students'>['status']): Tables<'students'> {
  return {
    id: 'student-1',
    status,
  } as Tables<'students'>;
}

const baseCallbacks = {
  onEditDetails: jest.fn(),
  onPasswordResetOrRegistration: jest.fn(),
  passwordResetLabel: 'Reset password',
  onLogAbsence: jest.fn(),
  onBookTrialSession: jest.fn(),
  onBookDraftingSession: jest.fn(),
  onBookSubsidyInterview: jest.fn(),
  onBookCheckIn: jest.fn(),
  onDiscontinue: jest.fn(),
  onReEnroll: jest.fn(),
  onDelete: jest.fn(),
};

describe('useStudentActions', () => {
  it('exposes booking and discontinue actions for ACTIVE students', () => {
    const { result } = renderHook(() =>
      useStudentActions({
        studentId: 'student-1',
        student: makeStudent('ACTIVE'),
        ...baseCallbacks,
      })
    );

    expect(result.current.onBookTrialSession).toBe(baseCallbacks.onBookTrialSession);
    expect(result.current.onBookDraftingSession).toBe(baseCallbacks.onBookDraftingSession);
    expect(result.current.onBookSubsidyInterview).toBe(baseCallbacks.onBookSubsidyInterview);
    expect(result.current.onBookCheckIn).toBe(baseCallbacks.onBookCheckIn);
    expect(result.current.onLogAbsence).toBe(baseCallbacks.onLogAbsence);
    expect(result.current.onDiscontinue).toBe(baseCallbacks.onDiscontinue);
    expect(result.current.onReEnroll).toBeUndefined();
  });

  it('exposes booking and discontinue actions for TRIAL students', () => {
    const { result } = renderHook(() =>
      useStudentActions({
        studentId: 'student-1',
        student: makeStudent('TRIAL'),
        ...baseCallbacks,
      })
    );

    expect(result.current.onBookTrialSession).toBeDefined();
    expect(result.current.onDiscontinue).toBeDefined();
    expect(result.current.onReEnroll).toBeUndefined();
  });

  it('hides booking actions and exposes re-enroll for DISCONTINUED students', () => {
    const { result } = renderHook(() =>
      useStudentActions({
        studentId: 'student-1',
        student: makeStudent('DISCONTINUED'),
        ...baseCallbacks,
      })
    );

    expect(result.current.onBookTrialSession).toBeUndefined();
    expect(result.current.onBookDraftingSession).toBeUndefined();
    expect(result.current.onBookSubsidyInterview).toBeUndefined();
    expect(result.current.onBookCheckIn).toBeUndefined();
    expect(result.current.onLogAbsence).toBeUndefined();
    expect(result.current.onDiscontinue).toBeUndefined();
    expect(result.current.onReEnroll).toBe(baseCallbacks.onReEnroll);
  });
});
