import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDocumentationTree } from './documentation-tree';

test('shows nonempty folder paths and recovers documents whose folders are inaccessible', () => {
  const tree = buildDocumentationTree(
    [
      { id: 'a', name: 'Teaching', parent_id: null },
      { id: 'b', name: 'Policies', parent_id: 'a' },
      { id: 'c', name: 'Empty', parent_id: null },
    ],
    [
      { id: 'lesson', title: 'Lesson preparation', folder_id: 'b' },
      { id: 'welcome', title: 'Welcome', folder_id: 'unknown' },
    ],
  );
  assert.deepEqual(tree, [
    {
      kind: 'folder',
      id: 'a',
      title: 'Teaching',
      children: [{
        kind: 'folder',
        id: 'b',
        title: 'Policies',
        children: [{ kind: 'document', id: 'lesson', title: 'Lesson preparation' }],
      }],
    },
    { kind: 'document', id: 'welcome', title: 'Welcome' },
  ]);
});
