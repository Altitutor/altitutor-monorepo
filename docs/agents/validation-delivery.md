# Validation and develop delivery

CI is the authoritative integration gate. Local checks establish the behavior
under development; the CI validation plan establishes which domains the complete
integration must verify. Publish both scopes accurately. Main inclusion,
deployment and production effectiveness remain separate evidence.

Rollout is evidence-gated: the change introducing this policy must pass its
applicable existing checks and independent review. It cannot use its own new
selection to waive a failed or missing gate. After verified rollout, required
CI is authoritative for the unique contracts it actually runs. Keep any contract
not yet represented there as an explicit required local/full-profile gate until
its CI coverage is verified. Native queue activation is a separate authorized
step below; code merge alone does not activate it.

## Select the evidence

- During implementation, run the relevant lint, types and behavioral tests at
  the actual seam. Use `pnpm check` for broad/shared changes or when their impact
  cannot be bounded. A focused run is not a monorepo pass.
- CI runs core checks and the domains selected by `scripts/validation-plan.mjs`.
  The plan uses the complete PR, merge-group or push event base/head, retains
  the checked-out commit/tree separately, and records excluded gates. Missing,
  divergent or unreadable ranges and unclassified runtime changes select full
  validation. Authentication/permissions and Supabase changes retain database,
  Edge and affected data-backed browser coverage. Keep unknown paths conservative.
- `pnpm checkall --profile full` is the explicit local full reproduction profile.
  It retains lifecycle contracts, generated artifacts, database/Auth/interview
  contracts, builds and critical browsers, including contracts not replaced by
  a selected CI job. Run it when changing these unique contracts or their
  orchestration, reproducing an integration failure locally, or when the task's
  acceptance explicitly requires local full evidence. A code change touching a
  unique contract still needs that contract's own passing test; a general CI
  result does not replace it. `--database-only` records a database profile,
  never a full pass.
- Reuse valid task-cache results. UCAT coverage supplies the UCAT unit execution
  only when its test inventory matches the ordinary unit suite; otherwise fail
  the inventory guard rather than omit tests. Keep failed, canceled, blocked,
  skipped and not-run stages distinct.

For a conflict-free base update, compare the entire reviewed patch against the
new base, not just changed-file names. Record the original review, patch digest,
new base and tested tree. Preserve unchanged review evidence; run integration
checks required by the new plan. Repeat a full local profile only for changed
implementation/integration behavior or a newly implicated contract. A conflict
resolution or altered patch requires fresh affected checks and substantive
review. Never reuse old-head CI as the new integration's success.

## Receipts and readiness

Local profiles write a JSON receipt with owner/assignment revision, base/head,
dirty-source state, required stages, durations and outcomes. Inspect it with:

```sh
node scripts/validation-receipt.mjs status --file /path/to/receipt.json --expected-revision 3
```

The collector writes stage boundaries directly; it does not infer success from
log text. Exit zero with missing stages remains incomplete. A dirty worktree
receipt describes that run, not a certified clean commit. A killed collector
leaves running/not-run stages incomplete. Retain the receipt and log outside an
ephemeral checkout until portable results are published in Linear.

Before starting queued work, reread the current assignment revision and candidate.
A superseding assignment names the replaced revision and stops or reschedules
its owned work. Each receipt mutation requires the expected revision. This is
a consistency check, not an atomic distributed lease: the coordinator must
still publish and independently read back current ownership.

Ready handoffs identify these fields in a JSON record:

```json
{
  "version": 1,
  "assignment": { "owner": "DEV-123 / thread-id", "revision": 3 },
  "repository": "Altitutor/altitutor-monorepo",
  "pr": 123,
  "target": "develop",
  "sourceHead": "40-character reviewed source commit",
  "sourceTree": "40-character source tree",
  "base": "40-character integration base",
  "integrationHead": "40-character tested integration commit",
  "integrationTree": "40-character tested integration tree",
  "reviewHead": "40-character reviewed commit",
  "reviewResult": "clear",
  "patch": {
    "sourceSha256": "64-character original binary diff digest",
    "integrationSha256": "64-character integrated binary diff digest"
  },
  "ci": { "head": "40-character integration commit", "conclusion": "success", "url": "https://github.com/Altitutor/altitutor-monorepo/actions/runs/123" },
  "authorization": "Recorded invocation or explicit approval reference",
  "holds": []
}
```

