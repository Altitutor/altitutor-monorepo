import type { ActivityEvent, ActivityEventsResponse } from '../../types';
import { mapActivityEventToDisplay } from '../activityEventMapper';

const STAFF_ID = '11111111-1111-1111-1111-111111111111';
const STUDENT_ID = '22222222-2222-2222-2222-222222222222';

const relatedEntities = {
  staff: {
    [STAFF_ID]: { id: STAFF_ID, first_name: 'Ada', last_name: 'Admin' },
  },
  students: {
    [STUDENT_ID]: { id: STUDENT_ID, first_name: 'Elliot', last_name: 'Koh' },
  },
} as unknown as ActivityEventsResponse['relatedEntities'];

function makeEvent(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: 'evt-1',
    entity_type: 'students',
    entity_id: STUDENT_ID,
    event_type: 'UPDATED',
    performed_by: null,
    performed_at: '2026-05-05T13:41:00.000Z',
    created_at: '2026-05-05T13:41:00.000Z',
    student_id: STUDENT_ID,
    staff_id: null,
    class_id: null,
    session_id: null,
    parent_id: null,
    task_id: null,
    issue_id: null,
    project_id: null,
    changed_fields: null,
    metadata: null,
    ...overrides,
  } as ActivityEvent;
}

describe('mapActivityEventToDisplay performer resolution', () => {
  it('uses staff name when performed_by is set', () => {
    const display = mapActivityEventToDisplay(
      makeEvent({ performed_by: STAFF_ID, changed_fields: { status: { old: 'OPEN', new: 'DRAFT' } } }),
      relatedEntities
    );
    expect(display.performedBy).toEqual({ id: STAFF_ID, name: 'Ada Admin' });
  });

  it('attributes from discontinued_by when performed_by is null', () => {
    const display = mapActivityEventToDisplay(
      makeEvent({
        changed_fields: {
          status: { old: 'OPEN', new: 'DISCONTINUED' },
          discontinued_by: { old: null, new: STAFF_ID },
        },
      }),
      relatedEntities
    );
    expect(display.performedBy).toEqual({ id: STAFF_ID, name: 'Ada Admin' });
  });

  it('attributes student self-service updates to the student', () => {
    const display = mapActivityEventToDisplay(
      makeEvent({
        changed_fields: {
          ucat_onboarding_completed_at: { old: null, new: '2026-06-07T04:23:00.000Z' },
        },
      }),
      relatedEntities
    );
    expect(display.performedBy.name).toBe('Elliot Koh');
  });

  it('uses System for billing automation with no performer', () => {
    const display = mapActivityEventToDisplay(
      makeEvent({
        entity_type: 'invoices',
        entity_id: '33333333-3333-3333-3333-333333333333',
        event_type: 'CREATED',
        changed_fields: null,
      }),
      relatedEntities
    );
    expect(display.performedBy.name).toBe('System');
    expect(display.message).toContain('System created an invoice');
  });

  it('prefers write-time display snapshots over relatedEntities', () => {
    const display = mapActivityEventToDisplay(
      makeEvent({
        performed_by: STAFF_ID,
        student_id: STUDENT_ID,
        metadata: {
          display: {
            performed_by_name: 'Snapshotted Staff',
            student_name: 'Snapshotted Student',
          },
        },
        changed_fields: { status: { old: 'OPEN', new: 'DRAFT' } },
      }),
      relatedEntities
    );
    expect(display.performedBy).toEqual({ id: STAFF_ID, name: 'Snapshotted Staff' });
    expect(display.relatedEntities?.student?.name).toBe('Snapshotted Student');
  });

  it('shows subject long name for students_subjects create/delete', () => {
    const subjectId = '44444444-4444-4444-4444-444444444444';
    const entities = {
      ...relatedEntities,
      subjects: {
        [subjectId]: {
          id: subjectId,
          name: 'Physics',
          short_name: '11PHYS',
          long_name: 'SACE 11 Physics',
        },
      },
    } as unknown as ActivityEventsResponse['relatedEntities'];

    const created = mapActivityEventToDisplay(
      makeEvent({
        entity_type: 'students_subjects',
        entity_id: '55555555-5555-5555-5555-555555555555',
        event_type: 'CREATED',
        performed_by: STAFF_ID,
      }),
      entities,
      { '55555555-5555-5555-5555-555555555555': subjectId }
    );
    expect(created.message).toBe('Ada Admin added SACE 11 Physics to Elliot Koh');

    const deleted = mapActivityEventToDisplay(
      makeEvent({
        entity_type: 'students_subjects',
        entity_id: '55555555-5555-5555-5555-555555555555',
        event_type: 'DELETED',
        performed_by: STAFF_ID,
      }),
      entities,
      { '55555555-5555-5555-5555-555555555555': subjectId }
    );
    expect(deleted.message).toBe('Ada Admin removed SACE 11 Physics from Elliot Koh');
  });

  it('never falls back to Unknown', () => {
    const display = mapActivityEventToDisplay(
      makeEvent({
        entity_type: 'students_subjects',
        event_type: 'DELETED',
        changed_fields: null,
      }),
      relatedEntities
    );
    expect(display.performedBy.name).toBe('System');
    expect(display.message.toLowerCase()).not.toContain('unknown');
  });
});
