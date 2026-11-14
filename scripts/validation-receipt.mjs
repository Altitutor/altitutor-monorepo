import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DATABASE_STAGES = ["database-setup", "database-contracts", "generation-replacement", "registration-auth", "imessage-contracts", "interview-migration", "interview-concurrency", "browser-critical", "owned-cleanup"];
const PROFILES = {
  check: ["preflight", "lint", "typecheck", "unit"],
  full: ["preflight", "release-contracts", "mailbox-contracts", "email-artifacts", "lint", "typecheck", "unit", "coverage", "edge-contracts", "owned-startup", "build", ...DATABASE_STAGES],
  database: ["preflight", "owned-startup", ...DATABASE_STAGES],
};

export function requiredStages(profile) {
  if (!Object.hasOwn(PROFILES, profile)) throw new Error(`Unknown validation profile: ${profile}`);
  return [...PROFILES[profile]];
}

export function newReceipt({ profile, owner, revision, base = null, head = null, dirty = true }, now = Date.now()) {
  if (typeof owner !== "string" || !owner.trim()) throw new Error("An assignment owner is required");
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("A positive assignment revision is required");
  for (const sha of [base, head]) if (sha !== null && !/^[a-f0-9]{40}$/u.test(sha)) throw new Error("Invalid evidence SHA");
  if (typeof dirty !== "boolean") throw new Error("Dirty source state must be boolean");
  return { version: 1, profile, base, head, dirty, assignment: { owner, revision }, startedAt: now, finishedAt: null, status: "incomplete", stages: requiredStages(profile).map((name) => ({ name, status: "not-run" })) };
}

// This validates a handoff's internal consistency. Its claims still require
// independent GitHub/tracker readback; a local JSON file grants no merge rights.
export function validateReadyEvidence(evidence, expectedRevision) {
  const sha = /^[a-f0-9]{40}$/u, digest = /^[a-f0-9]{64}$/u;
  if (evidence.version !== 1 || evidence.assignment?.revision !== expectedRevision || !evidence.assignment?.owner) throw new Error("Stale or missing ready assignment");
  if (evidence.target !== "develop" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(evidence.repository ?? "") || !Number.isSafeInteger(evidence.pr) || evidence.pr < 1) throw new Error("Invalid ready target");
  for (const field of ["sourceHead", "sourceTree", "base", "integrationHead", "integrationTree", "reviewHead"]) if (!sha.test(evidence[field] ?? "")) throw new Error(`Missing ready ${field}`);
  if (evidence.reviewResult !== "clear" || ![evidence.sourceHead, evidence.integrationHead].includes(evidence.reviewHead)) throw new Error("Review does not cover the candidate");
  if (evidence.reviewHead !== evidence.integrationHead && (!digest.test(evidence.patch?.sourceSha256 ?? "") || evidence.patch?.sourceSha256 !== evidence.patch?.integrationSha256)) throw new Error("Changed integration needs review");
  if (evidence.ci?.head !== evidence.integrationHead || evidence.ci?.conclusion !== "success" || !evidence.ci?.url?.startsWith(`https://github.com/${evidence.repository}/actions/runs/`)) throw new Error("Current integration CI evidence is required");
  if (!Array.isArray(evidence.holds) || evidence.holds.length || typeof evidence.authorization !== "string" || !evidence.authorization.trim()) throw new Error("Unresolved hold or missing authorization");
  return { ...evidence, consistency: "verified", authority: "independent-readback-required" };
}

function verify(receipt, expectedRevision) {
  if (receipt.version !== 1 || receipt.assignment?.revision !== expectedRevision) throw new Error("Stale or invalid validation assignment");
  const expected = requiredStages(receipt.profile);
  if (!Array.isArray(receipt.stages) || receipt.stages.length !== expected.length || receipt.stages.some((stage, index) => stage.name !== expected[index])) throw new Error("Receipt stage manifest differs from the profile");
}

function completeStage(stage, status, now) {
  stage.status = status;
  stage.durationMs = Math.max(0, now - stage.startedAt);
  stage.finishedAt = now;
}

export function startStage(receipt, name, expectedRevision, now = Date.now()) {
  verify(receipt, expectedRevision);
  if (receipt.finishedAt !== null) throw new Error("Validation already finished");
  const index = receipt.stages.findIndex((stage) => stage.name === name);
  if (index < 0 || receipt.stages[index].status !== "not-run") throw new Error("Unknown or repeated stage");
  const running = receipt.stages.findIndex((stage) => stage.status === "running");
  if (running >= 0) {
    if (running !== index - 1) throw new Error("A stage cannot be silently omitted");
    completeStage(receipt.stages[running], "passed", now);
  } else if (index !== 0) throw new Error("Validation must begin at preflight");
  receipt.stages[index] = { name, status: "running", startedAt: now };
  return receipt;
}

export function finishReceipt(receipt, exitCode, expectedRevision, now = Date.now()) {
  verify(receipt, expectedRevision);
  if (receipt.finishedAt !== null) throw new Error("Validation already finished");
  if (!Number.isInteger(exitCode) || exitCode < 0) throw new Error("An exit code is required");
  const running = receipt.stages.find((stage) => stage.status === "running");
  if (running) completeStage(running, exitCode === 0 ? "passed" : "failed", now);
  receipt.finishedAt = now;
  receipt.exitCode = exitCode;
  receipt.status = exitCode !== 0 ? "failed" : receipt.stages.every((stage) => stage.status === "passed") ? "complete" : "incomplete";
  return receipt;
}

export function receiptStatus(receipt, expectedRevision) {
  verify(receipt, expectedRevision);
  const complete = receipt.finishedAt !== null && receipt.exitCode === 0 && receipt.stages.every((stage) => stage.status === "passed");
  return { ...receipt, status: complete ? "complete" : receipt.exitCode > 0 ? "failed" : "incomplete" };
}

function save(file, receipt) {
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
  renameSync(temporary, file);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  try {
    const file = value("--file");
    if (!file) throw new Error("--file is required");
    if (command === "init") {
      let existing = "";
      try { existing = readFileSync(file, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (existing.trim()) throw new Error("Use a new receipt path for a new run");
      const dirty = value("--dirty", "true");
      if (!["true", "false"].includes(dirty)) throw new Error("--dirty expects true or false");
      save(file, newReceipt({ profile: value("--profile"), owner: value("--owner"), revision: Number(value("--revision")), base: value("--base", null), head: value("--head", null), dirty: dirty === "true" }));
    } else {
      const receipt = JSON.parse(readFileSync(file, "utf8"));
      const revision = Number(value("--expected-revision"));
      if (command === "ready") process.stdout.write(JSON.stringify(validateReadyEvidence(receipt, revision), null, 2) + "\n");
      else if (command === "stage") save(file, startStage(receipt, value("--name"), revision));
      else if (command === "finish") save(file, finishReceipt(receipt, Number(value("--exit")), revision));
      else if (command === "status") {
        const status = receiptStatus(receipt, revision);
        process.stdout.write(JSON.stringify(status, null, 2) + "\n");
        if (status.status !== "complete") process.exitCode = 1;
      } else throw new Error("Expected init, stage, finish, status or ready");
    }
  } catch (error) {
    process.stderr.write(`Validation receipt: ${error.message}\n`);
    process.exitCode = 1;
  }
}
