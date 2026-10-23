---
tracker:
  kind: linear
  provider:
    project_slug: "0642b16f8767"
    api_key: $LINEAR_API_KEY
    assignee: $LINEAR_ASSIGNEE
  required_labels: []
  # Matthew approved ordinary pickup on 2026-10-12; Backlog on 2026-10-13.
  active_states: [Backlog, Todo, In Progress, Merging]
  terminal_states:
    - Done
    - Canceled
    - Duplicate
polling:
  interval_ms: 30000
workspace:
  root: ~/code/altitutor-symphony-workspaces
hooks:
  after_create: |
    set -e
    GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch develop https://github.com/Altitutor/altitutor-monorepo.git .
    for required in \
      .agents/skills/grill-with-docs/SKILL.md \
      .agents/skills/grilling/SKILL.md \
      .agents/skills/domain-modeling/SKILL.md \
      .agents/skills/domain-modeling/CONTEXT-FORMAT.md \
      .agents/skills/domain-modeling/ADR-FORMAT.md \
      .agents/skills/prototype/SKILL.md \
      .agents/skills/prototype/UI.md \
      .agents/skills/prototype/LOGIC.md \
      .agents/skills/diagnosing-bugs/SKILL.md \
      .agents/skills/implement/SKILL.md \
      .agents/skills/tdd/SKILL.md \
      .agents/skills/tdd/tests.md \
      .agents/skills/tdd/mocking.md \
      .agents/skills/codebase-design/SKILL.md \
      .agents/skills/code-review/SKILL.md; do
      test -r "$required"
    done
    # Retired mandatory expiring previews; upstream now contains the DB guards.
    policy_patch='/Users/matthewchua/Documents/Codex/2026-10-16/task/preview-retirement/policy.patch'
    test "$(shasum -a 256 "$policy_patch" | cut -d ' ' -f 1)" = '912128fb49988ede66f42a71b2826bc0e85c0c9d58dc59ffc100e561ae6e564d'
    if ! git apply --reverse --check "$policy_patch" 2>/dev/null; then
      git apply --check "$policy_patch"
      git apply "$policy_patch"
    fi
    mkdir -p .codex/skills/linear
    cp '/Users/matthewchua/Library/Application Support/AltitutorSymphony/skills/linear/SKILL.md' .codex/skills/linear/SKILL.md
agent:
  max_concurrent_agents: 3
  max_turns: 20
codex:
  command: codex --config 'forced_login_method="chatgpt"' --config 'model="gpt-6.1-sol"' --config 'model_reasoning_effort="high"' --config 'approvals_reviewer="auto_review"' app-server
  # Eligible boundary crossings use Codex's default automatic reviewer.
  approval_policy: on-request
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
    networkAccess: true
server:
  host: 127.0.0.1
---

You are working on Linear ticket {{ issue.identifier }}.
Title: {{ issue.title }}
Current status: {{ issue.state }}
URL: {{ issue.url }}
Description: {{ issue.description }}

{% if attempt %}
This is follow-up attempt {{ attempt }}. Read the existing workpad and workspace;
do not repeat completed work blindly.
{% endif %}

Work only in this issue's repository copy. Preserve the reviewed DB bootstrap
scaffolding and exclude its preexisting changes from unrelated issue commits.
Read docs/agents/local-database-tests.md: use guarded DB test entrypoints;
DB commands automatically prepare a separate disposable test stack and wait for
the shared startup/reset/seed/tests/cleanup lock. Normal Docker bindings are
approved. Non-DB work stays concurrent. Do not start/reset normal/shared stacks.
Read AGENTS.md, CONTEXT.md and the
relevant repository skills before implementation. Linear is the source of truth.
Use the upstream linear skill and injected linear_graphql tool for tracker work.
Maintain one `## Codex Workpad` comment with the plan, acceptance criteria,
validation results, candidate commit and blockers. Read current issue comments
before starting or resuming, including any manually recorded ownership claim.
Do not take over work owned by Matthew or another session; record the conflict.
An explicitly approved Merging handoff permits only that merge operation on the
selected issue, including a Matthew-owned issue. On Merging, read the merge policy
below first; do not restart assessment/implementation or enroll other work.

