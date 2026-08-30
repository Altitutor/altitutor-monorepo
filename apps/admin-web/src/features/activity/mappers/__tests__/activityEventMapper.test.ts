import type { ActivityEvent, ActivityEventsResponse } from '../../types';
import { mapActivityEventToDisplay, mapActivityEventsToDisplay } from '../activityEventMapper';

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    event_name: 'student.created',
    event_version: 1,
    subject_type: 'student',
    subject_id: '10000000-0000-4000-8000-000000000002',
    payload: {},
    actor_staff_id: null,
    recorded_at: '2026-08-30T10:00:00.000Z',
    effective_at: '2026-08-30T10:00:00.000Z',
    correlation_id: null,
    idempotency_key: null,
    source: 'application',
    is_backfilled: false,
    ...overrides,
  };
}

describe('lifecycle activity mapper', () => {
  it('renders safe payment-method display details', () => {
    const result = mapActivityEventToDisplay(makeEvent({
      event_name: 'student.payment_method_added',
      payload: {
        card_brand: 'visa',
        card_last4: '4242',
        display: { actor_name: 'Admin User' },
      },
      actor_staff_id: '10000000-0000-4000-8000-000000000003',
    }));

    expect(result.message).toBe('added visa ending 4242');
    expect(result.performedBy.name).toBe('Admin User');
    expect(result.icon).toBe('check');
  });

  it('renders attendance with snapshotted student and session names', () => {
    const result = mapActivityEventToDisplay(makeEvent({
      event_name: 'session.student_absent',
      subject_type: 'session',
      payload: {
        display: { student_name: 'Alex Student', session_name: 'Tuesday UCAT' },
      },
    }));

    expect(result.message).toBe('recorded Alex Student as absent');
    expect(result.iconColor).toBe('red');
  });

  it('exposes the allowlisted work-item changes to the existing field renderer', () => {
    const result = mapActivityEventToDisplay(makeEvent({
      event_name: 'task.properties_changed',
      subject_type: 'task',
      payload: {
        changes: {
          priority: { old: 1, new: 2 },
          due_date: { old: null, new: '2026-09-01' },
        },
      },
    }));

    expect(result.changedFields).toEqual([
      { fieldName: 'priority', fieldLabel: 'Priority', oldValue: '1', newValue: '2' },
      { fieldName: 'due_date', fieldLabel: 'Due Date', oldValue: undefined, newValue: '2026-09-01' },
    ]);
  });

  it('keeps the form response id available to the open-response action', () => {
    const result = mapActivityEventToDisplay(makeEvent({
      event_name: 'form.response_submitted',
      subject_type: 'form_response',
      subject_id: '10000000-0000-4000-8000-000000000004',
    }));

    expect(result.entityType).toBe('form_responses');
    expect(result.entityId).toBe('10000000-0000-4000-8000-000000000004');
  });

  it('orders a response by effective lifecycle time', () => {
    const response: ActivityEventsResponse = {
      events: [
        makeEvent({ id: '1', effective_at: '2026-08-29T10:00:00.000Z' }),
        makeEvent({ id: '2', effective_at: '2026-08-30T10:00:00.000Z' }),
      ],
      relatedEntities: {},
      total: 2,
      hasMore: false,
    };

    expect(mapActivityEventsToDisplay(response).map((event) => event.id)).toEqual(['2', '1']);
  });
});
