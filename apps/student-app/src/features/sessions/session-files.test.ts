import assert from 'node:assert/strict';
import test from 'node:test';
import type { ResourceFile, SharedLessonDocument } from '@altitutor/shared';

import { groupSessionFiles } from './session-files';

function file(id: string, overrides: Partial<ResourceFile> = {}): ResourceFile {
  return {
    id,
    topicId: 'topic',
    code: id,
    type: 'NOTES',
    index: 1,
    filename: `${id}.pdf`,
    mimetype: 'application/pdf',
    storagePath: id,
    bucket: 'resources',
    externalUrl: null,
    isSolutions: false,
    isSolutionsOfId: null,
    ...overrides,
  };
}

test('session files group by subject, topic and type, with solutions and annotations inline', () => {
  const notes = file('notes', { index: 2 });
  const solution = file('solution', { index: 2, isSolutions: true, isSolutionsOfId: 'notes' });
  const earlier = file('earlier', { index: 1, type: 'TEST' });
  const annotated: SharedLessonDocument = {
    id: 'annotation',
    sessionID: 'session',
    canonicalResourceID: 'notes',
    filename: 'annotated.pdf',
    publishedAt: '2026-09-01T00:00:00Z',
    expiresAt: '2026-10-01T00:00:00Z',
    available: true,
  };
  const loose: SharedLessonDocument = { ...annotated, id: 'loose', canonicalResourceID: null, filename: 'extra.pdf' };
  const grouped = groupSessionFiles(
    [notes, solution, earlier],
    [{ id: 'topic', code: 'A1', name: 'Algebra', subjectId: 'maths', subjectName: 'Maths' }],
    [annotated, loose],
  );
  assert.equal(grouped.groups[0]?.subjectName, 'Maths');
  assert.equal(grouped.groups[0]?.topics[0]?.label, 'A1 Algebra');
  assert.deepEqual(grouped.groups[0]?.topics[0]?.types.map((type) => type.type), ['NOTES', 'TEST']);
  assert.equal(grouped.groups[0]?.topics[0]?.types[0]?.pairs[0]?.solution?.id, 'solution');
  assert.equal(grouped.groups[0]?.topics[0]?.types[0]?.pairs[0]?.annotated[0]?.id, 'annotation');
  assert.deepEqual(grouped.looseAnnotated.map((document) => document.id), ['loose']);
});
