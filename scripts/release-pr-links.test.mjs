import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  collectReleaseSnapshot,
  refreshReleasePull,
  renderReleaseLinks,
  replaceGeneratedSection,
  runReleaseLinkAction,
} from "./release-pr-links.mjs";

const snapshot = (message) => ({
  repository: "Altitutor/altitutor-monorepo",
  mainSha: "a".repeat(40),
  headSha: "b".repeat(40),
  status: "ahead",
  commits: [{ sha: "c".repeat(40), commit: { message } }],
  sources: [],
  warnings: [],
});

test("explicit closing and reference links survive; incidental mentions never close", () => {
  const result = renderReleaseLinks(
    snapshot("Fixes DEV-1, DEV-2 and DEV-1\nRefs DEV-3\nDiscussed DEV-4"),
  );
  assert.match(result, /^Fixes DEV-1$/m);
  assert.match(result, /^Fixes DEV-2$/m);
  assert.match(result, /^Refs DEV-3$/m);
  assert.doesNotMatch(result, /^(Fixes|Refs) DEV-4$/m);
  assert.equal(result.match(/^Fixes DEV-1$/gm).length, 1);
  assert.match(result, /incidental.*DEV-4/);
});

test("replacing the generated section preserves exact surrounding human text", () => {
  const section = renderReleaseLinks(snapshot("Fixes DEV-1"));
  const body = `Human introduction\n\n${section}\n\nHuman footer  `;
  const next = renderReleaseLinks(snapshot("Refs DEV-2"));
  assert.equal(
    replaceGeneratedSection(body, next),
    `Human introduction\n\n${next}\n\nHuman footer  `,
  );
  assert.equal(replaceGeneratedSection(body, section), body);
});

test("URL directives, multiple closing words and relation-only intent remain explicit", () => {
  const result = renderReleaseLinks(
    snapshot(
      "Resolves https://linear.app/altitutor/issue/DEV-5/some-title\nReferences [DEV-6](https://linear.app/altitutor/issue/DEV-6/a-title)\nRelated to DEV-7\nIgnore DEV-8",
    ),
  );
  assert.match(result, /^Fixes DEV-5$/m);
  assert.match(result, /^Refs DEV-6$/m);
  assert.match(result, /^Related to DEV-7$/m);
  assert.doesNotMatch(result, /^(Fixes|Refs|Related to) DEV-8$/m);
});

test("examples, negations, foreign workspaces, mismatched links and trailing prose do not close", () => {
  const result = renderReleaseLinks(
    snapshot(
      "```md\nFixes DEV-1\n```\n> Fixes DEV-2\n    Fixes DEV-3\n<!-- Fixes DEV-4 -->\nDoes not fix DEV-5\nFixes https://linear.app/other/issue/DEV-6\nFixes [DEV-7](https://linear.app/altitutor/issue/DEV-8)\nFixes DEV-9 when approved",
    ),
  );
  assert.doesNotMatch(result, /^Fixes DEV-/m);
  assert.match(result, /incidental or ambiguous DEV-9/);
});

test("contradictory intent is flagged instead of upgraded", () => {
  const data = snapshot("Fixes DEV-1\nRefs DEV-2\nFixes DEV-3");
  data.sources = [
    { number: 10, title: "Refs DEV-1", body: "Fixes DEV-2\nIgnore DEV-3" },
  ];
  const result = renderReleaseLinks(data);
  assert.doesNotMatch(result, /^(Fixes|Refs) DEV-/m);
  assert.match(result, /DEV-1: conflicting explicit intents/);
  assert.match(result, /DEV-2: conflicting explicit intents/);
  assert.match(result, /DEV-3: conflicting explicit intents/);
});

test("generated source sections cannot become evidence for later closing links", () => {
  const result = renderReleaseLinks(
    snapshot(
      "<!-- altitutor-release-links:start -->\nFixes DEV-1\n<!-- altitutor-release-links:end -->\nRefs DEV-2",
    ),
  );
  assert.doesNotMatch(result, /^Fixes DEV-1$/m);
  assert.match(result, /^Refs DEV-2$/m);
});

for (const cause of [
  "diverged",
  'Revert "old change"\nFixes DEV-1',
  "Fixes DEV-1\n(cherry picked from commit 0123456)",
]) {
  test(`history review withholds completion: ${cause}`, () => {
    const data = snapshot(
      cause === "diverged" ? "Fixes DEV-1\nRefs DEV-2" : cause,
    );
    if (cause === "diverged") data.status = cause;
    const result = renderReleaseLinks(data);
    assert.doesNotMatch(result, /^Fixes DEV-1$/m);
    assert.match(result, /closing.*withheld/i);
    if (cause === "diverged") assert.match(result, /^Refs DEV-2$/m);
  });
}

