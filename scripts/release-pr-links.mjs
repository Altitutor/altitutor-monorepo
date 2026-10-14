import { pathToFileURL } from "node:url";

const START = "<!-- altitutor-release-links:start -->";
const END = "<!-- altitutor-release-links:end -->";
const REPOSITORY = "Altitutor/altitutor-monorepo";
const ISSUE = /\bDEV-[1-9]\d*\b/giu;
const REWRITE = /\brevert(?:s|ed|ing)?\b|\bcherry[ -]pick(?:s|ed|ing)?\b/iu;
const KEYWORDS = {
  close: "close",
  closes: "close",
  closed: "close",
  closing: "close",
  fix: "close",
  fixes: "close",
  fixed: "close",
  fixing: "close",
  resolve: "close",
  resolves: "close",
  resolved: "close",
  resolving: "close",
  complete: "close",
  completes: "close",
  completed: "close",
  completing: "close",
  implement: "close",
  implements: "close",
  implemented: "close",
  implementing: "close",
  "linear issue": "close",
  ref: "ref",
  refs: "ref",
  references: "ref",
  "part of": "ref",
  "contributes to": "ref",
  toward: "ref",
  towards: "ref",
  "relates to": "related",
  "related to": "related",
  skip: "ignore",
  ignore: "ignore",
};
const DIRECTIVE = new RegExp(
  `^(?:[-*]\\s+)?(${Object.keys(KEYWORDS).join("|")})\\b\\s*:?[ \\t]+(.+)$`,
  "iu",
);

// Only standalone directives with a complete, unambiguous issue list confer intent.
// Prose, quoted examples and code remain review evidence, never closing directives.
function parseLinks(text) {
  const mentions = new Set(
    [...text.matchAll(ISSUE)].map((match) => match[0].toUpperCase()),
  );
  const intents = new Map();
  let fence;
  let commented = false;
  let generated = false;
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trim();
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(raw);
    if (fence) {
      if (
        delimiter &&
        delimiter[1][0] === fence.character &&
        delimiter[1].length >= fence.length &&
        delimiter[2].trim() === ""
      )
        fence = undefined;
      continue;
    }
    if (line.includes(START)) generated = true;
    if (generated) {
      if (line.includes(END)) generated = false;
      continue;
    }
    if (line.includes("<!--")) commented = true;
    if (commented) {
      if (line.includes("-->")) commented = false;
      continue;
    }
    if (delimiter && (delimiter[1][0] !== "`" || !delimiter[2].includes("`"))) {
      fence = { character: delimiter[1][0], length: delimiter[1].length };
      continue;
    }
    if (/^\s{4}|^\t/u.test(raw)) continue;
    const directive = line.match(DIRECTIVE);
    if (!directive) continue;
    let list = directive[2];
    // Validate Markdown labels as well as destinations, then normalize URLs.
    list = list.replace(
      /\[(DEV-[1-9]\d*)\]\((https:\/\/linear\.app\/altitutor\/issue\/(DEV-[1-9]\d*)(?:\/[\w-]+)?)\)/giu,
      (original, label, _url, id) =>
        label.toUpperCase() === id.toUpperCase() ? id : original,
    );
    list = list.replace(
      /https:\/\/linear\.app\/altitutor\/issue\/(DEV-[1-9]\d*)(?:\/[\w-]+)?/giu,
      "$1",
    );
    const ids = [...list.matchAll(ISSUE)].map((match) =>
      match[0].toUpperCase(),
    );
    const remainder = list
      .replace(ISSUE, "")
      .replace(/\band\b/giu, "")
      .replace(/[\s,;.]/gu, "");
    if (ids.length === 0 || remainder !== "") continue;
    for (const id of ids) {
      if (!intents.has(id)) intents.set(id, new Set());
      intents.get(id).add(KEYWORDS[directive[1].toLowerCase()]);
    }
  }
  return { mentions, intents };
}

export function replaceGeneratedSection(body, section) {
  body ??= "";
  const starts = body.split(START).length - 1;
  const ends = body.split(END).length - 1;
  if (starts === 0 && ends === 0)
    return `${body}${body ? "\n\n" : ""}${section}`;
  if (starts !== 1 || ends !== 1 || body.indexOf(END) < body.indexOf(START)) {
    throw new Error(
      "Malformed/duplicate generated markers; repair them manually before rerunning.",
    );
  }
  return (
    body.slice(0, body.indexOf(START)) +
    section +
    body.slice(body.indexOf(END) + END.length)
  );
}

