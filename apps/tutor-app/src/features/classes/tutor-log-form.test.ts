import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLogSubmission, type LogDraft, type LogRoster } from './tutor-log-form';

const host = { id: 'host', name: 'Linh', type: 'CHECK_IN_HOST' };
const learner = { id: 'student', name: 'Arjun' };
const parent = { id: 'parent', name: 'Amara' };
const roster: LogRoster = { staff: [host], students: [learner], parents: [parent] };
const draft: LogDraft = {
  staff: { host: { attended: true, type: 'CHECK_IN_HOST' } },
  students: { student: false },
  parents: {},
  topics: {},
  files: {},
  notes: '  Brief follow-up  ',
};

test('Check-in submission explicitly confirms parent attendance and allows no teaching topics', () => {
  const result = buildLogSubmission('meeting', 'CHECK_IN', roster, draft);
  assert.deepEqual(result, { blockers: ['Amara (parent) — select Attended or Did not attend.'] });

  const completed = buildLogSubmission('meeting', 'CHECK_IN', roster, {
    ...draft, parents: { parent: true },
  });

  assert.deepEqual(completed, {
    payload: {
      sessionId: 'meeting',
      staffAttendance: [{ staffId: 'host', attended: true, type: 'CHECK_IN_HOST' }],
      studentAttendance: [{ studentId: 'student', attended: false }],
      parentAttendance: [{ parentId: 'parent', attended: true }],
      topics: [],
      topicFiles: [],
      notes: ['Brief follow-up'],
    },
  });
});

test('only confirmed attending students still assigned to the session receive learning activity', () => {
  const completed = buildLogSubmission('lesson', 'CLASS', {
    staff: [{ id: 'host', name: 'Linh' }],
    students: [learner, { id: 'attendee', name: 'Asha' }],
    parents: [],
  }, {
    ...draft,
    staff: { host: { attended: true, type: 'MAIN_TUTOR' } },
    students: { student: false, attendee: true, removed: true },
    topics: { numbers: ['student', 'attendee', 'removed'] },
    files: {
      worksheet: { topicId: 'numbers', studentIds: ['attendee', 'removed'] },
      removed: { topicId: 'old', studentIds: ['attendee'] },
    },
  });

  assert.deepEqual('payload' in completed && completed.payload.topics, [{ topicId: 'numbers', studentIds: ['attendee'] }]);
  assert.deepEqual('payload' in completed && completed.payload.topicFiles, [
    { topicsFilesId: 'worksheet', topicId: 'numbers', studentIds: ['attendee'] },
  ]);
});