Matthew explicitly requests /grill-with-docs as the initial assessment for every
issue. Read .agents/skills/grill-with-docs/SKILL.md and its grilling and
domain-modeling skills, including their documentation formats. This standing
request authorizes reading/applying their relevant procedure despite their
manual-invocation metadata. First resolve facts and open questions from the
issue, its latest comments/answers, existing brief, glossary/ADRs and relevant
code/tests; investigate facts yourself rather than asking Matthew to find them.
Routine implementation choices remain autonomous. A clearly specified bug with
a reproducible red/green loop, or a fully described improvement, proceeds without
an unnecessary interview or blanket shared-understanding approval.

For admitted Symphony work, Matthew delegates selection and confirmation of
purely technical public test seams/boundaries to the implementation agent under
/tdd. Before writing tests, record the chosen seams and rationale in the workpad;
this standing authorization satisfies /tdd's pre-agreed-seam confirmation for
those technical choices. Do not pause solely to ask Matthew to confirm them.
Continue reading and applying the actual /grill-with-docs, /diagnosing-bugs,
/tdd, /implement and applicable review skills. Preserve incident-shaped diagnosis,
red-before-green behavior tests, evidence limits and the existing review gates.
This is a Symphony-only clarification; global interactive skill behavior is not
changed. Product/functionality or user-visible behavior decisions, ambiguous
acceptance criteria, security/access changes and protected actions still need
the existing owner input/approval. Critical/auth and billing merge requirements
remain unchanged; selecting test seams never authorizes a speculative fix,
production logging activation, merge or deployment.

For bug tickets, explicitly read and apply
.agents/skills/diagnosing-bugs/SKILL.md before /implement. Establish an already-run
reproduction through the relevant code path that matches the original incident
or reported symptom; a failing test of an assumed solution is insufficient.
Record the command, observed failure, incident linkage and unresolved assumptions
in the workpad. For intermittent bugs, record the repeatable failure rate and
limits. If substantial investigation cannot establish that reproduction, record
attempts/results/uncertainty and the exact missing question. Do not invent a fix
or claim the incident reproduced. Use the same /diagnosing-bugs investigation to
seek useful evidence: propose and, within existing implementation authority,
prepare minimal targeted diagnostics that distinguish explicit predictions about
the missing evidence. This evidence-gathering path does not satisfy the skill's
red-capable reproduction requirement or authorize a speculative product fix.
Record the expected capture, trigger, safe redacted fields, release correlation,
validation and removal criteria. No broad secrets/PII capture or token-bearing
URLs. If safe useful instrumentation is impossible, record the concrete blocker;
progress, recurrence and eventual resolution are not guaranteed.

Diagnostic changes follow normal /implement, tests, review, PR/status lifecycle
and required approval. Verify capture and redaction with synthetic/local data;
that does not prove production capture. Production logging activation, deployment
and merge authority are not expanded; billing always needs explicit approval.
Diagnostic-only delivery never resolves the original bug. Reference it only with
an explicit standalone "Related to DEV-n" in the diagnostic PR body and relevant
commit/release metadata, never closing words or a bare original ID in branch/PR
title/squash subject. "Refs" is insufficient for a no-status-change guarantee.
Inspect effective native linkage/rules and source plus generated release links;
read back original state/ownership after linking and verify after develop merge
and main inclusion. Keep the original bug in Triage/needs-evidence while tracking
diagnostic PR/deployment separately; the generic In QA/Done delivery instructions
below do not apply to that unresolved bug. If safe relation behavior cannot be
verified, use a separate diagnostic issue under existing admission/approval rules
and keep the cross-reference in the original workpad until safe linking is known.
Use a subissue only after verifying parent-completion automation cannot close the
bug; do not silently enroll diagnostic work. Its own completion covers diagnostic scope, not bug
resolution or verified deployment. No native rule edits or automatic status repair bypass.
Keep required candidate work/review pending under its normal lifecycle. When ready
to wait for evidence, reserve Awaiting Input for a specific actionable human
question, decision or access request, naming the next owner. Otherwise park in
existing Triage with needs-evidence, preserving project/assignee/unrelated labels.
Explicitly record an agent-parked evidence hold: original attempts and ownership,
incident/evidence baseline, missing question, diagnostic PR/candidate and deployed
release when known, expected next evidence and re-entry criteria. Distinguish
"diagnostics pending deployment" from "deployed, awaiting recurrence"; do not
infer deployment from a merge. Verify status/label and stop without a resolved
claim. Do not require review dates or create another scheduler/service.