export function renderReleaseLinks(snapshot) {
  const warnings = new Set(snapshot.warnings);
  const links = new Map();
  const texts = snapshot.commits
    .map((commit) => ({
      label: `Commit ${commit.sha.slice(0, 12)}`,
      text: commit.commit.message,
    }))
    .concat(
      snapshot.sources.map((pr) => ({
        label: `Source PR #${pr.number}`,
        text: `${pr.title}\n${pr.body ?? ""}`,
      })),
    );
  let closingBlocked =
    snapshot.status !== "ahead" && snapshot.status !== "identical";
  if (closingBlocked)
    warnings.add(
      "History is diverged or incompatible with main; reconcile using merge commits and rerun. Closing links withheld.",
    );
  for (const { label, text } of texts) {
    if (REWRITE.test(text)) {
      closingBlocked = true;
      warnings.add(
        `${label}: revert/cherry-pick evidence requires review; all closing links withheld.`,
      );
    }
    const { mentions, intents } = parseLinks(text);
    if (mentions.size === 0) warnings.add(`${label}: missing DEV link.`);
    for (const id of mentions) {
      if (!intents.has(id))
        warnings.add(
          `${label}: incidental or ambiguous ${id}; no intent inferred.`,
        );
    }
    for (const [id, kinds] of intents) {
      if (!links.has(id)) links.set(id, new Set());
      for (const kind of kinds) links.get(id).add(kind);
    }
  }
  if (snapshot.warnings.length > 0) closingBlocked = true;
  const lines = [
    START,
    "### Generated release issue links",
    "",
    `Compared main \`${snapshot.mainSha}\` with develop \`${snapshot.headSha}\`.`,
    `${snapshot.commits.length} included commits; ${snapshot.sources.length} verified merged source PRs.`,
    "",
  ];
  for (const [id, kinds] of [...links].sort(
    ([a], [b]) => Number(a.slice(4)) - Number(b.slice(4)),
  )) {
    if (kinds.size > 1) {
      warnings.add(
        `${id}: conflicting explicit intents; closing link withheld.`,
      );
      continue;
    }
    const kind = [...kinds][0];
    if (kind === "ignore") continue;
    if (kind === "close" && closingBlocked) {
      warnings.add(
        `${id}: explicit closing candidate withheld pending history/mapping review.`,
      );
      continue;
    }
    lines.push(
      `${{ close: "Fixes", ref: "Refs", related: "Related to" }[kind]} ${id}`,
    );
  }
  if (!lines.some((line) => /^(Fixes|Refs|Related to) DEV-/u.test(line)))
    lines.push("No unambiguous links to emit.");
  if (snapshot.sources.length) {
    lines.push(
      "",
      "Verified source PRs: " +
        snapshot.sources
          .map(
            (pr) =>
              `[#${pr.number}](https://github.com/${snapshot.repository}/pull/${pr.number})`,
          )
          .join(", "),
    );
  }
  if (warnings.size)
    lines.push(
      "",
      "#### Review required",
      ...[...warnings].sort().map((warning) => `- ${warning}`),
    );
  lines.push(
    "",
    "Only explicit standalone directives confer intent. Correct source metadata, then rerun Release PR issue links.",
    END,
  );
  return lines.join("\n");
}

async function listPages(github, path, query = {}) {
  const result = [];
  for (let page = 1; ; page++) {
    const { data } = await github.request(`GET ${path}`, {
      ...query,
      per_page: 100,
      page,
    });
    result.push(...data);
    if (data.length < 100) return result;
  }
}

export function isReleasePull(pr, repository = REPOSITORY) {
  return (
    pr.state === "open" &&
    pr.base.ref === "main" &&
    pr.head.ref === "develop" &&
    pr.base.repo?.full_name === repository &&
    pr.head.repo?.full_name === repository
  );
}

export async function collectReleaseSnapshot(github, repository, pr) {
  const root = `/repos/${repository}`;
  const { data: main } = await github.request(`GET ${root}/branches/main`);
  const mainSha = main.commit.sha;
  const headSha = pr.head.sha;
  const commits = [];
  let comparison;
  for (let page = 1; ; page++) {
    const { data } = await github.request(
      `GET ${root}/compare/${mainSha}...${headSha}`,
      { per_page: 100, page },
    );
    comparison ??= data;
    commits.push(...data.commits);
    if (data.commits.length < 100) break;
  }
  if (
    commits.length !== comparison.total_commits ||
    new Set(commits.map((c) => c.sha)).size !== commits.length
  ) {
    throw new Error(
      "Incomplete/duplicate comparison pagination; no body write.",
    );
  }
  const included = new Set(commits.map((commit) => commit.sha));
  const sources = new Map();
  const warnings = new Set();
  for (const commit of commits) {
    const associated = await listPages(
      github,
      `${root}/commits/${commit.sha}/pulls`,
    );
    const candidates = associated.filter(
      (source) =>
        source.number !== pr.number &&
        source.merged_at &&
        source.base.repo?.full_name === repository &&
        source.base.ref === "develop" &&
        !["develop", "main"].includes(source.head.ref),
    );
    const verified = candidates.filter((source) =>
      included.has(source.merge_commit_sha),
    );
    const exact = verified.filter(
      (source) => source.merge_commit_sha === commit.sha,
    );
    if (verified.length > 1 && exact.length !== 1) {
      warnings.add(
        `Commit ${commit.sha.slice(0, 12)}: ambiguous source PR mapping; closing links withheld.`,
      );
      continue;
    }
    for (const source of exact.length === 1 ? exact : verified)
      sources.set(source.number, source);
    if (candidates.length && verified.length === 0) {
      warnings.add(
        `Commit ${commit.sha.slice(0, 12)}: source merge absent from comparison (possible cherry-pick/rebase); closing links withheld.`,
      );
    }
  }
  return {
    repository,
    mainSha,
    headSha,
    status: comparison.status,
    commits,
    sources: [...sources.values()].sort((a, b) => a.number - b.number),
    warnings: [...warnings],
  };
}

