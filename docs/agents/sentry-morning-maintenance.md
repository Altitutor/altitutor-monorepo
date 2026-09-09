# Morning production-error maintenance

Run this workflow for scheduled production-error maintenance in
`Altitutor/altitutor-monorepo`. Obsidian is authoritative for investigation,
priority, blockers, and fix progress. Sentry and Supabase hold error evidence;
GitHub holds implementation and review. Read this file afresh each run.

Read `docs/agents/production-error-tracking.md` for ticket identity, state
transitions, migration of prior Sentry handoffs, and the durable run ledger.
Create one ticket per underlying bug; link every related source to that ticket.

## Authority and boundaries

The owner authorizes Obsidian maintenance tickets and ledger updates, read-only
production Supabase log scans, autonomous Sentry issue comments, resolution of verified
fixes, confident noise classification, targeted code fixes on separate branches,
and changes to local or remote **development** environments needed to reproduce
bugs. Production application data, configuration, infrastructure, deployments,
and external production side effects are read-only. Never merge PRs, push to
`main` or `develop`, deploy to production, or run production instrumentation.
Sentry issue metadata changes are explicitly authorized and are distinct from
production application changes. Contact affected users only through the owner.

Read root and applicable nested `AGENTS.md` instructions. Read `CONTEXT.md` and
relevant ADRs when investigating a code path. Use
`.agents/skills/diagnosing-bugs/SKILL.md` for each bug. This workflow replaces the
interactive triage checkpoints for this scheduled workflow; retain the tracker
conventions and human decisions. Read tracker handoffs before investigation.

## 1. Inventory and reconcile

Read the Obsidian maintenance ledger and all open maintenance tickets first,
including pending deployments and failed Sentry synchronization. Migrate existing
Sentry handoffs into their canonical tickets as described in the tracking guide.
Run the read-only Supabase scan in `docs/agents/production-error-log-scan.md` and
combine its findings with the Sentry inventory below before prioritizing fixes.

1. Use the Sentry MCP with organization `altitutor`, region
   `https://us.sentry.io`. Discover projects each run and map them to this repo.
   The initial scope includes `admin-web`, `marketing-web`, `student-web`,
   `tutor-web`, `ucat-web`, `student-app`, `ucat-app`, and
   `supabase-edge-functions`. Include new monorepo projects and shared backend
   errors; exclude unrelated repositories. Missing instrumentation or inaccessible
   projects are coverage gaps, not evidence of zero errors.
2. Enumerate **all unresolved production issues**, not just recent activity or
   the review inbox. Verify environment tags against configuration and events;
   start with `production`, and include any verified production aliases. Record
   projects, query, time bounds, run-start UTC timestamp, and pagination coverage.
   The MCP `search_issues` tool currently limits periods to 90 days and returns
   at most 100 results, without a cursor: it is useful for discovery but does not
   prove complete coverage. For exhaustive inventory, use an authenticated Sentry
   API or signed-in UI with all-time search and exhaust every page. The API is
   `GET /api/0/organizations/altitutor/issues/` with `query=is:unresolved`,
   `environment=production`, an explicitly empty `statsPeriod`, and `limit=100`;
   follow the response Link header's next cursor until `results="false"`.
   Deduplicate by numeric issue ID. Validate the API's effective time scope.
3. Prefer an existing `SENTRY_AUTH_TOKEN` with `event:read` for API inventory.
   Read credentials privately; never print them or pass them as literal command
   arguments. The build token in `secrets/.env.development` was verified to lack
   issue-read permission during setup; do not repeatedly retry that credential.
   MCP remains the preferred interface for issue details and mutations. If full
   inventory is unavailable, continue useful work on visible issues and report
   the missing coverage explicitly. A bounded search is not an exhaustive run.
