import assert from 'node:assert/strict';
import test from 'node:test';
import type { ResourceTopicNode } from '@altitutor/shared';

import { topicBreadcrumb } from './topic-path';

function node(id: string, children: ResourceTopicNode[] = []): ResourceTopicNode {
  return { id, code: id.toUpperCase(), name: id, parentId: null, index: 0, children };
}

test('breadcrumb includes ancestors only when the topic sits under another topic', () => {
  const tree = [node('root', [node('child', [node('leaf')])])];
  assert.deepEqual(topicBreadcrumb(tree, 'leaf').map((topic) => topic.id), ['root', 'child', 'leaf']);
  assert.equal(topicBreadcrumb(tree, 'root').length, 1);
  assert.deepEqual(topicBreadcrumb(tree, 'missing'), []);
});
