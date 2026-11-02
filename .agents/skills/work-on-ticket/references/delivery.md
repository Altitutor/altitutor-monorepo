# Linear progression and develop delivery

## Link and reconcile status

Use the connected Linear tools under `docs/agents/issue-tracker.md`. A matching
branch name provides discoverability; it does not prove native automation.
Include every selected issue's canonical reference in commits and the PR using
the repository's existing Linear/GitHub convention. Verify each native issue/PR
link through the connectors; preserve existing associations. Follow repo-specific
diagnostic-only linkage rules when applicable rather than accidentally closing
an unresolved incident.

Inspect available integration evidence and read each issue after lifecycle
events. Rely on native progression only for transitions it actually performed;
otherwise make the corresponding Linear update yourself and read it back:

| Observed event | Ticket state |
| --- | --- |
| Claimed and actively diagnosing/implementing; draft or failing/pending checks | In Progress |
| A specific human decision/test answer is needed | Awaiting Input |
| User answered and work resumed | In Progress |
| Final implementation/review complete; current-head checks pass | In Review |
| All merge gates below satisfied; invocation's develop authorization recorded for this PR/head | Merging |
| Verified merged into develop | In QA |

Record which transitions were native versus manual. Resolve actual state names
from the team if they differ. Apply transitions only to the work delivered by
this PR; an unresolved acceptance criterion leaves its ticket open. `Done`
belongs to the separately verified main-inclusion rule, not a develop merge.

## Review and shipping gate

Record merge risk and a short reason: **low** for a narrow reversible change;
**medium** for behavior across components/services; **high** for auth/RLS,
billing, migrations, data integrity or broad shared behavior. Cover the actual
blast radius and rollback, rather than deciding risk from line count alone.

Count the review already performed by `implement`. For medium/high risk, run
[`code-review`](../../code-review/SKILL.md) if the final diff lacks adequate review;
an installed `no-mistakes` skill may satisfy this check if it covers the same
risks. Discover/read it before use; if absent, use `code-review`. Supply the
fixed merge-base SHA and ticket spec so review can start without another question.
Resolve actionable findings and verify affected paths. Review new substantive
changes after an earlier pass; avoid repeating an unchanged review.

After the last implementation change, run `pnpm checkall` and fix failures. Then
commit any remaining checked changes, push, and create/update the PR to
`develop` with the problem/result, all issue links and concrete validation.
Attach every created PR to the Codex task when that tool is available. Wait for
all required GitHub checks on the exact current head; `pnpm checkall` alone is
not evidence that remote CI passed. Keep the draft/issue In Progress while work
or checks remain, then mark ready and reconcile In Review.

## Merge the selected work

Invocation of this skill is Matthew's authorization for this workflow's
develop merge once decisions, acceptance criteria, review and checks are
complete. Record that authorization with the PR/base/head and risk in Linear;
it supersedes older general instructions to ask again for each develop merge
within this invocation's selected scope. Respect any newer, ticket-specific
hold or outstanding human decision. An answered design question clears that
question only; verify the final implementation's acceptance before merging.

Refresh the PR and `develop`: require the expected repository, base `develop`,
reviewed head, completed human checkpoints, successful required current-head CI,
required GitHub approvals, and mergeability. Resolve conflicts or new changes
with corresponding checks/review before continuing. Merge via `gh-axi` with
`--match-head-commit` set to the verified SHA, following current CLI help and
the repo's merge method. Use normal protected-branch permissions; stop with the
concrete missing review/check/permission if GitHub rejects the merge.

Read the merged PR and issue states back. Publish merge SHA, exact checks,
acceptance evidence and any remaining QA; reconcile In QA. Continue through
cleanup before reporting delivery. Develop delivery remains separate from main,
deployment and production verification.

## Cleanup

Run after verified delivery, including resuming this task's interrupted cleanup.
For pending feedback, follow the retention rules in
[local-preview.md](local-preview.md#prepare-each-human-checkpoint). Ownership
comes from the workpad and runtime receipts; folder age or a matching name is
insufficient. Use existing lifecycle tools during this ticket run.

1. **Preserve evidence.** Publish required screenshots, reports and diagnostics
   to Linear before deleting their local copies. Use the verified PR/base/head
   and merge as proof the work landed on `develop`; a squash merge can have a
   different SHA. Account for any later checkout changes and unique artifacts
   separately. Keep unresolved diagnostic evidence and unmerged work.
2. **Stop owned resources.** Follow the environment guide's stop/recovery path
   for the recorded local runtime and DB. Close this task's browser sessions and
   stop its tracked processes through their owning tools. Verify shutdown and
   capture stopped status while the checkout still exists. Check for remaining
   processes, open files and Docker bind mounts using it. A foreign or unproven
   consumer blocks checkout removal; preserve its ownership evidence. Shared
   browser instances and database resources stay outside this cleanup.
3. **Reclaim the checkout.** Inspect tracked, untracked and ignored files against
   the resource record; preserve unique work and delete only verified disposable
   task artifacts. Release the lease only after the checkout is clean and its
   commits are verified landed. Run lifecycle commands from a surviving directory.
   For Treehouse, read the installed `status`, `return` and `destroy` help. Match
   the exact path and lease to this task, then return only that lease using its
   identity condition. Returning leaves a warm checkout on disk: inspect the
   returned slot, dry-run its exact-path destruction and execute only a guarded
   disposable result. If the slot was acquired or changed, leave it to its new
   owner. For an ordinary Git worktree, use non-forced exact-path removal; use
   the host's archive lifecycle for a host-managed checkout. Preserve branches
   and commits. Bulk operations and overrides of unlanded, lease or in-use
   protections are outside this workflow.
4. **Remove remaining artifacts.** After preserving evidence and stopping its
   consumers, remove the recorded disposable directories outside the checkout,
   including logs and browser profiles. Retain runtime ownership proofs until
   scoped shutdown is verified. A temporary pool's small state files may remain
   if the installed tool has no safe removal operation. Global OS caches and
   resources belonging to other tasks stay outside this cleanup.
5. **Verify and record.** Read back worktree registration and pool state; verify
   recorded resource paths/processes against the captured shutdown receipts.
   Record stopped/removed resources and each retained path with its reason,
   owner and next action in Linear; include the commands/results and
   delivered PR/head/merge. Treat a guard refusal as a cleanup blocker, keeping
   the resource and reporting cleanup pending alongside successful delivery.
   The repository's Git default can be `main`: a pruning tool's refusal is not
   permission to bypass its guards for work delivered to `develop`. Retry this
   task's recorded incomplete cleanup on resume before allocating replacements.
