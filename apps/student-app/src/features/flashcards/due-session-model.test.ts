import assert from 'node:assert/strict';
import test from 'node:test';
import type { FlashcardReviewCard } from '@altitutor/shared';

import { nextDueSessionCard } from './due-session-model';

const now = new Date('2026-09-28T10:00:00Z');

function card(id: string, revision: number, dueAt = now.toISOString()): FlashcardReviewCard {
  return { id, revision, due_at: dueAt } as FlashcardReviewCard;
}

test('a saved answer cannot immediately reappear from a refreshed learn-ahead snapshot', () => {
  const answered = new Map([['first', { revision: 0, dueAt: '2026-09-28T10:10:00Z' }]]);
  const justAnswered = card('first', 1, '2026-09-28T10:10:00Z');
  const other = card('second', 0);

  assert.equal(nextDueSessionCard([justAnswered, other], answered, now)?.id, 'second');
  assert.equal(nextDueSessionCard([justAnswered], answered, now), null);
});

test('a stale snapshot cannot reoffer an answered revision, even when its due time arrives', () => {
  const answered = new Map([['first', { revision: 0, dueAt: '2026-09-28T10:01:00Z' }]]);

  assert.equal(nextDueSessionCard([card('first', 0)], answered, new Date('2026-09-28T10:02:00Z')), null);
  assert.equal(nextDueSessionCard([card('first', 1)], answered, new Date('2026-09-28T10:02:00Z'))?.id, 'first');
});

test('rating immediately advances to the next card while the answer request is pending', () => {
  const first = card('first', 0);
  const second = card('second', 0);

  assert.equal(nextDueSessionCard([first, second], new Map(), now, 'first')?.id, 'second');
  assert.equal(nextDueSessionCard([first, second], new Map(), now)?.id, 'first');
});
