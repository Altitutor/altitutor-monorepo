---
name: work-on-ticket
description: Take selected Linear tickets from isolated local development through human feedback, verification, and a develop merge.
disable-model-invocation: true
---

# Work on ticket

Run only when the user invokes this skill. Accept one or more Linear IDs or URLs,
for example `$work-on-ticket DEV-123 DEV-124`.

Invocation authorizes work on those tickets: local worktree/branch creation,
owned local database fixtures, commits, pushes, PR publication, Linear updates,
and a `develop` merge after the gates below. It authorizes following the routed
skills, including user-invoked `grill-with-docs` and `implement`. This is a manual
workflow; keep it separate from Symphony enrollment and unattended pickup.

On resume, reread the tickets and continue the recorded checkout/checkpoint;
retain its lease and restart an expired preview rather than acquiring a new one.

## 1. Select and claim

If no IDs were supplied, ask for them and wait. Read
[`docs/agents/issue-tracker.md`](../../../docs/agents/issue-tracker.md), verify the
connected workspace/team, then fetch every selected issue's full description,
comments, relations, and attachments. Resolve stale claims and blockers before
taking over. Preserve completed/canceled work and the documented Icebox policy.

Record scope, acceptance criteria, owner, UTC claim time, branch/worktree and
next action in Linear. Group tickets only when they form one coherent change;
otherwise give each its own worktree/branch and delivery gates. **Ready:** every
selected ticket has a known disposition and the active work is claimed.

## 2. Isolate

Follow [local-preview.md](references/local-preview.md) to lease a new worktree
from current `origin/develop`, check out an issue-named branch, and start the
required apps with the repository's isolated environment command. Use that path
for every subsequent command. Link each ticket to the branch/PR and follow the
status protocol in [delivery.md](references/delivery.md).

**Ready:** checkout identity is verified, selected apps answer on allocated URLs,
and their connection settings point to the owned, migrated and seeded local DB.

## 3. Resolve the work

Read the relevant code, `CONTEXT.md` and ADRs before asking product questions.

- **Bug:** follow [`diagnosing-bugs`](../diagnosing-bugs/SKILL.md). Establish the
  original symptom's red-capable loop before implementation. An unreproduced bug
  stays in diagnosis with the missing evidence recorded.
- **Clear feature/improvement:** when acceptance and all product/UI decisions
  are resolved by the ticket and existing code, proceed to implementation.
- **Unresolved product decision:** follow
  [`grill-with-docs`](../grill-with-docs/SKILL.md), including its dependencies.
  Resolve code questions yourself; put only remaining human choices to the user.
- **UI beyond reuse of existing components/patterns:** use `lavish`/`lavish-axi`
  for visual alternatives and/or [`prototype`](../prototype/SKILL.md) for runnable
  options. Show meaningfully different choices and your recommendation. Follow
  the preview checkpoint below before adopting a direction.

Apply both diagnosis and design routing when a bug also requires a new UI
decision. **Ready:** reproduction evidence and agreed decisions, as applicable,
are recorded against checkable acceptance criteria in Linear.

## 4. Build in checked increments

Handle a small, obvious, reversible edit directly. For everything else, follow
[`implement`](../implement/SKILL.md), including TDD at useful seams and its final
code review. The commit gates here apply to commits made by routed skills too.

Run focused tests/type checks during development. Before each coherent commit,
run `pnpm check`; resolve failures and warnings, then commit only this work with
the issue reference. Reserve builds and `pnpm checkall` for the final shipping
gate, unless a build is needed to reproduce or verify the actual problem.
Publish decisions and material progress in Linear.

**Ready:** the agreed behavior is implemented, meaningful checks pass, and the
commits cover only the selected work.

## 5. Human checkpoint — whenever needed

Before requesting any visual or functional decision, follow the preview section
of [local-preview.md](references/local-preview.md). Prepare the correct app,
owned test data, account/role and exact page; test the flow yourself first.
Provide a concise decision or test script, expected result, and clickable deep
link. Record the candidate/version and evidence in Linear, set `Awaiting Input`,
and pause dependent work until the user answers. Keep the preview available via
the harness's supported tracked process facility; state its actual lifetime.

On reply, record the verdict, restore `In Progress`, and recheck affected
acceptance criteria. **Ready:** the requested decision is explicit; elapsed time
or a successful automated test does not answer a human question.

## 6. Verify and deliver

Follow [delivery.md](references/delivery.md): assess merge risk, complete any
missing review, run `pnpm checkall`, and require current-head GitHub CI before
merging the selected PR into `develop`. Use `gh-axi` for GitHub operations and
`chrome-devtools-axi` for real-browser verification, reading their installed
skills and current CLI help when first used.

**Done:** the exact reviewed head is merged, merge SHA and acceptance/check
evidence are in Linear, tickets reflect develop delivery (`In QA`), and owned
preview resources are stopped before returning the worktree lease. Report the
PR, result and any remaining QA. Main inclusion and production release remain
separate events.