Replace placeholders with actual evidence. `validation-receipt.mjs ready --file
record.json --expected-revision 3` checks consistency: current integration CI,
reviewed source or reviewed integration, unchanged patch proof where applicable,
and no unresolved holds. It does not query GitHub, grant authority or certify
the record's truth. Independently read the issue, reviews, source SHA, required
checks and queue state immediately before admission. A candidate may enter the
native queue after its PR gates pass; its final ready receipt is completed when
the queue's integration gates pass.

## Queue admission and recovery

Keep machine capacity and develop delivery separate. A capacity permit names
the machine, owned processes/runtime and assignment revision. Release it after
those consumers stop, even while remote CI continues. Cleanup of an inactive
retained checkout does not retain a target window. Independent machines may
verify concurrently within their own safe budgets.

Native GitHub merge queue is preferred once activated and verified. Enqueue
reviewed, authorized PRs with completed decisions, passing PR gates and no
ticket-specific hold. The queue owns integration ordering; preserve source
reviews while testing the queue's complete combined tree. On failure, retain
the integration SHA/plan and failed gate, distinguish source from interaction or
infrastructure failure, and repair only the owned cause before re-entry. A stale
source head or new human hold withdraws readiness. Verify the actual merged PR
and tree before updating Linear. Queue batch limits do not promise one CI run
for multiple PRs.

Until native queue activation is independently verified, use one named delivery
coordinator and a bounded target window shared by all participating owners.
Publish READY/request, TAKE, and verified merge/blocker/RELEASE receipts; a
request or capacity release is not target ownership. Admit only candidates ready
for publication/integration; do not reserve the target during implementation or
user decisions. External target movement invalidates the prepared integration:
fetch actual develop, preserve or re-review the patch, and rerun the required
integration gates. An advisory receipt cannot prevent an uncoordinated merge;
stop repeated churn and coordinate the active owners instead of bypassing rules.

## Native queue activation runbook

The repository is public and owned by an organization, so GitHub's public-org
merge queue eligibility applies; private-org Enterprise requirements are not
the blocker here. Configuration still requires the authorized administration
surface. These code changes do not enable a ruleset.

1. Wait for the CI changes in this delivery to be verified merged. Inspect the
   current effective develop rules and record their IDs/configuration. Verify
   core and auxiliary required workflows handle `merge_group` and classify its
   complete base/head range, with stable aggregate checks for selected/skipped
   work. Confirm a real integration run can produce the required contexts.
2. Using authorized administration access, patch only the develop-targeting
   rule to require the queue. Preserve existing required checks/app bindings,
   reviews, security rules and bypass policy. Read the current configuration;
   never replace a ruleset from an unchecked hardcoded document or ID.
   The inspected required contexts were `Lint`, `Type Check`, `Test`,
   `UCAT Contracts`, `Build`, `Detect web system tests`, and
   `Web Browser and Database`, each bound to GitHub Actions app **15368**.
   Preserve that exact mapping and any newer effective requirements discovered
   during the fresh read; this list is evidence, not a replacement ruleset.
3. Start with the following conservative settings, which are recommendations
   pending a live queued smoke test: merge method **SQUASH**, grouping strategy
   **ALLGREEN** (only merge non-failing pull requests), build concurrency **2**,
   minimum merge size **1**, maximum merge size **1**, minimum-group wait **0**,
   and status-check timeout **120 minutes**. The timeout exceeds the current
   90-minute suite cap and the historical approximately 24-minute healthy
   pipeline, with margin for parallel execution and cold database startup.
   Maximum size 1 isolates the rollout and failures. Increase concurrency or
   grouping only from observed queue throughput, resource use and failure
   isolation; revise the timeout from measured healthy tail latency. Merge
   grouping limits do not batch builds.
4. Read back the effective rules and enqueue a reviewed test candidate through
   normal permissions. Verify actual merge-group trigger, complete plan,
   required results, source/integration association and normal merge. Record
   activation evidence and recovery owner before retiring the advisory window.
   Passing local negative aggregate contracts already proves failures and
   missing selected results cannot be reported as success; it does not replace
   this actual queued smoke after the settings change.
5. On a configuration failure, pause admission and repair the missing trigger,
   context or selection. Preserve protections; rollback only the authorized
   queue-setting change if needed, with readback and explicit fallback ownership.

Reference: [GitHub merge queue configuration](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue).
