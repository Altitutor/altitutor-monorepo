/* eslint-disable no-extend-native -- This test simulates Hermes without Array.toSorted. */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { FlashcardReviewCard } from '@altitutor/shared';

import { filterFlashcardGroups, groupFlashcards, pageOf } from './flashcard-manager-model';

function card(id: string, clozeIndex: number, state: FlashcardReviewCard['state'], extra: Partial<FlashcardReviewCard> = {}): FlashcardReviewCard {
  return {
    id,
    flashcard_id: 'flashcard-1',
    cloze_index: clozeIndex,
    topic_id: 'topic-1',
    card_type: 'text_cloze',
    cloze_text: 'The {{c1::cell}} has a {{c2::nucleus}}.',
    extra: null,
    image_file_id: null,
    image_alt_text: null,
    image_storage_path: null,
    image_mimetype: null,
    occlusion_data: null,
    flashcard_index: 0,
    due_at: '2026-09-28T00:00:00Z',
    stability: null,
    difficulty: null,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state,
    last_reviewed_at: null,
    last_rating: null,
    revision: 0,
    buried_until: null,
    buried_reason: null,
    suspended_at: null,
    leech_at: null,
    ...extra,
  };
}

test('manager groups sibling clozes but filters on each review card state and flag', () => {
  const groups = groupFlashcards([
    card('second', 2, 'Review', { buried_until: '2026-09-29T00:00:00Z' }),
    card('first', 1, 'New'),
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].cards.map((item) => item.id), ['first', 'second']);
  assert.equal(filterFlashcardGroups(groups, { search: 'nucleus', state: 'Review', flag: 'buried', sort: 'order' }).length, 1);
  assert.equal(filterFlashcardGroups(groups, { search: '', state: 'New', flag: 'suspended', sort: 'order' }).length, 0);
});

test('manager filters by subject and one or more topics, and pages the result', () => {
  const maths = card('maths', 1, 'New', { flashcard_id: 'maths-card', subject_id: 'maths', topic_id: 'algebra' });
  const english = card('english', 1, 'Review', { flashcard_id: 'english-card', subject_id: 'english', topic_id: 'poetry', flashcard_index: 1 });
  const groups = groupFlashcards([maths, english]);
  assert.equal(filterFlashcardGroups(groups, { search: '', state: 'all', flag: 'all', sort: 'order', subjectId: 'maths' }).length, 1);
  assert.equal(filterFlashcardGroups(groups, { search: '', state: 'all', flag: 'all', sort: 'order', subjectId: 'english', topicIds: ['poetry', 'prose'] }).length, 1);
  assert.equal(filterFlashcardGroups(groups, { search: '', state: 'all', flag: 'all', sort: 'order', subjectId: 'english', topicIds: ['prose'] }).length, 0);
  assert.deepEqual(pageOf([1, 2, 3], 1, 2), { index: 1, pageCount: 2, items: [3] });
});

test('manager works on runtimes without Array.toSorted', () => {
  const original = Object.getOwnPropertyDescriptor(Array.prototype, 'toSorted');
  Object.defineProperty(Array.prototype, 'toSorted', { value: undefined, configurable: true });
  try {
    const groups = groupFlashcards([card('second', 2, 'Review'), card('first', 1, 'New')]);
    assert.deepEqual(filterFlashcardGroups(groups, { search: '', state: 'all', flag: 'all', sort: 'order' }).map((group) => group.id), ['flashcard-1']);
  } finally {
    if (original) Object.defineProperty(Array.prototype, 'toSorted', original);
    else Reflect.deleteProperty(Array.prototype, 'toSorted');
  }
});