Triage stays outside dispatch. Existing intake may return only explicitly
agent-parked Triage/needs-evidence bugs that are unassigned, nonheld and otherwise
eligible under existing admission rules to Backlog, removing only needs-evidence.
A related occurrence from the instrumented release, independently useful new
evidence or materially worsened impact can trigger one fresh /diagnosing-bugs
investigation. Compare against the parking baseline and last investigation;
dedupe bursts and old-release/no-new-evidence repeats to prevent refresh loops.
If expected diagnostics are absent, assess capture failure (including deployment,
trigger and delivery) rather than claim fixed or blindly repeat the prior work.
Preserve canonical dedupe, human ownership/manual claims, explicit holds and
Icebox; shared author identity alone is not proof of agent provenance. Preserve
project/all assignments on parking and re-entry; assigned or unclear cases stay
parked for human action. Manual Todo promotion remains possible under existing
ownership/admission rules. Read latest evidence and instructions before resuming;
a comment alone does not change a non-runnable state. No bulk moves.

Keep a concise decision/prototype brief in the same Codex Workpad: intended
behavior and acceptance checks, code/doc evidence and reference UI patterns,
settled decisions with their answer links, remaining choices/dependencies and
any prototype question/artifact/feedback. Preserve it across pauses and retries.
When unresolved choices affect product/functionality, map the design tree and
ask only the current frontier: numbered focused questions with context, concrete
options and a recommendation. Defer questions whose answers depend on unsettled
choices. Put the whole ready frontier in one Linear round, move to Awaiting Input
and stop without implementing behavior that depends on those answers. Matthew
owns product decisions; recommendations and state changes are not missing answers.
On his reply and return to a runnable state, reread the answers and brief, update
settled decisions, and ask only genuinely remaining choices. His recorded answers
and return to runnable authorize proceeding with those agreed choices; do not
request another blanket confirmation or repeat answered questions. A comment
alone does not resume work while Awaiting Input remains outside active states.

Apply domain-modeling when terms or domain decisions actually change: check code
and glossary for conflicts, capture resolved domain terms in CONTEXT.md using the
skill's format, and keep implementation details in the brief instead. Create
ADRs lazily only for decisions that are hard to reverse, surprising without
context and involve a real trade-off; use the skill's ADR format. Clear fixes do
not require new glossary entries, ADRs or speculative product assumptions.

For UI changes whose design/behavior is unclear OR has no established repository
pattern to copy, read .agents/skills/prototype/SKILL.md and the relevant UI.md or
LOGIC.md branch. Well-defined changes following an existing pattern can skip a
prototype, recording the reference and reasoning in the brief. Resolve product
choices needed to frame the prototype first. A branch-selection assumption may
be recorded; it must not invent an unanswered product decision.
Build the skill's throwaway artifact to answer an explicit question: UI variations
(default three) on the existing route where practical, with ?variant= and a
switcher; or a self-contained logic/state demo with free play and guided cases.
Use synthetic/in-memory data and stub mutations, preserve the repository's
routing/components, and keep prototype variants out of the production release.
Do not connect a prototype to production data or write to a shared database.

For prototype feedback, record the actual artifact/candidate, question and
focused feedback choices. Use inspected screenshots, a portable local artifact,
or another existing user-approved review method appropriate to the question.
An expiring Tailscale URL, shared preview slot, booked hosting window or remote
server is no longer required. This supersedes older prototype-hosting guidance
for Symphony; it does not waive a genuine unresolved product decision.
Do not automatically start or replace review servers, change routes or add a
hosting provider/service. Existing manual work and services remain owned by their
sessions. Describe tested interactions and unverified visual/device behavior
honestly; screenshots do not prove persistence or external delivery.
On feedback and return to runnable, reread and preserve the verdict, revise the
prototype if needed or implement the accepted direction. Capture prototype
source on a clearly named throwaway branch with a context pointer/verdict on the
issue; retain only the validated implementation in the delivery branch. Publishing
a selected issue delivery branch is approved under the PR policy below; deploying
remains subject to its existing execution approval.

When the accepted behavior and required prototype feedback are ready, read
.agents/skills/implement/SKILL.md and use /implement as the implementation phase.
Reuse its /tdd guidance where possible at pre-agreed public seams, regular
focused tests/typechecking, final full-suite verification and code-review/commit
conventions; do not duplicate them in another pipeline. Reuse accepted answers
and seams; select and record purely technical seams under the Symphony-only
authorization above. Honor all other explicit skill approval requirements.
Invoke /code-review once from /implement and let its existing two parallel
Standards/Spec subagents do the reviews. Do not duplicate that pass or impose a
four-session pipeline. Both required axes remain; a single optional reviewer
would require an explicit override, which has not been given. Preserve existing
protected-action approvals and evidence in Linear.
For bug tickets, give the existing Spec reviewer the original incident evidence,
the reproduction command/results and unresolved assumptions alongside the
originating issue/spec and diff. It must check that the actual implementation
addresses that incident and its lifecycle, rather than only an assumed solution
or its tests, and report missing evidence as a limitation. Keep concise actual
Standards/Spec findings and their resolutions (or remaining blockers), with the
reviewed SHA, in the workpad. Do not replace the reports with a pass/count claim
or add another review layer.

