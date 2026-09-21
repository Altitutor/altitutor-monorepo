import assert from "node:assert/strict";
import { test } from "node:test";
import { createDraftWriter } from "../features/question-engine/model/draft-writer";

function deferred() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release: () => release() };
}

test("an old network acknowledgement cannot delete a newer unsent answer", async () => {
  let stored: string | null = null;
  const firstWrite = deferred();
  const writer = createDraftWriter({
    write: async (value) => {
      if (value === "answer A") await firstWrite.promise;
      stored = value;
    },
    remove: async () => {
      stored = null;
    },
  });
  const first = writer.write("answer A");
  const second = writer.write("answer B + flag");
  const acknowledged = writer.acknowledge(first.version);
  firstWrite.release();
  await Promise.all([first.saved, second.saved, acknowledged]);
  assert.equal(stored, "answer B + flag");
  await writer.acknowledge(second.version);
  assert.equal(stored, null);
});

test("a tap during draft removal writes after removal and remains recoverable", async () => {
  let stored: string | null = null;
  const removing = deferred();
  const started = deferred();
  const writer = createDraftWriter({
    write: async (value) => {
      stored = value;
    },
    remove: async () => {
      started.release();
      await removing.promise;
      stored = null;
    },
  });
  const first = writer.write("first question");
  await first.saved;
  const acknowledged = writer.acknowledge(first.version);
  await started.promise;
  const second = writer.write("second question answer");
  removing.release();
  await Promise.all([acknowledged, second.saved]);
  assert.equal(stored, "second question answer");
});

test("a failed local write is reported without blocking later full snapshots", async () => {
  let stored: string | null = null;
  const writer = createDraftWriter({
    write: async (value) => {
      if (value === "first") throw new Error("storage unavailable");
      stored = value;
    },
    remove: async () => {
      stored = null;
    },
  });
  const first = writer.write("first");
  const second = writer.write("all answers");
  await assert.rejects(first.saved, /storage unavailable/);
  await second.saved;
  await writer.acknowledge(first.version);
  assert.equal(stored, "all answers");
});
