import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import { lifecycleEventToAutomationContext } from '../lifecycle-context.ts';

describe('lifecycle automation context', () => {
  it('targets the incoming staff member while retaining both swap roles', () => {
    const context = lifecycleEventToAutomationContext(
      {
        id: 'event-1',
        event_name: 'session.staff_swapped',
        subject_type: 'session',
        subject_id: 'session-1',
        payload: {},
      },
      [
        { entity_type: 'staff', entity_id: 'staff-out', role: 'staff_out' },
        { entity_type: 'session', entity_id: 'session-1', role: 'subject' },
        { entity_type: 'staff', entity_id: 'staff-in', role: 'staff_in' },
      ]
    );

    expect(context.staff_id).toBe('staff-in');
    expect(context.staff_out_id).toBe('staff-out');
    expect(context.staff_in_id).toBe('staff-in');
    expect(context.session_id).toBe('session-1');
  });

  it('keeps the subject session as the generic session for a reschedule', () => {
    const context = lifecycleEventToAutomationContext(
      {
        id: 'event-2',
        event_name: 'session.student_rescheduled',
        subject_type: 'session',
        subject_id: 'session-from',
        payload: {},
      },
      [
        { entity_type: 'session', entity_id: 'session-to', role: 'session_to' },
        { entity_type: 'student', entity_id: 'student-1', role: 'related' },
        { entity_type: 'session', entity_id: 'session-from', role: 'subject' },
      ]
    );

    expect(context.session_id).toBe('session-from');
    expect(context.session_to_id).toBe('session-to');
    expect(context.student_id).toBe('student-1');
  });
});
