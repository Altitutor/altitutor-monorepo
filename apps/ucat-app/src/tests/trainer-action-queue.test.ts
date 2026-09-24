import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTrainerActionQueue,
  type QueuedTrainerAction,
} from "../features/skill-trainer/lib/action-queue";
import type { SkillTrainerAttemptState } from "../features/skill-trainer/types/attempt";
const items = [0, 1, 2, 3].map((i) => ({
  id: `item-${i}`,
  content: {
    answer: true,
    premises: ["All A are B"],
    conclusion: "Some A are B",
  },
}));
function state(index = 0, version = index): SkillTrainerAttemptState {
  return {
    attempt: {
      id: "attempt",
      student_id: "student",
      skill_trainer_id: "trainer",
      score: index * 10,
      streak_count: index,
      item_queue_snapshot: items.map((i) => i.id),
      current_item_index: index,
      current_item_started_at: "2026-09-21T00:00:00Z",
      progress: { type: "quick_syllogism" },
      config_snapshot: {
        time_limit_seconds: 60,
        points_correct: 10,
        points_wrong: 0,
        streak_enabled: false,
        streak_multiplier_steps: [],
        speed_bonus_enabled: false,
        speed_bonus_max_points: 0,
        speed_bonus_window_seconds: 0,
        trainer_key: "quick_syllogism",
      },
      ends_at: "2026-09-21T00:01:00Z",
      started_at: "2026-09-21T00:00:00Z",
      completed_at: null,
      discarded_at: null,
      version,
    },
    currentItem: items[index] ?? null,
    nextItem: items[index + 1] ?? null,
    remainingSeconds: 60,
    isExpired: false,
    isCompleted: false,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const answer = { type: "syllogism_answer", answer: true } as const;
test("advances immediately and queues a second answer while the first request is unresolved", async () => {
  const first = deferred<SkillTrainerAttemptState>();
  const sent: QueuedTrainerAction[] = [];
  let counter = 0;
  const queue = createTrainerActionQueue(state(), {
    uuid: () => `action-${++counter}`,
    onChange: () => {},
    isConflict: () => false,
    refresh: async () => state(),
    send: async (entry) => {
      sent.push(entry);
      return sent.length === 1 ? first.promise : state(2);
    },
  });
  assert.equal(queue.submit(answer), true);
  assert.equal(queue.snapshot().state.currentItem?.id, "item-1");
  assert.equal(queue.snapshot().state.attempt.score, 0);
  assert.equal(queue.submit(answer), true);
  assert.equal(sent.length, 1);
  assert.equal(queue.snapshot().pending, 2);
  first.resolve(state(1));
  await queue.drain();
  assert.deepEqual(
    sent.map((s) => [s.actionId, s.expectedVersion, s.itemId]),
    [
      ["action-1", 0, "item-0"],
      ["action-2", 1, "item-1"],
    ],
  );
  assert.equal(queue.snapshot().state.currentItem?.id, "item-2");
  assert.equal(queue.snapshot().state.attempt.score, 20);
});
test("transport failure retains the answer and retries the identical action id and version", async () => {
  const sent: QueuedTrainerAction[] = [];
  const queue = createTrainerActionQueue(state(), {
    uuid: () => "stable-id",
    onChange: () => {},
    isConflict: () => false,
    refresh: async () => state(),
    send: async (entry) => {
      sent.push(entry);
      if (sent.length === 1) throw new Error("offline");
      return state(1);
    },
  });
  queue.submit(answer);
  await assert.rejects(queue.drain(), /offline/);
  assert.equal(queue.snapshot().pending, 1);
  assert.equal(queue.submit(answer), false);
  await queue.retry();
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(queue.snapshot().pending, 0);
});
test("version conflict rebases only when the canonical item is unchanged", async () => {
  const sent: QueuedTrainerAction[] = [];
  const queue = createTrainerActionQueue(state(), {
    uuid: () => "same-id",
    onChange: () => {},
    isConflict: () => true,
    refresh: async () => state(0, 4),
    send: async (entry) => {
      sent.push(entry);
      if (sent.length === 1) throw new Error("conflict");
      return state(1, 5);
    },
  });
  queue.submit(answer);
  await assert.rejects(queue.drain(), /conflict/);
  await queue.retry();
  assert.deepEqual(
    sent.map((s) => s.expectedVersion),
    [0, 4],
  );
  assert.equal(sent[0].actionId, sent[1].actionId);
});
test("a conflicting item never silently applies a queued answer to another question", async () => {
  let sends = 0;
  const queue = createTrainerActionQueue(state(), {
    uuid: () => "id",
    onChange: () => {},
    isConflict: () => true,
    refresh: async () => state(2),
    send: async () => {
      sends++;
      throw new Error("conflict");
    },
  });
  queue.submit(answer);
  await assert.rejects(queue.drain());
  await assert.rejects(queue.retry(), /changed elsewhere/);
  assert.equal(sends, 1);
  assert.equal(queue.snapshot().pending, 1);
});
test("final completion waits for all acknowledgements", async () => {
  const first = deferred<SkillTrainerAttemptState>();
  const second = deferred<SkillTrainerAttemptState>();
  let sends = 0;
  const completed = { ...state(1), isCompleted: true, isExpired: true };
  const queue = createTrainerActionQueue(state(), {
    uuid: () => String(sends),
    onChange: () => {},
    isConflict: () => false,
    refresh: async () => completed,
    send: async () => (++sends === 1 ? first.promise : second.promise),
  });
  queue.submit(answer);
  queue.submit(answer);
  first.resolve(completed);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(queue.snapshot().state.isCompleted, false);
  second.resolve(completed);
  await queue.drain();
  assert.equal(queue.snapshot().state.isCompleted, true);
  assert.equal(queue.snapshot().pending, 0);
});
