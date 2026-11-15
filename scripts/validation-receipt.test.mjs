import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { newReceipt, startStage, finishReceipt, receiptStatus, requiredStages, validateReadyEvidence } from "./validation-receipt.mjs";

const create = (profile = "check") => newReceipt({ profile, owner: "DEV-433", revision: 2 }, 0);
test("a check receipt accounts for every stage and cannot claim full validation", () => {
  const receipt = create();
  for (const [index, stage] of requiredStages("check").entries()) startStage(receipt, stage, 2, index * 100);
  finishReceipt(receipt, 0, 2, 400);
  assert.equal(receiptStatus(receipt, 2).status, "complete");
  assert.equal(receipt.profile, "check");
  assert.equal(receipt.stages.reduce((sum, stage) => sum + stage.durationMs, 0), 400);
});
test("early success, failure and skipped or missing stages cannot pass", () => {
  const early = create("full"); startStage(early, "preflight", 2, 0); finishReceipt(early, 0, 2, 10);
  assert.equal(receiptStatus(early, 2).status, "incomplete");
  const failed = create(); startStage(failed, "preflight", 2, 0); finishReceipt(failed, 137, 2, 10);
  assert.equal(receiptStatus(failed, 2).status, "failed");
  assert.equal(failed.stages[1].status, "not-run");
  const missing = create(); startStage(missing, "preflight", 2);
  assert.throws(() => startStage(missing, "unit", 2), /omitted/u);
  missing.stages.pop(); assert.throws(() => receiptStatus(missing, 2), /manifest/u);
});
test("superseded assignment revisions and repeat writes fail closed", () => {
  const receipt = create(); assert.throws(() => startStage(receipt, "preflight", 1), /Stale/u);
  startStage(receipt, "preflight", 2); assert.throws(() => startStage(receipt, "preflight", 2), /repeated/u);
  assert.throws(() => finishReceipt(receipt, 0, 1), /Stale/u);
  finishReceipt(receipt, 1, 2); assert.throws(() => finishReceipt(receipt, 0, 2), /finished/u);
});
test("actual CLI writes a failed receipt and status returns nonzero", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "validation-receipt-"));
  const file = path.join(directory, "receipt.json");
  const cli = path.resolve("scripts/validation-receipt.mjs");
  const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  try {
    run("init", "--file", file, "--profile", "check", "--owner", "DEV-433", "--revision", "2");
    run("stage", "--file", file, "--name", "preflight", "--expected-revision", "2");
    run("finish", "--file", file, "--exit", "1", "--expected-revision", "2");
    assert.equal(JSON.parse(readFileSync(file)).status, "failed");
    const status = spawnSync(process.execPath, [cli, "status", "--file", file, "--expected-revision", "2"], { encoding: "utf8" });
    assert.equal(status.status, 1); assert.equal(JSON.parse(status.stdout).stages[0].status, "failed");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("ready handoff rejects stale CI, changed unreviewed patches and holds", () => {
  const evidence = { version: 1, assignment: { owner: "DEV-433", revision: 3 }, repository: "Altitutor/altitutor-monorepo", target: "develop", pr: 1, sourceHead: "a".repeat(40), sourceTree: "b".repeat(40), base: "c".repeat(40), integrationHead: "d".repeat(40), integrationTree: "e".repeat(40), reviewHead: "a".repeat(40), reviewResult: "clear", patch: { sourceSha256: "1".repeat(64), integrationSha256: "1".repeat(64) }, ci: { head: "d".repeat(40), conclusion: "success", url: "https://github.com/Altitutor/altitutor-monorepo/actions/runs/1" }, authorization: "Recorded user authorization", holds: [] };
  assert.equal(validateReadyEvidence(evidence, 3).authority, "independent-readback-required");
  assert.throws(() => validateReadyEvidence(evidence, 2), /Stale/u);
  assert.throws(() => validateReadyEvidence({ ...evidence, ci: { ...evidence.ci, head: evidence.sourceHead } }, 3), /CI/u);
  assert.throws(() => validateReadyEvidence({ ...evidence, patch: { ...evidence.patch, integrationSha256: "2".repeat(64) } }, 3), /review/u);
  assert.throws(() => validateReadyEvidence({ ...evidence, holds: ["human QA"] }, 3), /hold/u);
});
