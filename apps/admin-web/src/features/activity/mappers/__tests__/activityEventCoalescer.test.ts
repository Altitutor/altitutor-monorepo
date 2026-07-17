import type { ActivityEventDisplay } from '../../types';
import { coalesceRelatedEvents } from '../activityEventCoalescer';

function makeEvent(
  overrides: Partial<ActivityEventDisplay> & Pick<ActivityEventDisplay, 'id' | 'message'>
): ActivityEventDisplay {
  return {
    icon: 'user-edit',
    iconColor: 'blue',
    timestamp: '10:34pm Fri 9 Jan 2026',
    performedAt: '2026-01-09T12:04:00.000Z',
    performedBy: { id: 'staff-1', name: 'Test Adminstaff' },
    ...overrides,
  };
}

const emptyRelatedEntities = {};

describe('coalesceRelatedEvents', () => {
  it('coalesces credit multi-field updates into a single credit action', () => {
    const creditEvent = makeEvent({
      id: 'evt-credit',
      message: 'Test Adminstaff updated credited_at',
      relatedEntities: {
        student: { id: 'student-1', name: 'Alice Student', type: 'student' },
        session: { id: 'session-1', name: 'IB 12ENGL SL Mon, Jan 12, 2026 5:45 PM', type: 'session' },
      },
      changedFields: [
        { fieldName: 'credited_at', fieldLabel: 'credited at', newValue: '10:34pm Fri 9 Jan 2026' },
        { fieldName: 'credited_by', fieldLabel: 'credited by', newValue: 'Test Adminstaff' },
        { fieldName: 'is_credited', fieldLabel: 'is credited', oldValue: 'false', newValue: 'true' },
        { fieldName: 'planned_absence', fieldLabel: 'planned absence', oldValue: 'false', newValue: 'true' },
        {
          fieldName: 'planned_absence_logged_at',
          fieldLabel: 'planned absence logged at',
          newValue: '10:34pm Fri 9 Jan 2026',
        },
        {
          fieldName: 'planned_absence_logged_by',
          fieldLabel: 'planned absence logged by',
          newValue: 'Test Adminstaff',
        },
      ],
    });

    const result = coalesceRelatedEvents([creditEvent], emptyRelatedEntities);

    expect(result).toHaveLength(1);
    expect(result[0].isCoalesced).toBe(true);
    expect(result[0].coalescedPatternName).toBe('credit_session');
    expect(result[0].message).toBe(
      'Test Adminstaff credited Alice Student for IB 12ENGL SL Mon, Jan 12, 2026 5:45 PM'
    );
    expect(result[0].changedFields).toBeUndefined();
    expect(result[0].originalEvents).toHaveLength(1);
  });

  it('coalesces undo credit updates', () => {
    const undoCredit = makeEvent({
      id: 'evt-undo-credit',
      message: 'Test Adminstaff updated is_credited',
      relatedEntities: {
        student: { id: 'student-1', name: 'Alice Student', type: 'student' },
        session: { id: 'session-1', name: 'Session A', type: 'session' },
      },
      changedFields: [
        { fieldName: 'is_credited', fieldLabel: 'is credited', oldValue: 'true', newValue: 'false' },
        { fieldName: 'planned_absence', fieldLabel: 'planned absence', oldValue: 'true', newValue: 'false' },
      ],
    });

    const result = coalesceRelatedEvents([undoCredit], emptyRelatedEntities);

    expect(result).toHaveLength(1);
    expect(result[0].coalescedPatternName).toBe('undo_credit_session');
    expect(result[0].message).toBe('Test Adminstaff undid credit for Alice Student on Session A');
  });

  it('coalesces reschedule update + target create into one action', () => {
    const fromUpdate = makeEvent({
      id: 'evt-reschedule-from',
      message: 'Test Adminstaff updated is_rescheduled',
      relatedEntities: {
        student: { id: 'student-1', name: 'Alice Student', type: 'student' },
        session: { id: 'session-from', name: 'Session From', type: 'session' },
      },
      changedFields: [
        { fieldName: 'is_rescheduled', fieldLabel: 'is rescheduled', oldValue: 'false', newValue: 'true' },
        { fieldName: 'planned_absence', fieldLabel: 'planned absence', oldValue: 'false', newValue: 'true' },
      ],
    });
    const toCreate = makeEvent({
      id: 'evt-reschedule-to',
      icon: 'user-plus',
      iconColor: 'green',
      message: 'Test Adminstaff added Alice Student to Session To',
      relatedEntities: {
        student: { id: 'student-1', name: 'Alice Student', type: 'student' },
        session: { id: 'session-to', name: 'Session To', type: 'session' },
      },
    });

    const result = coalesceRelatedEvents([fromUpdate, toCreate], emptyRelatedEntities);

    expect(result).toHaveLength(1);
    expect(result[0].coalescedPatternName).toBe('reschedule_session');
    expect(result[0].message).toBe(
      'Test Adminstaff rescheduled Alice Student from Session From to Session To'
    );
  });

  it('coalesces staff swap update + replacement create', () => {
    const swapUpdate = makeEvent({
      id: 'evt-swap-update',
      message: 'Test Adminstaff updated is_swapped',
      relatedEntities: {
        staff: { id: 'staff-original', name: 'Original Tutor', type: 'staff' },
        session: { id: 'session-1', name: 'Session A', type: 'session' },
      },
      changedFields: [
        { fieldName: 'is_swapped', fieldLabel: 'is swapped', oldValue: 'false', newValue: 'true' },
        { fieldName: 'planned_absence', fieldLabel: 'planned absence', oldValue: 'false', newValue: 'true' },
      ],
    });
    const replacementCreate = makeEvent({
      id: 'evt-swap-create',
      icon: 'user-plus',
      iconColor: 'green',
      message: 'Test Adminstaff assigned Replacement Tutor to Session A',
      relatedEntities: {
        staff: { id: 'staff-replacement', name: 'Replacement Tutor', type: 'staff' },
        session: { id: 'session-1', name: 'Session A', type: 'session' },
      },
    });

    const result = coalesceRelatedEvents([swapUpdate, replacementCreate], emptyRelatedEntities);

    expect(result).toHaveLength(1);
    expect(result[0].coalescedPatternName).toBe('staff_swap');
    expect(result[0].message).toBe(
      'Test Adminstaff swapped Original Tutor for Replacement Tutor on Session A'
    );
  });

  it('coalesces staff planned absence updates', () => {
    const absence = makeEvent({
      id: 'evt-staff-absence',
      message: 'Test Adminstaff updated planned_absence',
      relatedEntities: {
        staff: { id: 'staff-2', name: 'Tutor Two', type: 'staff' },
        session: { id: 'session-1', name: 'Session A', type: 'session' },
      },
      changedFields: [
        { fieldName: 'planned_absence', fieldLabel: 'planned absence', oldValue: 'false', newValue: 'true' },
        {
          fieldName: 'planned_absence_logged_at',
          fieldLabel: 'planned absence logged at',
          newValue: '10:34pm Fri 9 Jan 2026',
        },
        {
          fieldName: 'planned_absence_logged_by',
          fieldLabel: 'planned absence logged by',
          newValue: 'Test Adminstaff',
        },
      ],
    });

    const result = coalesceRelatedEvents([absence], emptyRelatedEntities);

    expect(result).toHaveLength(1);
    expect(result[0].coalescedPatternName).toBe('staff_planned_absence');
    expect(result[0].message).toBe(
      'Test Adminstaff logged planned absence for Tutor Two on Session A'
    );
  });

  it('coalesces unenroll field updates', () => {
    const unenroll = makeEvent({
      id: 'evt-unenroll',
      message: 'Test Adminstaff updated unenrolled_at',
      entityType: 'classes_students',
      eventType: 'UPDATED',
      relatedEntities: {
        student: { id: 'student-1', name: 'Alice Student', type: 'student' },
        class: { id: 'class-1', name: 'IB 12ENGL SL', type: 'class' },
      },
      changedFields: [
        { fieldName: 'unenrolled_at', fieldLabel: 'unenrolled at', newValue: '10:34pm Fri 9 Jan 2026' },
        { fieldName: 'unenrolled_by', fieldLabel: 'unenrolled by', newValue: 'Test Adminstaff' },
      ],
    });

    const result = coalesceRelatedEvents([unenroll], emptyRelatedEntities);

    expect(result).toHaveLength(1);
    expect(result[0].coalescedPatternName).toBe('unenroll_student_update');
    expect(result[0].message).toBe('Test Adminstaff unenrolled Alice Student from IB 12ENGL SL');
  });

  it('coalesces tutor log create bursts into one submit action', () => {
    const shared = {
      performedAt: '2026-01-09T12:04:00.000Z',
      relatedEntities: {
        session: { id: 'session-1', name: 'Session A', type: 'session' },
      },
    };
    const events = [
      makeEvent({
        id: 'tl-root',
        message: 'Unknown created tutor_logs',
        entityType: 'tutor_logs',
        eventType: 'CREATED',
        icon: 'check',
        iconColor: 'green',
        ...shared,
      }),
      makeEvent({
        id: 'tl-staff',
        message: 'Unknown created tutor_logs_staff_attendance',
        entityType: 'tutor_logs_staff_attendance',
        eventType: 'CREATED',
        relatedEntities: {
          ...shared.relatedEntities,
          staff: { id: 'staff-2', name: 'Tutor Two', type: 'staff' },
        },
        performedAt: shared.performedAt,
      }),
      makeEvent({
        id: 'tl-student',
        message: 'Unknown created tutor_logs_student_attendance',
        entityType: 'tutor_logs_student_attendance',
        eventType: 'CREATED',
        relatedEntities: {
          ...shared.relatedEntities,
          student: { id: 'student-1', name: 'Alice Student', type: 'student' },
        },
        performedAt: shared.performedAt,
      }),
      makeEvent({
        id: 'tl-topic',
        message: 'Unknown created tutor_logs_topics',
        entityType: 'tutor_logs_topics',
        eventType: 'CREATED',
        metadata: { topicName: 'Stoichiometry' },
        ...shared,
      }),
    ];

    const result = coalesceRelatedEvents(events, emptyRelatedEntities);

    expect(result).toHaveLength(1);
    expect(result[0].coalescedPatternName).toBe('submit_tutor_log');
    expect(result[0].message).toBe(
      'Test Adminstaff logged attendance for Alice Student on Session A. Topics: Stoichiometry'
    );
    expect(result[0].originalEvents).toHaveLength(4);
  });

  it('coalesces tutor log child events even when notes interleave and root is missing', () => {
    const performedAt = '2026-02-19T11:03:00.000Z';
    const session = { id: 'session-1', name: 'SACE 12 Chemistry Saturday 7th February 2026 9:30 am - 11:00 am', type: 'session' };
    const events = [
      makeEvent({
        id: 'note-1',
        message: 'Alessia added a note',
        entityType: 'notes',
        eventType: 'CREATED',
        icon: 'note',
        performedAt,
        performedBy: { id: 'staff-alessia', name: "Alessia D'Angelis" },
        relatedEntities: { session },
      }),
      makeEvent({
        id: 'tl-student',
        message: "Alessia logged student attendance",
        entityType: 'tutor_logs_student_attendance',
        eventType: 'CREATED',
        performedAt,
        performedBy: { id: 'staff-alessia', name: "Alessia D'Angelis" },
        relatedEntities: {
          session,
          student: { id: 'student-1', name: 'jguiy uoghiyg', type: 'student' },
        },
      }),
      makeEvent({
        id: 'tl-topic-1',
        message: 'Alessia logged topics',
        entityType: 'tutor_logs_topics',
        eventType: 'CREATED',
        performedAt,
        performedBy: { id: 'staff-alessia', name: "Alessia D'Angelis" },
        relatedEntities: { session },
        metadata: { topicName: 'Equilibrium' },
      }),
      makeEvent({
        id: 'tl-topic-2',
        message: 'Alessia logged topics',
        entityType: 'tutor_logs_topics_students',
        eventType: 'CREATED',
        performedAt,
        performedBy: { id: 'staff-alessia', name: "Alessia D'Angelis" },
        relatedEntities: {
          session,
          student: { id: 'student-1', name: 'jguiy uoghiyg', type: 'student' },
        },
      }),
    ];

    const result = coalesceRelatedEvents(events, emptyRelatedEntities);

    expect(result).toHaveLength(2);
    const tutorLog = result.find((event) => event.coalescedPatternName === 'submit_tutor_log');
    const note = result.find((event) => event.id === 'note-1');
    expect(tutorLog).toBeDefined();
    expect(note).toBeDefined();
    expect(tutorLog!.message).toBe(
      "Alessia D'Angelis logged attendance for jguiy uoghiyg on SACE 12 Chemistry Saturday 7th February 2026 9:30 am - 11:00 am. Topics: Equilibrium"
    );
    expect(tutorLog!.originalEvents).toHaveLength(3);
  });

  it('coalesces enroll class + session adds', () => {
    const enrollment = makeEvent({
      id: 'enroll-class',
      message: 'Test Adminstaff enrolled Alice Student in IB 12ENGL SL',
      entityType: 'classes_students',
      eventType: 'CREATED',
      icon: 'user-plus',
      iconColor: 'green',
      relatedEntities: {
        student: { id: 'student-1', name: 'Alice Student', type: 'student' },
        class: { id: 'class-1', name: 'IB 12ENGL SL', type: 'class' },
      },
    });
    const sessionAdds = [1, 2, 3].map((n) =>
      makeEvent({
        id: `enroll-session-${n}`,
        message: `Test Adminstaff added Alice Student to Session ${n}`,
        entityType: 'sessions_students',
        eventType: 'CREATED',
        icon: 'user-plus',
        iconColor: 'green',
        relatedEntities: {
          student: { id: 'student-1', name: 'Alice Student', type: 'student' },
          session: { id: `session-${n}`, name: `Session ${n}`, type: 'session' },
        },
      })
    );

    const result = coalesceRelatedEvents([enrollment, ...sessionAdds], emptyRelatedEntities);

    expect(result).toHaveLength(1);
    expect(result[0].coalescedPatternName).toBe('enroll_student');
    expect(result[0].message).toBe(
      'Test Adminstaff enrolled Alice Student in IB 12ENGL SL (3 sessions)'
    );
  });

  it('coalesces unenroll update + session removals', () => {
    const unenroll = makeEvent({
      id: 'unenroll-class',
      message: 'Test Adminstaff updated unenrolled_at',
      entityType: 'classes_students',
      eventType: 'UPDATED',
      relatedEntities: {
        student: { id: 'student-1', name: 'Alice Student', type: 'student' },
        class: { id: 'class-1', name: 'IB 12ENGL SL', type: 'class' },
      },
      changedFields: [
        { fieldName: 'unenrolled_at', fieldLabel: 'unenrolled at', newValue: '10:34pm Fri 9 Jan 2026' },
      ],
    });
    const removals = [1, 2].map((n) =>
      makeEvent({
        id: `unenroll-session-${n}`,
        message: `Test Adminstaff removed Alice Student from Session ${n}`,
        entityType: 'sessions_students',
        eventType: 'DELETED',
        icon: 'user-minus',
        iconColor: 'red',
        relatedEntities: {
          student: { id: 'student-1', name: 'Alice Student', type: 'student' },
          session: { id: `session-${n}`, name: `Session ${n}`, type: 'session' },
        },
      })
    );

    const result = coalesceRelatedEvents([unenroll, ...removals], emptyRelatedEntities);

    expect(result).toHaveLength(1);
    expect(result[0].coalescedPatternName).toBe('unenroll_student');
    expect(result[0].message).toBe(
      'Test Adminstaff unenrolled Alice Student from IB 12ENGL SL (2 sessions)'
    );
  });

  it('leaves unrelated updates unchanged', () => {
    const statusUpdate = makeEvent({
      id: 'evt-status',
      message: 'Test Adminstaff updated status',
      changedFields: [
        { fieldName: 'status', fieldLabel: 'status', oldValue: 'ACTIVE', newValue: 'INACTIVE' },
      ],
    });

    const result = coalesceRelatedEvents([statusUpdate], emptyRelatedEntities);

    expect(result).toHaveLength(1);
    expect(result[0].isCoalesced).toBeUndefined();
    expect(result[0].id).toBe('evt-status');
  });
});