// Re-read mutable refs/body just before PATCH. A concurrent change restarts the
// complete calculation rather than carrying stale links into a newer release.
export async function refreshReleasePull(
  github,
  repository,
  number,
  { dryRun = false } = {},
) {
  if (repository !== REPOSITORY)
    throw new Error("Unexpected repository; no body write.");
  const root = `/repos/${repository}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: pr } = await github.request(`GET ${root}/pulls/${number}`);
    if (!isReleasePull(pr, repository)) return { status: "skipped" };
    const snapshot = await collectReleaseSnapshot(github, repository, pr);
    const section = renderReleaseLinks(snapshot);
    const body = replaceGeneratedSection(pr.body, section);
    if (body.length > 60000)
      throw new Error(
        "Generated body too large; review release scope manually.",
      );
    if (dryRun) return { status: "dry-run", body, snapshot };
    const { data: fresh } = await github.request(`GET ${root}/pulls/${number}`);
    const { data: main } = await github.request(`GET ${root}/branches/main`);
    if (!isReleasePull(fresh, repository)) return { status: "skipped" };
    if (
      fresh.head.sha !== pr.head.sha ||
      main.commit.sha !== snapshot.mainSha ||
      fresh.body !== pr.body ||
      fresh.updated_at !== pr.updated_at
    )
      continue;
    if (body === (fresh.body ?? "")) return { status: "unchanged", snapshot };
    await github.request(`PATCH ${root}/pulls/${number}`, { body });
    const { data: after } = await github.request(`GET ${root}/pulls/${number}`);
    const { data: afterMain } = await github.request(
      `GET ${root}/branches/main`,
    );
    if (
      isReleasePull(after, repository) &&
      after.head.sha === snapshot.headSha &&
      afterMain.commit.sha === snapshot.mainSha &&
      after.body === body
    ) {
      return { status: "updated", snapshot };
    }
  }
  throw new Error(
    "Release changed repeatedly during refresh; rerun with stable refs/body.",
  );
}

export async function runReleaseLinkAction(github, context) {
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  if (repository !== REPOSITORY) throw new Error("Unexpected repository.");
  const release = context.payload.pull_request;
  const pulls = release
    ? [release]
    : await listPages(github, `/repos/${repository}/pulls`, {
        state: "open",
        base: "main",
        head: "Altitutor:develop",
      });
  const results = [];
  for (const pr of pulls) {
    if (isReleasePull(pr, repository))
      results.push({
        number: pr.number,
        ...(await refreshReleasePull(github, repository, pr.number)),
      });
  }
  return results;
}

// Local CLI is deliberately read-only: gh receives GET requests only. Without a
// PR number it audits live main/develop history, even when no release PR exists.
async function dryRunCli() {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);
  const github = {
    request: async (route, query = {}) => {
      if (!route.startsWith("GET ")) throw new Error("Dry run forbids writes.");
      const path = route.slice(4);
      const params = new URLSearchParams(
        Object.entries(query).map(([key, value]) => [key, String(value)]),
      );
      const { stdout } = await exec(
        "gh",
        ["api", `${path}${params.size ? `?${params}` : ""}`, "--method", "GET"],
        { maxBuffer: 16 * 1024 * 1024 },
      );
      return { data: JSON.parse(stdout) };
    },
  };
  const args = process.argv.slice(2);
  if (
    args[0] !== "--dry-run" ||
    args.length > 2 ||
    (args[1] && !/^[1-9]\d*$/u.test(args[1]))
  ) {
    throw new Error(
      "Usage: node scripts/release-pr-links.mjs --dry-run [release-pr-number]",
    );
  }
  let body;
  if (args[1]) {
    const result = await refreshReleasePull(
      github,
      REPOSITORY,
      Number(args[1]),
      { dryRun: true },
    );
    if (result.status === "skipped")
      throw new Error(
        "Target is not an open same-repository develop → main PR.",
      );
    body = result.body;
  } else {
    const { data: develop } = await github.request(
      `GET /repos/${REPOSITORY}/branches/develop`,
    );
    body = renderReleaseLinks(
      await collectReleaseSnapshot(github, REPOSITORY, {
        number: -1,
        head: { sha: develop.commit.sha },
      }),
    );
  }
  process.stdout.write(`${body}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  dryRunCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