4. For each issue, read its activity, previous maintenance handoff, current
   status, representative production events, release, and linked commits/PRs.
   Discover `get_issue_activity` and `add_issue_note` through
   `search_sentry_tools`, then invoke them with `execute_sentry_tool`. Retrieve
   enough history to find the latest complete handoff and subsequent human
   replies. Also check previously tracked fixes even if native Sentry resolution
   removed them from the unresolved query. Read the canonical Obsidian ticket
   for durable investigation state and Sentry activity for new evidence or human
   decisions. Task history is only a pointer to those records.
5. Resume prior work when a human reply, relevant event evidence, changed code,
   failed validation, PR closure, merge, deployment, or regression changes the
   decision. A higher count alone need not restart diagnosis of the same known
   cause. Reuse the recorded branch/PR. Respect an active human or agent claim;
   before taking over a stale claim, check its task/PR activity. Record owner,
   run timestamp, branch, and intended next action before starting a fix.

Complete when every discovered issue has either a verified existing disposition
or a place in the work queue, and inventory gaps are explicit.

## 2. Triage by impact

Prioritize security exposure, data loss/corruption, incorrect billing, and broad
outages first; then blocked sign-in, payment, teaching, or practice; then degraded
features; then minor defects. Rank within each tier by affected users, recurrence,
recency, and available workaround. Counts without user identity are incomplete
telemetry, not proof of harmlessness.

Choose an evidence-backed disposition:

| Disposition | Required evidence and action |
| --- | --- |
| Already fixed | Identify the exact correcting code and merged commit, verify it covers the event's cause, and check production release/deployment evidence. Resolve with that evidence. If only a branch or development deployment contains it, retain a pending-fix disposition. Silence alone does not establish a fix. |
| Noise | Demonstrate expected, correctly handled behavior or an irrelevant external origin with no actual production-user failure. Inspect event context and the real handling path. Low frequency, zero recorded users, browser/network errors, quota errors, and invalid credentials are insufficient alone. Add rationale, then archive/ignore this individual issue. |
| Needs fix | Investigate in priority order using step 3. |
| Waiting | Read the existing handoff, verify its dependency, and act only when its resume condition is met. Leave unresolved pending evidence or a fix. |

Correlate duplicate symptoms only when evidence establishes the same cause. One
targeted branch may address multiple proven-related Sentry groups, with a handoff
and fix reference on every group, all linking to one Obsidian ticket. Log-only
bugs get Obsidian tickets without manufacturing Sentry events. Distinct causes
get separate branches. Native
Sentry status changes can affect a group across environments: inspect mixed
groups and record any remaining development failure before resolving/ignoring.
Re-read current activity immediately before changing status; preserve newer
human decisions. Never delete issues, merge groups, or add broad suppression rules
as a substitute for triage.

## 3. Diagnose and fix

1. Fetch current remote refs and create an isolated worktree on
   `codex/production-error-<ALTI-id>-<short-description>` from the verified production
   branch (`origin/main` at setup). Search Obsidian, Sentry, and GitHub for existing work
   first. Preserve the owner's checkout and uncommitted changes. Keep durable
   worktrees available while their fixes are pending.
2. **Clear code cause:** when event evidence maps directly to an unambiguous
   faulty path, explain why exploratory reproduction/hypothesis phases are
   unnecessary, then make the targeted fix. Use a red/green regression test at
   the real seam when available; record focused verification and any limitation.
   This is the owner's explicit exception to the full diagnosis loop, not a
   license to fix a guessed cause.
3. **Uncertain cause:** follow the diagnosis skill's feedback loop, reproduction,
   minimization, ranked hypotheses, and instrumentation phases. Try local first
   when it can reproduce the relevant conditions; use remote development when
   hosted auth, RLS, runtime, or integration behavior matters. Publish meaningful
   hypothesis evidence in the Obsidian ticket without waiting for an interactive checkpoint.
