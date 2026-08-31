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
    entities: [],
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

    expect(result.message).toBe('recorded Alex Student as absent from Tuesday UCAT');
    expect(result.iconColor).toBe('red');
  });

  it.each([
    ['class.student_added', 'added Alex Student to Tuesday UCAT'],
    [
      'session.student_absence_recorded',
      "recorded Alex Student's planned absence from Tuesday UCAT",
    ],
  ])('includes linked entity names for %s', (eventName, expectedMessage) => {
    const result = mapActivityEventToDisplay(makeEvent({
      event_name: eventName,
      payload: {
        display: {
          student_name: 'Alex Student',
          class_name: 'Tuesday UCAT',
          session_name: 'Tuesday UCAT',
        },
      },
    }));

    expect(result.message).toBe(expectedMessage);
  });

  it('describes an invoice by number and all linked sessions', () => {
    const result = mapActivityEventToDisplay(makeEvent({
      event_name: 'invoice.issued',
      subject_type: 'invoice',
      payload: {
        display: {
          invoice_name: 'INV-1042',
          session_names: ['Tuesday UCAT', 'Thursday UCAT'],
        },
      },
    }));

    expect(result.message).toBe('issued invoice INV-1042 for Tuesday UCAT and Thursday UCAT');
  });

  it('marks snapshotted entity names as clickable message parts', () => {
    const studentId = '10000000-0000-4000-8000-000000000010';
    const sessionId = '10000000-0000-4000-8000-000000000011';
    const result = mapActivityEventToDisplay(makeEvent({
      event_name: 'session.student_absent',
      subject_type: 'session',
      entities: [
        { entityType: 'student', entityId: studentId, role: 'subject', displayName: 'Alex Student' },
        { entityType: 'session', entityId: sessionId, role: 'context', displayName: 'Tuesday UCAT' },
      ],
    }));

    expect(result.message).toBe('recorded Alex Student as absent from Tuesday UCAT');
    expect(result.messageParts).toEqual([
      { kind: 'text', text: 'recorded ' },
      {
        kind: 'entity',
        text: 'Alex Student',
        entity: expect.objectContaining({ entityType: 'student', entityId: studentId }),
      },
      { kind: 'text', text: ' as absent from ' },
      {
        kind: 'entity',
        text: 'Tuesday UCAT',
        entity: expect.objectContaining({ entityType: 'session', entityId: sessionId }),
      },
    ]);
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

  it('displays and orders activity by when the event was recorded', () => {
    const response: ActivityEventsResponse = {
      events: [
        makeEvent({
          id: '1',
          recorded_at: '2026-08-30T10:00:00.000Z',
          effective_at: '2026-08-31T10:00:00.000Z',
        }),
        makeEvent({
          id: '2',
          recorded_at: '2026-08-31T10:00:00.000Z',
          effective_at: '2026-08-29T10:00:00.000Z',
        }),
      ],
      relatedEntities: {},
      total: 2,
      hasMore: false,
    };

    expect(mapActivityEventsToDisplay(response).map((event) => event.id)).toEqual(['2', '1']);
    expect(mapActivityEventToDisplay(response.events[0]).performedAt).toBe(
      '2026-08-30T10:00:00.000Z'
    );
  });
});
