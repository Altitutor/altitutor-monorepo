# Release PR issue links

DEV-198 maintains explicit issue intent on same-repository `develop` → `main`
release PRs. [Linear's GitHub documentation](https://linear.app/docs/github)
explains that batch release PRs do not inherit issue links from source PRs;
multiple closing directives in the body work, while references do not apply
the merge-completion status. This action needs only GitHub metadata and the
repository's existing Linear GitHub integration. It has no Linear credential,
service, ledger, or paid integration.

## Behavior

The action refreshes on release PR open/reopen, head synchronization or body/base
edit, on `main` pushes, and through **Release PR issue links → Run workflow**.
Manual reruns discover all open release PRs and pick up corrected source metadata.
It writes only between `<!-- altitutor-release-links:start -->` and
`<!-- altitutor-release-links:end -->`; surrounding human text is preserved.
Incomplete, duplicated, or reversed markers fail without writing. An unchanged
body is not patched, preventing edit loops. Do not put these markers inside a
code fence, quote or HTML comment; the generated directives need normal body text.

It compares immutable current `main` and release head SHAs, paginates all commits
and commit-associated PRs, excludes the release itself and previously released
PRs, and uses merged source PRs targeting `develop` only when their merge SHA is
actually in the comparison. A squash merge into `develop` is supported through
its included merge SHA. Source titles/bodies and included commit messages supply
the explicit directives. Association alone, branch names and incidental IDs
never establish closing intent.

Use standalone lines such as:

```text
Fixes DEV-198
Refs DEV-181, DEV-193
Related to DEV-186
```

The documented closing/non-closing/relation keywords are supported, including
lists and canonical `https://linear.app/altitutor/issue/DEV-n/...` URLs or matching
Markdown links. Quoted/code examples, foreign workspace URLs, mismatched links
and prose around a directive are flagged for review. `Skip`/`Ignore` suppress a
link. Conflicting explicit intents suppress that issue's generated link.
Correct unclear source metadata and rerun; the action never guesses mappings.

Diverged history, absent source merge anchors, ambiguous source PR associations,
or revert/cherry-pick evidence withhold all generated closing links and emit
review warnings. Explicit reference/relation links retain their original intent.
Commit/PR text lacking DEV metadata is flagged. Reverts and cherry-picks are
detected from metadata, not semantic patch analysis: unmarked rewritten commits
cannot be reliably resolved. History warnings must be reviewed before release.
Prefer merge commits for releases from long-lived branches and back-merges of
`main` into `develop`; the action never changes history or merge settings.

One serialized writer re-reads current head, main, body and update timestamp
immediately before PATCH and retries a changing release up to three times. It
also checks state after PATCH and recalculates if refs/body changed. GitHub's
[PR body update API](https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request)
has no documented atomic body/head compare-and-swap: a human edit or merge in
the final read-to-PATCH interval remains a narrow race. Avoid editing/merging
while a refresh is running; rerun after concurrent changes. No claim of atomic
preservation is made. Large bodies and incomplete pagination fail without writes.

## Trust and activation

The new workflow alone requests `contents: read` and `pull-requests: write`.
Actions are pinned to upstream SHAs. Every trigger checks out only trusted
`refs/heads/main`, with credentials not persisted and only the script selected.
It never checks out or runs release/fork code, installs dependencies, interpolates
PR text into shell code, merges, deploys or changes protection/settings. Existing
CI runs the Node contract tests with the other release-gate tests.

Local implementation is not activation. After review and separate publication
authorization, push `codex/release-pr-dev-links` and open a PR to `develop` with
`Fixes DEV-198` in its body. Run the required CI/review gates, then have a human
merge it. The workflow and script must subsequently reach `main` through a
human-reviewed release (use a merge commit for that long-lived branch). The first
release cannot rely on an action not yet installed on `main`; prepare its links
manually from the dry run. Once installed on `main`, the main-push event refreshes
any open release PRs. Open a release PR or manually run the workflow on `main` to
verify the generated section. No publication, activation or merge is performed
by the local implementation task.

## Local verification

```sh
node --test scripts/release-pr-links.test.mjs
node scripts/release-pr-links.mjs --dry-run
node scripts/release-pr-links.mjs --dry-run 123
```

The CLI uses the existing `gh` login and **GET only**. With no PR number it audits
live branch history even if there is no open release PR. A PR number must identify
an open same-repository `develop` → `main` PR. It prints a candidate body only;
no local command can activate the writer. The monorepo shipping gate remains
`pnpm checkall`; use the owned disposable database procedure for database stages,
never an old worktree's bare shared-stack reset.