4. Before development writes, verify the actual Supabase project reference and
   every downstream endpoint/credential is development/test. Use
   `docs/agents/development-web-smoke-testing.md` and the local-only
   `.agents/.env.development-test-accounts` in the original checkout. Source secrets
   privately; copy only required development variables into an isolated process.
   Development mutation authority includes fixtures and temporary development
   configuration/schema/function changes necessary for reproduction. Keep a
   record and clean up owned fixtures/temporary changes. Use test or stubbed
   billing, email, and messaging integrations so reproduction cannot affect real
   customers. Permanent migrations/functions ship through normal CI/CD after
   human merge. Applied remote migration files remain immutable, including ones
   applied to development; verify history and create a new migration instead.
5. If reproduction succeeds, apply the diagnosis skill's targeted fix and
   regression verification. For SQL migrations, complete the local reset,
   applicable UCAT seed, and generated-type steps required by `AGENTS.md`.
   Remove debug instrumentation and temporary harnesses, retaining useful
   regression artifacts. Run the repository shipping gate (`pnpm checkall`;
   follow `/check-and-commit` if available). Report failed checks accurately.
6. If still uncertain or not reproducible, stop speculative code changes for
   that issue. Record attempts, commands and sanitized results, what remains
   unknown, and the next discriminating evidence. Leave it unresolved. Ask the
   owner a specific question when user context would help, such as the action,
   approximate time, browser/app version, or a redacted recording. Continue other
   issues. Do not request production writes or direct user outreach.

Complete when each attempted bug has either a validated targeted fix or a
durable investigation handoff with a specific next step.

## 4. Publish fixes and maintain resolution

Commit each fix with the demonstrated cause, validation, and a separate
`Fixes <SENTRY-SHORT-ID>` line for every issue actually fixed. Push the feature
branch and open a draft PR against `main` for the owner to review. Include the
same fix references in the PR description so squash-merge can retain them.
Also reference the Obsidian ALTI ID. Log-only fixes use that ID and have no Sentry
fix line. Record the branch, head SHA, PR URL, tests, and next step in the
Obsidian ticket; post a short ticket/PR reference to each linked Sentry issue. If checks, commit, push, or PR creation fail, retain the work and record
the precise blocker; label the work unvalidated or unpublished as appropriate.

Verify Sentry recognizes the commit/PR reference. The GitHub integration for
this repository was active at setup, but a recognized `Fixes` commit alone did
not resolve an observed issue. Automatic resolution can depend on release/commit
association. Keep pending fixes distinct from deployed fixes and verify merge,
release/deployment, and Sentry status on subsequent runs. Report missing
integration/release linkage; do not promise resolution on merge without evidence
or alter production release infrastructure. Resolve manually once a deployed fix
is verified if native automation did not do so. If a post-fix production event
still demonstrates the same bug, reopen/resume it; distinguish old clients or
events from the fixed release. Do not reopen solely because deployment is pending.

## 5. Reconcile and checkpoint

Follow the tracking guide to update the canonical ticket, then reconcile every
linked Sentry group's native status. Resolve verified deployed fixes and ignore
confident noise; a ticket or PR alone does not resolve an issue. Retry failed
Sentry writes on subsequent runs, including for tickets whose fix is complete.
Read back changes; after a write timeout, check activity before retrying.

Reconcile both inventories against final outcomes and check for new Sentry issues
once more. Every discovered item must be resolved, verified noise, linked to a
pending fix, or investigated with a concrete next step. Persist Supabase scan
coverage, dispositions, and checkpoints in the Obsidian run ledger. Separate
successful scanning from completion of fixes: advancing a scan cursor requires
all its findings to be durably recorded, not all bugs to be fixed.

Time/access/tool failures make a run **partial**: record unprocessed IDs/counts,
source/time coverage gaps, and next steps. An untouched queue item is not an
investigated bug. If Obsidian writes fail, preserve evidence and existing work,
report the blocker, and stop starting fixes that cannot be handed off. If only
Sentry synchronization fails, queue that failure in the ticket and continue
independent work. Resume partial work by impact on the next run.

Notify the owner in this task only for meaningful changes, completed fixes,
failures, or required action. Include counts, ALTI IDs, Sentry/PR links, coverage
or validation gaps, and precise questions. Stay quiet when nothing actionable
changed; do not repeat unchanged requests every morning.
