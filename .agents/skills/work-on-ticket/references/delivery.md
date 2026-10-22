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
acceptance evidence and any remaining QA; reconcile In QA. Stop the owned local
preview, then return the lease after the branch is safely pushed/merged. Report
develop delivery separately from main, deployment and production verification.
