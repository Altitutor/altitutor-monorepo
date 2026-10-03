import type { ActivityEvent } from '../../types';
import { mapActivityEventToDisplay } from '../activityEventMapper';

const original = {
  id: 'subsidy-1', student_id: 'student-1', subject_id: 'subject-1',
  subject_name: 'Mathematical Methods', billing_type: 'CLASS', price_cents: 1500,
  currency: 'AUD', effective_from: '2026-10-01T00:00:00Z', effective_until: null,
};

function event(eventName: string, payload: ActivityEvent['payload']): ActivityEvent {
  return {
    id: 'event-1', event_name: eventName, event_version: 1, subject_type: 'student',
    subject_id: 'student-1', payload, actor_staff_id: 'admin-1',
    actorName: 'Admin User', recorded_at: '2026-10-02T10:00:00Z',
    effective_at: '2026-10-01T00:00:00Z', correlation_id: null,
    idempotency_key: null, source: 'application', is_backfilled: false,
    entities: [{ entityType: 'student', entityId: 'student-1', role: 'subject', displayName: 'Alice Williams' }],
  };
}

describe('subsidy activity presentation', () => {
  it('describes a new grant with rate, subject, type, dates and clickable Student', () => {
    const display = mapActivityEventToDisplay(event('student.subsidy_added', {
      before: null, after: original, affected_subsidies: [],
    }));
    expect(display.message).toContain('added a subsidy for Alice Williams: Mathematical Methods (class) at 15.00 AUD/hour');
    expect(display.message).toContain('Oct 1, 2026, indefinitely');
    expect(display.performedBy).toEqual({ id: 'admin-1', name: 'Admin User' });
    expect(display.messageParts).toContainEqual({
      kind: 'entity', text: 'Alice Williams',
      entity: { entityType: 'student', entityId: 'student-1', role: 'subject', displayName: 'Alice Williams' },
    });
    expect(display.iconColor).toBe('green');
  });

  it('shows zero-dollar and non-AUD rates without assuming a dollar currency symbol', () => {
    const display = mapActivityEventToDisplay(event('student.subsidy_added', {
      after: { ...original, price_cents: 0, currency: 'EUR' },
    }));
    expect(display.message).toContain('0.00 EUR/hour');
  });

  it('describes all material old/new details on an edit', () => {
    const display = mapActivityEventToDisplay(event('student.subsidy_changed', {
      before: original,
      after: { ...original, subject_id: 'subject-2', subject_name: 'Biology', billing_type: 'DRAFTING',
        price_cents: 2500, currency: 'USD', effective_from: '2026-11-01T00:00:00Z', effective_until: '2026-12-01T00:00:00Z' },
    }));
    expect(display.message).toContain('subject from Mathematical Methods (class) to Biology (drafting)');
    expect(display.message).toContain('hourly rate from 15.00 AUD/hour to 25.00 USD/hour');
    expect(display.message).toContain('start from Thu, Oct 1, 2026 to Sun, Nov 1, 2026');
    expect(display.message).toContain('end from indefinitely to Tue, Dec 1, 2026');
    expect(display.iconColor).toBe('blue');
  });

  it('shows overlap adjustments and resumed rates as details of one save', () => {
    const display = mapActivityEventToDisplay(event('student.subsidy_added', {
      after: { ...original, price_cents: 500 },
      affected_subsidies: [
        { before: original, after: { ...original, effective_until: '2026-11-01T00:00:00Z' } },
        { before: null, after: { ...original, id: 'resumed-1', effective_from: '2026-12-01T00:00:00Z' } },
        { before: original, after: null },
      ],
    }));
    expect(display.message).toContain('adjusted Mathematical Methods (class)');
    expect(display.message).toContain('resumed Mathematical Methods (class)');
    expect(display.message).toContain('replaced Mathematical Methods (class)');
  });

  it('uses the new Student name when both associations are linked', () => {
    const moved = event('student.subsidy_changed', {
      before: original, after: { ...original, student_id: 'student-2' },
    });
    moved.subject_id = 'student-2';
    moved.entities.push({ entityType: 'student', entityId: 'student-2', role: 'subject', displayName: 'Bob Taylor' });
    const display = mapActivityEventToDisplay(moved);
    expect(display.message).toContain('changed the subsidy for Bob Taylor');
    expect(display.message).toContain('assigned to Bob Taylor');
  });

  it('describes an existing explicit removal using its prior grant details', () => {
    const display = mapActivityEventToDisplay(event('student.subsidy_removed', { before: original, after: null }));
    expect(display.message).toContain('removed a subsidy for Alice Williams: Mathematical Methods (class) at 15.00 AUD/hour');
    expect(display.iconColor).toBe('red');
  });
});