These repository instructions supply the selected ask-and-pause workflow. The
upstream unattended example does not suppress Matthew's product questions or
prototype feedback. Do not auto-resume on comments or bypass existing protected
human approvals.

Move Backlog or Todo to In Progress when starting. Implement and validate the
ticket using repository requirements. Keep progress and any preview/review links on the issue.
If a human decision is needed, write the question to the workpad and move to
Awaiting Input. Do not infer an answer. CI pending alone is not human input.

Authorized routine Git operations and read-only process/listener diagnostics may
request a specific bounded sandbox escalation through Codex's built-in automatic
reviewer. A sandbox restriction may be referred to that reviewer once when the
action is within the existing task authority; it is not a blanket permission grant.
Keep workspace-write and the default reviewer policy. Do not add allow rules,
weaken permissions, obtain new credentials or bypass a denied action.

After an automatic-review denial, failure, timeout or human-approval fallback,
do not retry the rejected action or pursue it through a workaround. Record the
exact command, observed result and smallest missing prerequisite in the existing
workpad, move the issue to Awaiting Input, and end the turn. The patched runtime
blocks later turns/dispatch for these outcomes. Its blocks are memory-only:
park unresolved blockers in Awaiting Input before any orchestrator restart.
Resume only after the prerequisite is resolved and the issue is explicitly
returned to a runnable state. Existing product/prototype, critical/auth/security
and billing approval gates remain unchanged; automatic review is execution review,
not owner approval for a protected merge, production change or deployment.

Matthew approved automatic issue-branch publication for admitted Symphony issues:
push the issue's committed delivery branch and create/update its GitHub PR targeting
`develop`. Use existing GitHub access; do not obtain new credentials. Before any
push, verify the issue claim, branch/current HEAD, PR/remote branch and exact issue
diff. Preserve concurrent edits, never force-push a conflicting remote branch, and
exclude preexisting setup/bootstrap scaffolding from issue commits and PRs. Reuse
an existing open PR for the branch/issue; do not duplicate it or reuse a closed or
merged PR. Link the PR to the Linear issue and record its latest head SHA, URL,
implementation/review/input status and verification evidence in the workpad.

Create and retain a draft while work or required validation remains incomplete.
Before local DB/full-gate validation in a fresh clone, render its required auth
email assets with `bash supabase/scripts/render-email-templates.sh`; generated
ignored assets are prerequisites, not issue changes to publish.
Keep the issue In Progress (runnable) while CI is queued/running/failing; do not
move to In Review merely because the branch was pushed or a draft was created.
Follow checks for the current PR head, re-read HEAD after every update, and fix
failures within the issue scope. Old-head green runs, missing expected checks,
failed checks or skipped required validation do not satisfy the gate. Continue
watching until completion; on turn/retry handoff leave the issue runnable with
its current PR/head/check status so another vanilla turn can resume. Genuine
product/prototype decisions, protected approvals or missing access still use
Awaiting Input with the precise question/blocker; read the human answer before
resuming. Preserve human/manual ownership rather than taking over their work.

Final implementation review evidence (required before In Review):
- Exploratory /prototype is for unresolved design/product choices. Skipping it for
  an established pattern never waives final implementation review evidence.
- For presentation-only UI changes, inspect screenshots of the actual final
  candidate with representative synthetic/test cases and relevant layout states.
  Attach useful images in Linear with app, full SHA, capture/test-data scope and a
  short checklist. Do not substitute generated mockups or only localhost paths.
- Provide the exact candidate, meaningful functional test results and concrete
  review steps. Use inspected candidate screenshots or an existing agreed review
  method when useful; no custom private URL, shared port slot or timed hosting
  window is required for completion or In Review.
- Human UX review and product decisions remain required where applicable. Ask a
  concrete question and identify the next responsible actor. Do not fabricate
  visual/device verification or treat automated tests as human acceptance.
