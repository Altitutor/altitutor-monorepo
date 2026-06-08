/**
 * Tests for booking helper utilities
 * Tests step calculation and validation functions
 */

import {
  formatStudentDisplay,
  formatSubjectDisplay,
  getSessionTypeLabel,
  getBookingSteps,
  canProceedToNextStep,
} from '../bookingHelpers';
import type { Tables } from '@altitutor/shared';

describe('formatStudentDisplay', () => {
  it('should format student name with email', () => {
    const student: Tables<'students'> = {
      id: 'student-1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      status: 'ACTIVE',
      curriculum: null,
      year_level: null,
      school: null,
      phone: null,
      active_at: null,
      registered_at: null,
      discontinued_at: null,
      created_at: null,
      updated_at: null,
      availability_monday: null,
      availability_tuesday: null,
      availability_wednesday: null,
      availability_thursday: null,
      availability_friday: null,
      availability_saturday_am: null,
      availability_saturday_pm: null,
      availability_sunday_am: null,
      availability_sunday_pm: null,
      created_by: null,
      user_id: null,
      invite_token: null,
      onboarding_progress: {},
      timezone: 'Australia/Adelaide',
      ucat_target_score_s1: null,
      ucat_target_score_s2: null,
      ucat_target_score_s3: null,
      ucat_test_date: null,
      ucat_onboarding_completed_at: null,
      ucat_online_tier_override: 'default',
      ucat_unlimited_trial_consumed_at: null,
      ucat_signup_completed_at: null,
      ucat_signup_step: 0,
      ucat_test_year: null,
    };
    
    expect(formatStudentDisplay(student)).toBe('John Doe (john@example.com)');
  });

  it('should format student name without email when email is null', () => {
    const student: Tables<'students'> = {
      id: 'student-1',
      first_name: 'Jane',
      last_name: 'Smith',
      email: null,
      status: 'ACTIVE',
      curriculum: null,
      year_level: null,
      school: null,
      phone: null,
      active_at: null,
      registered_at: null,
      discontinued_at: null,
      created_at: null,
      updated_at: null,
      availability_monday: null,
      availability_tuesday: null,
      availability_wednesday: null,
      availability_thursday: null,
      availability_friday: null,
      availability_saturday_am: null,
      availability_saturday_pm: null,
      availability_sunday_am: null,
      availability_sunday_pm: null,
      created_by: null,
      user_id: null,
      invite_token: null,
      onboarding_progress: {},
      timezone: 'Australia/Adelaide',
      ucat_target_score_s1: null,
      ucat_target_score_s2: null,
      ucat_target_score_s3: null,
      ucat_test_date: null,
      ucat_onboarding_completed_at: null,
      ucat_online_tier_override: 'default',
      ucat_unlimited_trial_consumed_at: null,
      ucat_signup_completed_at: null,
      ucat_signup_step: 0,
      ucat_test_year: null,
    };
    
    expect(formatStudentDisplay(student)).toBe('Jane Smith');
  });
});

describe('formatSubjectDisplay', () => {
  it('should return long_name when set', () => {
    const subject: Tables<'subjects'> = {
      id: 'subject-1',
      name: 'Mathematics',
      curriculum: 'IB',
      year_level: 10,
      color: null,
      discipline: 'MATHEMATICS',
      level: null,
      long_name: 'IB Year 10 Mathematics',
      short_name: null,
      created_at: null,
      updated_at: null,
    };

    expect(formatSubjectDisplay(subject)).toBe('IB Year 10 Mathematics');
  });

  it('should return empty string when long_name is null', () => {
    const subject: Tables<'subjects'> = {
      id: 'subject-1',
      name: 'English',
      curriculum: 'SACE',
      year_level: null,
      color: null,
      discipline: 'ENGLISH',
      level: null,
      long_name: null,
      short_name: null,
      created_at: null,
      updated_at: null,
    };

    expect(formatSubjectDisplay(subject)).toBe('');
  });
});

describe('getSessionTypeLabel', () => {
  it('should return correct label for DRAFTING', () => {
    expect(getSessionTypeLabel('DRAFTING')).toBe('Drafting Session');
  });

  it('should return correct label for TRIAL_SESSION', () => {
    expect(getSessionTypeLabel('TRIAL_SESSION')).toBe('Trial Session');
  });

  it('should return correct label for SUBSIDY_INTERVIEW', () => {
    expect(getSessionTypeLabel('SUBSIDY_INTERVIEW')).toBe('Subsidy Interview');
  });
});