test("malformed marker boundaries fail without deleting human text", () => {
  for (const body of [
    "intro <!-- altitutor-release-links:start --> footer",
    "<!-- altitutor-release-links:end --><!-- altitutor-release-links:start -->",
    "<!-- altitutor-release-links:start --><!-- altitutor-release-links:start --><!-- altitutor-release-links:end -->",
  ]) {
    assert.throws(
      () => replaceGeneratedSection(body, "replacement"),
      /markers/,
    );
  }
  assert.equal(
    replaceGeneratedSection("Human text  ", "section"),
    "Human text  \n\nsection",
  );
});

const repository = "Altitutor/altitutor-monorepo";
const root = `/repos/${repository}`;
const sha = (n) => n.toString(16).padStart(40, "0");
const commit = (n, message = "Fixes DEV-1") => ({
  sha: sha(n),
  commit: { message },
});
const sourcePr = (number, merge = sha(1)) => ({
  number,
  state: "closed",
  merged_at: "2026-10-13",
  merge_commit_sha: merge,
  base: { ref: "develop", repo: { full_name: repository } },
  head: { ref: `fix-${number}`, repo: { full_name: repository } },
  title: "Source change",
  body: "Fixes DEV-2",
});
const releasePr = () => ({
  number: 500,
  state: "open",
  body: "Human text",
  updated_at: "initial",
  base: { ref: "main", repo: { full_name: repository } },
  head: { ref: "develop", sha: sha(900), repo: { full_name: repository } },
});

// Fake the public GitHub HTTP boundary with mutable server state, not the
// generator's internal helpers. Assertions observe PATCHes and rendered bodies.
function server({
  commits = [commit(1)],
  associations = {},
  status = "ahead",
  hook = () => {},
} = {}) {
  const state = { pr: releasePr(), main: sha(800), writes: [], calls: [] };
  const github = {
    request: async (route, query = {}) => {
      state.calls.push({ route, query });
      hook(state, route, query);
      let data;
      if (route === `GET ${root}/branches/main`)
        data = { commit: { sha: state.main } };
      else if (route === `GET ${root}/pulls/500`) data = state.pr;
      else if (route.startsWith(`GET ${root}/compare/`))
        data = {
          status,
          total_commits: commits.length,
          commits: commits.slice((query.page - 1) * 100, query.page * 100),
        };
      else if (route.startsWith(`GET ${root}/commits/`)) {
        const id = route.split("/").at(-2);
        data = (associations[id] ?? []).slice(
          (query.page - 1) * 100,
          query.page * 100,
        );
      } else if (route === `GET ${root}/pulls`) data = [state.pr];
      else if (route === `PATCH ${root}/pulls/500`) {
        state.writes.push(query.body);
        state.pr.body = query.body;
        state.pr.updated_at = `write-${state.writes.length}`;
        data = state.pr;
      } else throw new Error(`Unexpected route ${route}`);
      return { data: structuredClone(data) };
    },
  };
  return { state, github };
}

test("all comparison and association pages are read; only included merged source PRs contribute", async () => {
  const commits = Array.from({ length: 101 }, (_, i) => commit(i + 1));
  const open = { ...sourcePr(12), merged_at: null };
  const foreign = {
    ...sourcePr(13),
    base: { ref: "develop", repo: { full_name: "Other/repo" } },
  };
  const released = {
    ...sourcePr(14),
    base: { ref: "main", repo: { full_name: repository } },
  };
  const backMerge = { ...sourcePr(15), head: { ref: "main" } };
  const associations = {
    [sha(1)]: [
      ...Array.from({ length: 100 }, () => open),
      sourcePr(11),
      sourcePr(500),
      foreign,
      released,
      backMerge,
    ],
  };
  const { github, state } = server({ commits, associations });
  const result = await collectReleaseSnapshot(github, repository, releasePr());
  assert.equal(result.commits.length, 101);
  assert.deepEqual(
    result.sources.map((pr) => pr.number),
    [11],
  );
  assert.ok(
    state.calls.some(
      ({ route, query }) => route.includes("/compare/") && query.page === 2,
    ),
  );
  assert.ok(
    state.calls.some(
      ({ route, query }) =>
        route.endsWith(`/${sha(1)}/pulls`) && query.page === 2,
    ),
  );
});

test("missing merge anchors and multiple mappings withhold closing links", async () => {
  for (const associated of [
    [sourcePr(10, sha(999))],
    [sourcePr(10, sha(2)), sourcePr(11, sha(3))],
  ]) {
    const { github } = server({
      commits: [commit(1), commit(2), commit(3)],
      associations: { [sha(1)]: associated },
    });
    const result = renderReleaseLinks(
      await collectReleaseSnapshot(github, repository, releasePr()),
    );
    assert.doesNotMatch(result, /^Fixes DEV-/m);
    assert.match(result, /possible cherry-pick|ambiguous source PR/);
  }
});