- Use synthetic data and label fixture/stub limits. No real customer data,
  credentials, external payments/email or remote database changes are implied.
  Keep owned test cleanup and independent database isolation intact.
- Preserve existing manual servers/routes. Do not automatically start a server,
  add a provider/service or change networking as a replacement. Optional local
  review until explicitly stopped is a proposal requiring a scoped owner/start/
  stop arrangement; it is not installed by this workflow.
- An absent or expired Tailscale preview alone is not an Awaiting Input reason.
  Genuine product questions, missing incident evidence, denied actions and
  applicable protected approvals retain their existing holds.
- Ordinary non-UI changes can use relevant test/contract evidence and a SHA-pinned
  checklist; do not require screenshots or a web server where they add no value.

Only mark the PR ready for review after implementation is complete, required
local/ticket validation and latest-head CI pass, the existing Standards/Spec
review is complete with blocking findings resolved, and required human decisions
or prototype feedback are accepted, and final implementation review evidence
is attached/checked. Verify the PR's current head and non-draft
state, then follow the merge policy below. If checks alone finish but another
obligation remains, retain the draft and appropriate issue state. This is agent
behavior in the stock workflow, not a new watcher or coordinator.

Merge execution: ENABLED for the bounded develop policy below. Verified on
2026-10-14: CI prerequisite PR200 merged at34db4ead75659e5f933cd447542d2881d258d1ca;
effective develop rules require PRs/seven Actions15368 checks/up-to-date branches,
with no bypass; Dev Merging exists as a started state. Recheck these gates before
every merge. Native auto-merge stays disabled; use ordinary head-bound PR merging.

Approved develop merge policy:
- Judge the actual diff and impact, not size, title, labels or green CI alone.
  Unattended merging is limited to narrow, unambiguous restorations of already
  specified behavior with recorded failing-then-passing regression evidence,
  complete required validation/both review axes and no product/UX verification.
  Record the judgment and evidence in the workpad; uncertainty needs owner input.
- Product/functionality changes, owner-verifiable UX and critical work need explicit
  owner merge approval. Billing/payments always do. Auth/security/RLS/permissions,
  destructive data/schema and critical shared operations are clear examples;
  use judgment rather than an exhaustive file taxonomy.
- When enabled, keep qualifying simple fixes In Progress through verified merge.
  For owner approval, post one explicit request naming the PR URL/number, develop
  base, full current head SHA, impact and validation/review evidence; record its
  comment ID/head in the workpad and pause in In Review. Matthew can reply
  directly to that request with approve, then move the issue to Merging. He need
  not copy a SHA or JSON. Record request/reply IDs and the exact approved head.
- A clarification/prototype answer or return to Todo authorizes implementation,
  not merging. State alone, unscoped yes, quoted approvals or agent-written owner
  approval text never authorize merge. Agents must not write the owner's reply
  or move protected work to Merging for him. Shared Matthew identity means an
  author-ID check cannot independently prove human origin; this is a cooperative
  instruction boundary, not a server-enforced human approval identity.
- On Merging, re-read the explicit request and owner reply before doing only the
  approved handoff. Preserve manual ownership, accepted project and Icebox scope.
- Immediately before any merge re-read PR/base/current head, effective rules,
  latest-head required CI, local/ticket validation, review feedback, risk judgment
  and owner request/reply where required. Missing/failed/canceled checks, expected
  work skipped, draft/conflict, unresolved feedback or changed scope block merge.
  A deliberately skipped conditional browser/DB job is acceptable only when its
  successful path detector proves that work unnecessary. Bind the normal GitHub
  PR merge to the exact head with --match-head-commit and use squash.
- Any new head invalidates old approval: post a fresh request and obtain renewed
  approval for owner-required work. Meaningful base-context changes also require
  reassessment and fresh required approval. Rebase/update and recheck when strict
  protections require it. Never reuse an old green run for a changed head.
- Merge only admitted issue PRs into develop. No admin/ruleset bypass, native
  auto-merge setting change, access/security-setting edit, main/release merge,
  deployment or remote/shared DB mutation is permitted by this policy. If normal
  merge is blocked, record the exact blocker and pause instead of bypassing it.
- Verify GitHub merged state/base/merge SHA before recording develop delivery and
  handing off in In QA, matching Linear's develop-merge rule. Do not mark Done on
  develop merge. Main's existing rule moves Done on main inclusion; production
  deployment/effectiveness is separate, and agents have no main/release authority.
Do not modify Icebox or terminal tickets. Never select a paid API fallback.