describe('getBookingSteps', () => {
  it('should return correct steps for DRAFTING session', () => {
    const steps = getBookingSteps('DRAFTING');
    
    expect(steps).toHaveLength(5);
    expect(steps[0].id).toBe('student');
    expect(steps[1].id).toBe('subject');
    expect(steps[2].id).toBe('time');
    expect(steps[3].id).toBe('staff');
    expect(steps[4].id).toBe('confirm');
  });

  it('should return correct steps for TRIAL_SESSION', () => {
    const steps = getBookingSteps('TRIAL_SESSION');
    
    expect(steps).toHaveLength(4);
    expect(steps[0].id).toBe('trial-contact');
    expect(steps[1].id).toBe('time');
    expect(steps[2].id).toBe('staff');
    expect(steps[3].id).toBe('confirm');
  });

  it('should return correct steps for SUBSIDY_INTERVIEW', () => {
    const steps = getBookingSteps('SUBSIDY_INTERVIEW');
    
    expect(steps).toHaveLength(4);
    expect(steps[0].id).toBe('student');
    expect(steps[1].id).toBe('time');
    expect(steps[2].id).toBe('staff');
    expect(steps[3].id).toBe('confirm');
  });

  it('should show "Confirm Reschedule" when originalSessionId is provided', () => {
    const steps = getBookingSteps('DRAFTING', 'session-1');
    
    expect(steps[4].title).toBe('Confirm Reschedule');
  });

  it('should show "Confirm Booking" when originalSessionId is null', () => {
    const steps = getBookingSteps('DRAFTING', null);
    
    expect(steps[4].title).toBe('Confirm Booking');
  });
});

describe('canProceedToNextStep', () => {
  it('should allow proceeding from student step when student is selected', () => {
    const canProceed = canProceedToNextStep(
      'student',
      'DRAFTING',
      { selectedStudentId: 'student-1' }
    );
    
    expect(canProceed).toBe(true);
  });

  it('should not allow proceeding from student step when student is not selected', () => {
    const canProceed = canProceedToNextStep(
      'student',
      'DRAFTING',
      { selectedStudentId: '' }
    );
    
    expect(canProceed).toBe(false);
  });

  it('should allow proceeding from subject step when subject is selected', () => {
    const canProceed = canProceedToNextStep(
      'subject',
      'DRAFTING',
      { selectedStudentId: 'student-1', selectedSubjectId: 'subject-1' }
    );
    
    expect(canProceed).toBe(true);
  });

  it('should allow proceeding from time step when slot is selected', () => {
    const canProceed = canProceedToNextStep(
      'time',
      'DRAFTING',
      {
        selectedStudentId: 'student-1',
        selectedSubjectId: 'subject-1',
        selectedSlot: { startAt: '2024-01-15T10:00:00', endAt: '2024-01-15T11:00:00', availableStaffIds: ['staff-1'] },
      }
    );
    
    expect(canProceed).toBe(true);
  });

  it('should allow proceeding from staff step when staff is selected', () => {
    const canProceed = canProceedToNextStep(
      'staff',
      'DRAFTING',
      {
        selectedStudentId: 'student-1',
        selectedSubjectId: 'subject-1',
        selectedSlot: { startAt: '2024-01-15T10:00:00', endAt: '2024-01-15T11:00:00', availableStaffIds: ['staff-1'] },
        selectedStaffId: 'staff-1',
      }
    );
    
    expect(canProceed).toBe(true);
  });

  it('should handle TRIAL_SESSION steps correctly', () => {
    // Trial session skips student and subject steps
    const canProceedFromTime = canProceedToNextStep(
      'time',
      'TRIAL_SESSION',
      {
        selectedSlot: { startAt: '2024-01-15T10:00:00', endAt: '2024-01-15T11:00:00', availableStaffIds: ['staff-1'] },
      }
    );
    
    expect(canProceedFromTime).toBe(true);
  });

  it('should handle SUBSIDY_INTERVIEW steps correctly', () => {
    // Subsidy interview skips subject step
    const canProceedFromStudent = canProceedToNextStep(
      'student',
      'SUBSIDY_INTERVIEW',
      { selectedStudentId: 'student-1' }
    );
    
    expect(canProceedFromStudent).toBe(true);
  });
});