test("partial comparison pagination fails closed with zero writes", async () => {
  const { github, state } = server();
  const real = github.request;
  github.request = async (route, query) => {
    const response = await real(route, query);
    if (route.includes("/compare/")) response.data.total_commits = 2;
    return response;
  };
  await assert.rejects(
    refreshReleasePull(github, repository, 500),
    /pagination/,
  );
  assert.deepEqual(state.writes, []);
});

for (const change of [
  "head",
  "main",
  "human body",
  "closed",
  "fork",
  "retargeted",
]) {
  test(`pre-write ${change} change cannot receive stale output`, async () => {
    let changed = false;
    const { github, state } = server({
      hook: (current, route) => {
        const reads = current.calls.filter(
          (call) => call.route === `GET ${root}/pulls/500`,
        ).length;
        if (!changed && reads === 2 && route === `GET ${root}/pulls/500`) {
          changed = true;
          if (change === "head") current.pr.head.sha = sha(901);
          if (change === "main") current.main = sha(801);
          if (change === "human body") current.pr.body = "New human text  ";
          if (change === "closed") current.pr.state = "closed";
          if (change === "fork") current.pr.head.repo.full_name = "Other/repo";
          if (change === "retargeted") current.pr.base.ref = "develop";
        }
      },
    });
    const result = await refreshReleasePull(github, repository, 500);
    if (["closed", "fork", "retargeted"].includes(change)) {
      assert.equal(result.status, "skipped");
      assert.deepEqual(state.writes, []);
    } else {
      assert.equal(state.writes.length, 1);
      if (change === "head")
        assert.match(state.writes[0], new RegExp(sha(901)));
      if (change === "main")
        assert.match(state.writes[0], new RegExp(sha(801)));
      if (change === "human body")
        assert.ok(state.writes[0].startsWith("New human text  \n\n"));
    }
  });
}

test("refresh is idempotent and dry-run never PATCHes", async () => {
  const { github, state } = server();
  assert.equal(
    (await refreshReleasePull(github, repository, 500, { dryRun: true }))
      .status,
    "dry-run",
  );
  assert.equal(state.writes.length, 0);
  assert.equal(
    (await refreshReleasePull(github, repository, 500)).status,
    "updated",
  );
  assert.equal(
    (await refreshReleasePull(github, repository, 500)).status,
    "unchanged",
  );
  assert.equal(state.writes.length, 1);
});

test("a head update after PATCH is recalculated and verified before reporting success", async () => {
  let changed = false;
  const { github, state } = server({
    hook: (current, route) => {
      if (
        !changed &&
        current.writes.length === 1 &&
        route === `GET ${root}/pulls/500`
      ) {
        changed = true;
        current.pr.head.sha = sha(902);
      }
    },
  });
  assert.equal(
    (await refreshReleasePull(github, repository, 500)).status,
    "updated",
  );
  assert.equal(state.writes.length, 2);
  assert.match(state.writes[1], new RegExp(sha(902)));
});

test("repeated concurrent human edits exhaust retries without overwriting them", async () => {
  const { github, state } = server({
    hook: (current, route) => {
      const reads = current.calls.filter(
        (call) => call.route === `GET ${root}/pulls/500`,
      ).length;
      if (route === `GET ${root}/pulls/500` && reads % 2 === 0)
        current.pr.body += " human update";
    },
  });
  await assert.rejects(
    refreshReleasePull(github, repository, 500),
    /changed repeatedly/,
  );
  assert.deepEqual(state.writes, []);
});

test("main push and manual dispatch discover releases instead of trusting an event head", async () => {
  const { github, state } = server();
  const context = {
    repo: { owner: "Altitutor", repo: "altitutor-monorepo" },
    payload: {},
  };
  assert.deepEqual(
    (await runReleaseLinkAction(github, context)).map(({ status }) => status),
    ["updated"],
  );
  assert.equal(state.writes.length, 1);
  await assert.rejects(
    runReleaseLinkAction(github, {
      ...context,
      repo: { owner: "Other", repo: "repo" },
    }),
    /repository/,
  );
});

test("write workflow executes only pinned actions and the trusted main script with narrow permissions", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/release-pr-links.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /types: \[opened, reopened, synchronize, edited\]/);
  assert.match(workflow, /push:\s+branches: \[main\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /contents: read\s+pull-requests: write/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /ref: refs\/heads\/main/);
  assert.match(workflow, /persist-credentials: false/);
  for (const action of workflow.matchAll(/uses: (\S+)/g))
    assert.match(action[1], /@[0-9a-f]{40}$/);
  assert.doesNotMatch(
    workflow,
    /secrets\.|npm install|pnpm install|github\.event\.pull_request\.head\.sha|write-all/,
  );
});
