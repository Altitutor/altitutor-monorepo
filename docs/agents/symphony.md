# Official Symphony

[DEV-186](https://linear.app/altitutor/issue/DEV-186/adopt-official-symphony-for-autonomous-linear-ticket-implementation) owns this setup. DEV-172 and its custom coordinator are retired. The replacement runs the unchanged [official OpenAI runtime](https://github.com/openai/symphony), not a rewrite of its specification.

## Installed version

Stable release `v0.0.3`, source `1c0fb6c8e8ef9031a2c861e62af5f9e66cee39cb`, Mac ARM64 executable SHA-256 `b85d78b25cd5cacff92424416f6a3af7cafee5d675f56b5cd26d22d601c2026d`. The official prebuilt executable embeds Elixir/Erlang. No upstream source patches, adapters, custom daemon, reviewer account or GitHub App are installed. See `symphony-version.json` and the [upstream instructions](https://github.com/openai/symphony/blob/v0.0.3/elixir/README.md).

Executable: `~/Library/Application Support/AltitutorSymphony/symphony-v0.0.3-macos_arm64`.

`WORKFLOW.md` contains only documented configuration and repository instructions. Matthew approved ordinary foreground pickup on 2026-10-12. `active_states` now selects Backlog/Todo/In Progress/Merging in the accepted Altitutor Development project, with an environment reference for authentication. Native authentication was verified during DEV-187; each new process still needs its temporary Linear key. This is not a background or auto-start service. The upstream Linear skill is copied unchanged into `.codex/skills/linear/`.

## Before the first real run

1. The dedicated [Altitutor Development](https://linear.app/altitutor/project/altitutor-development-0642b16f8767) project was created in Dev for normal upstream configuration: UUID `621dba0c-e861-4778-be33-0c28e55f2768`. Only the approved documentation smoke DEV-187 was enrolled; it is now Done. No runnable issue was present at ordinary-start preparation. A read-only connector lookup by short slug `0642b16f8767` resolves this exact project, and the workflow now uses that value rather than the title-prefixed URL segment. The connector does not expose the native `slugId` field; the approved native read-only credential check subsequently returned `slugId: 0642b16f8767` with the exact Altitutor workspace and Dev team. Only the intended work should enter this project. Team/workspace URLs are not project slugs.
2. Provide a supported Linear API token through `LINEAR_API_KEY` using approved scope and local secret handling. Never place it in this file, Git, tickets, shell history or logs. The old fixed-function Keychain broker has no compatible token-export interface and is not used. Do not extract its credential. A token's permissions bound raw `linear_graphql` tools; project_slug only scopes scheduler reads.
3. Select routing explicitly before enabling states. `LINEAR_ASSIGNEE` accepts a specific Linear user ID or `me`. It does **not** mean unassigned. Leaving it unset includes all owners, including Matthew. Vanilla has no automatic exclude-Matthew or external manual-claim filter. An explicit non-Matthew assignee selection excludes unassigned work too. Alternatively, an operator-managed project queue must keep Matthew-owned/manual work out; that changes how queue eligibility is managed and needs deliberate agreement. Do not enable the unrestricted queue under the old exclusions.
4. Matthew has approved ordinary foreground pickup with `Todo` and `In Progress` active, and approved adding `Backlog` on 2026-10-13. Admit only selected issues to the accepted project; idle polling is fine when none are runnable. The former five-minute/one-turn smoke cap does not limit ordinary runs. Before starting, ensure only that approved ticket is eligible under the project/routing, or temporarily use the documented `required_labels` setting with a unique label on that ticket only. Concurrency one does not limit the number of tickets or retries. Stop with Ctrl-C as soon as the agreed evidence is recorded, on any unexpected dispatch, or at the approved time/turn limit. Remove a temporary smoke label filter only after separate general-dispatch approval. Icebox, Awaiting Input, In Review, In QA, Ready for Release, Done, Canceled and Duplicate are outside this initial queue. Expired DEV-172 grants and model counters do not apply. The separate smoke workflow remains disabled; ordinary foreground activation is now explicitly authorized.

The existing ChatGPT subscription login is reused; `forced_login_method="chatgpt"`
prevents selecting API-key login. Matthew approved the standard standalone CLI
update and model switch on 2026-10-15. The existing npm installation was updated
through `codex update` from 0.146.0 to stable 0.162.1. Its `model/list` exposes
`gpt-6.1-sol` with high reasoning, and a single ephemeral, no-tool, read-only
smoke returned the expected literal response without repository mutation. The
normal command now explicitly pins `gpt-6.1-sol` and `model_reasoning_effort="high"`;
it no longer overrides the user's current model with the original 5.6 setup pin.
The unchanged upstream runtime reads this command for each new worker session
and reloads the workflow, so no foreground-runtime restart or new Linear-key
handoff was required. Existing workers and subscription credentials are preserved.
Model availability/smoke evidence does not establish future ticket correctness.
Do not buy API access, copy credentials or add a wrapper/service for model selection.

From this repository, after those actions:

```sh
export SYMPHONY_INSTALL_DIR="$HOME/Library/Application Support/AltitutorSymphony/runtime/v0.0.3"
"$HOME/Library/Application Support/AltitutorSymphony/symphony-v0.0.3-macos_arm64" \
  --i-understand-that-this-will-be-running-without-the-usual-guardrails \
  --logs-root "$HOME/Library/Logs/AltitutorSymphony" \
  ./WORKFLOW.md
```

The pinned v0.0.3 workflow store checks for file changes every second and keeps
the last valid configuration if reload fails. Active states are read from that
configuration on dispatch; changing them does not require a restart or key reentry.
The stock status API does not expose the effective active-state list.

Run in the foreground; stop with Ctrl-C. No launchd installation or automatic start is part of this setup. The acknowledgement is required by the official CLI even when the documented sandbox/approval settings are configured. An optional `--port` enables the upstream dashboard; host is set to `127.0.0.1`. No public exposure is configured.

## Vanilla behavior and limits

Symphony polls a project, prioritizes eligible issues, creates per-issue workspaces, runs Codex app-server and exposes progress/token usage. Configuration limits concurrency to three and consecutive turns per invocation to twenty. This is **not** the old 32-turn-per-issue/96-starts-per-day/900-second total-turn budget: upstream retries and later invocations can exceed twenty overall, and turn_timeout_ms is a silence timeout. No custom budget is promised.

The workflow uses a single Linear workpad and existing team states. Questions remain on the issue; Awaiting Input keeps work outside dispatch across restart. A human can answer there and return the ticket to Backlog/Todo/In Progress. There is no old answer-ACK protocol, durable external session lease or automatic mobile-preview pipeline. Read current comments and ownership before resuming. The packaged v0.0.3 fake-input test observed `turn_input_required` entering the retry queue while the issue remained active, despite the upstream README describing a blocked map. Do not rely on a native question alone to pause durably: keep Awaiting Input outside the active states. This observation is documented, not patched.

The stock runtime does not enforce a four-session review pipeline. Repository skills and ticket requirements still apply; no review-policy redesign is made here. PRs requiring owner merge approval hand off in In Review; the bounded merge policy below is enabled after verified prerequisites. Develop delivery hands off In QA and the existing main rule moves Done. Billing, auth/security, destructive changes and other protected actions retain human approvals. No production deployment or shared database reset is authorized.

The custom Python preview service/catalog has been retired recoverably at Matthew's request. The existing private Tailscale Serve mapping is unchanged; normal app servers provide prototypes. Independent broker, database/test helpers and telemetry safeguards remain. Mobile links and actual phone/iPad acceptance must be recorded honestly on the issue.

## Issue assessment and prototype feedback

Matthew explicitly requests `/grill-with-docs` for every issue's initial
assessment. Read its actual `.agents/skills/grill-with-docs/SKILL.md` wrapper,
which delegates to `grilling` and `domain-modeling`. Its manual-only metadata is
preserved; the standing workflow request supplies explicit invocation. First
investigate the ticket/comments, existing brief, glossary/ADRs and code/tests.
Clearly specified reproducible bugs and fully described improvements need no
product interview. Routine implementation choices remain autonomous.

Keep the decision/prototype brief in the existing Linear Codex Workpad. When
product/functionality choices remain, follow the skill's design tree and rounds:
ask the ready frontier with context, options and recommendations; defer questions
that depend on unresolved choices. Move to Awaiting Input and stop dependent
implementation. Matthew's answers plus return to runnable confirm the agreed
choices. Read the brief and answers before resuming; do not repeat answered
questions or treat a state change as an answer. A comment alone does not resume
work. The stock unattended example is not the selected repository prompt.

Record resolved domain terms in the glossary only when the model changes;
CONTEXT.md is not a spec or scratchpad. Create ADRs only when all three skill
criteria hold: hard to reverse, surprising without context and a real trade-off.
Do not manufacture documents or approvals for a straightforward fix.

For bug tickets, explicitly apply `.agents/skills/diagnosing-bugs/SKILL.md` before
implementation. Record an already-run reproduction matching the original incident
through the relevant code path, its command/results and unresolved assumptions;
a failing test of an assumed solution is insufficient. After substantial
unsuccessful investigation, record attempts/results/uncertainty and the exact
missing question. The same /diagnosing-bugs agent should seek useful evidence by
proposing and, within existing authority, preparing minimal targeted diagnostics
that distinguish explicit predictions. This evidence-gathering exception does
not satisfy the red-capable reproduction gate for a product fix. Define the
expected capture/trigger, minimal redacted fields, release correlation, tests and
removal criteria. Use synthetic/local validation for capture/redaction; do not
claim it proves production capture. No secrets/PII broad capture or token-bearing
URLs. If no safe useful probe exists, document the blocker; useful progress,
recurrence and eventual fixes cannot be guaranteed.

Diagnostic code follows normal /implement, tests, review, PR/status lifecycle and
required approval. No expansion of production logging activation, deployment or
merge authority; billing always needs explicit approval.
Diagnostic-only delivery must not resolve or advance the original bug via native
PR/commit/release automation. Use an explicit standalone "Related to DEV-n" for
that bug; "Refs" can still move pre-merge statuses. Exclude its bare ID from the
branch name, PR title and squash subject, and never use closing directives for it.
Inspect effective native linkage/rules and source/generated release links; read
back original status/ownership after linking and verify after develop merge and
main inclusion. Keep the original Triage/needs-evidence while tracking diagnostics
PR/deployment separately; generic In QA/Done delivery rules do not apply to it.
If safe relation behavior cannot be verified, use a separate diagnostic issue
under existing admission/approval rules, with workpad cross-references until safe
linking is known. A subissue requires verification that parent-completion rules
cannot close the original. Do not silently enroll work or edit native rules; a
completed diagnostic issue covers diagnostics, not bug resolution or verified
deployment.
Finish required candidate
work/review under its normal lifecycle before parking to await evidence. Awaiting
Input is only for specific actionable human questions/decisions/access requests
with a named next owner. Otherwise use existing Triage/needs-evidence, preserving
project/assignee/unrelated labels. Record explicit agent parking, original attempts
and ownership, incident/evidence baseline, exact missing question, diagnostic PR/
candidate and deployed release when known, expected next evidence and re-entry
criteria. Distinguish diagnostics pending deployment from deployed and awaiting
recurrence; merging does not prove deployment. Verify status/label; no speculative
fix/merge or resolved claim. No review-date requirement or new scheduler/service.

Existing intake may return only explicitly agent-parked Triage/needs-evidence
holds that are unassigned, nonheld and eligible under existing admission rules
to Backlog, removing only needs-evidence. A related occurrence from the
instrumented release, independently useful new evidence or materially worsened
impact can trigger one fresh /diagnosing-bugs investigation. Compare the parking
baseline and last attempt; dedupe bursts and old-release/no-new-evidence repeats.
If expected capture is absent, assess deployment/trigger/delivery failure instead
of claiming fixed or blindly repeating. Preserve canonical dedupe, project/all
assignments, human ownership/manual claims, explicit holds and Icebox. Shared
author identity alone is not agent provenance; assigned or unclear cases remain
parked for human action. Manual Todo promotion remains possible under existing
ownership/admission rules. Read latest evidence and instructions before resuming;
a comment alone does not return a state to runnable. No bulk moves. Intake prompt
changes require its supported native management surface in the original local
task; repository instructions do not update that automation.

Use `.agents/skills/prototype/SKILL.md` for UI that is unclear or lacks a clear
repository pattern. Well-defined drop-in patterns can skip it with a reference.
Clarify product choices needed to frame the question, then choose its UI or logic
branch. Prefer UI variants on the existing page, defaulting to three structural
alternatives; logic/state questions use the portable free-play/walkthrough HTML.
Use synthetic/in-memory data and stub writes. A prototype answers a question;
it is not production-ready code or permission to touch shared data.

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

### Implementation and review

After accepted product choices and any required prototype verdict, explicitly use
`.agents/skills/implement/SKILL.md`. It calls for `/tdd` where possible at
pre-agreed seams, regular focused tests/typechecks, the full suite once at the
end, `/code-review`, then a local commit. Read and reuse those skills rather than
recreating their pipeline here. Reuse already confirmed seams from the accepted
brief/test plan. For admitted Symphony work only, Matthew authorizes the agent
to select and record purely technical public test seams and rationale in the
workpad before writing tests; this satisfies /tdd's pre-agreed-seam confirmation
without a separate owner question. Keep /grill-with-docs, /diagnosing-bugs, /tdd,
/implement and applicable review skills in use, including incident-shaped
reproduction, red-before-green, evidence limits and both review axes. Product/
functionality decisions, security/access changes and all protected actions retain
their existing owner approval requirements; critical/auth and billing merges
remain protected. This scoped authorization does not change the global interactive
skill files or authorize speculative fixes, production logging activation or deployment.
Prototype throwaway code retains its own no-tests learning phase; production
implementation resumes the normal quality and protected-action requirements.

The implementation review already delegates work to subagents: `/implement` currently
requires `/code-review`, which specifies two parallel Standards/Spec reviewers;
one checks Standards and the other checks Spec. Call `/code-review` once for
that existing procedure; do not add duplicate review passes. A single optional
reviewer would change that requirement and is not authorized merely by asking
whether delegation is possible. No skill metadata or review requirements were rewritten, and no four-session
pipeline was added. The existing two-axis procedure remains the implementation
default. For bug tickets, supply the existing Spec reviewer with the original
incident, reproduction command/results and unresolved assumptions, alongside the
issue/spec and diff. Check these against actual implementation and lifecycle
behavior, not only an assumed solution or its tests; disclose missing evidence.
Retain concise actual findings/resolutions or blockers and the reviewed SHA in
the workpad, rather than only a pass/count claim. This adds no review layer.
A single optional reviewer would need an explicit override; asking
whether subagents can perform review does not provide that override. These
instructions do not enroll work or add review passes; actual execution remains within the approved issue/project scope.

The normal after_create hook checks all referenced skill/format files in the
fresh shallow checkout before copying the unchanged upstream Linear skill.
Neither this prompt integration nor project acceptance activates a queue, enrolls
DEV-8, restarts hosting, or authorizes another live smoke/model run.

## Recovery

The former coordinator was never merged into the active develop checkout. Its reviewed candidate and activation package are archived locally, with a verified Git bundle covering the old branch history. Installed obsolete coordinator entry points are moved to that recovery archive; independent broker/test dependencies remain in place; the remaining custom Python preview was subsequently archived. No old worker service was installed, and legacy maintenance remains paused. Rollback files are local evidence, not repository or Linear attachments.

## Bounded foreground smoke

[DEV-187](https://linear.app/altitutor/issue/DEV-187/symphony-foreground-smoke-documentation-only)
was the only project ticket. The first attempt stopped at the stock 60000ms
full-clone hook timeout after 68.7 seconds, before Codex started. The documented
shallow clone with `GIT_TERMINAL_PROMPT=0` subsequently completed in nine seconds.

The same human authorization covered the recoverable retry within cumulative
live runtime of 300 seconds; a fresh access grant was not required. The initial
re-entry window disappeared before verification, with no retry launched. Its
non-secret receipts do not establish the cause. The next user-operated hidden
entry verified the exact native destination and sole eligible issue on Return,
then immediately started the approved smoke without waiting for another message.

The retry ran from 07:06:32.924877 to 07:10:21.665107 UTC on 12 October 2026,
228.74 seconds; cumulative live runtime was 297.44 seconds. The temporary one-use
operator timer stopped the unchanged official executable at the reserved deadline.
One worker, one Codex session and one turn were observed. Candidate
`aae2c932126aaa747c66d88c3c5140725df3ae85` adds only
`docs/symphony-foreground-smoke.md`; `git diff --check HEAD^ HEAD` passed. The worker
updated the existing Linear workpad with that candidate and validation evidence.

The worker's final turn and In Review transition did not finish before cutoff.
After independently verifying the candidate, the operator moved DEV-187 to
In Review through the connector. Bootstrap, real subscription inference, local
commit and native tracker read/write are verified; clean autonomous completion
is still unverified. This does not activate a broader queue.

The exact runtime process/group are gone, the localhost status port is closed,
both workflows have empty active states, the key-clear receipt is present, and
the interactive Terminal remains open and idle. Upstream source/binary and the
copied Linear skill remain unchanged. No extra model turn, push, PR, merge,
deployment, application/database command or package installation was performed.

## Ordinary foreground start

The accepted project is the admission queue. Vanilla's unset assignee filter
includes all owners; keep Matthew-assigned/manual work out of its runnable pool.
The one-use private key-entry preflight checks the exact workspace/Dev project
and refuses an initial Matthew-assigned runnable issue. This is an operator
startup check, not a new continuously enforced lease/filter or source patch.
The workflow instructs each agent to check ownership before claiming work.

The user-operated hidden Terminal entry immediately checks the native connection
and starts the unchanged executable in the foreground with the normal WORKFLOW.
No private key value is returned or persisted, and no Keychain storage is set up.
The same API key can be reused; with temporary environment handling it is entered
once per fresh run, not once per issue/turn, and cleared when the foreground run
stops. Keep the Terminal open; Ctrl-C stops the ordinary run. No old smoke timer
or DEV-172 counters are reused. The separate stock localhost status endpoint is
only observational and is not exposed through the prototype Tailscale route.

## Approved issue PR publication — 2026-10-13

Matthew approved automatic issue-branch push and draft/create/update PR publication
for admitted Symphony issues, targeting `develop`. The live `WORKFLOW.md` carries
the lifecycle: draft during incomplete work or checks; remain In Progress while
CI is pending/failing; follow the latest PR head and fix within issue scope.
For local full/DB validation in a fresh clone, first run
`bash supabase/scripts/render-email-templates.sh` for its ignored auth assets.
Readiness requires completed implementation, required local/ticket validation,
latest-head CI, resolved Standards/Spec findings and accepted human/prototype
input. Only then mark ready and move to In Review. CI success alone is insufficient.
Genuine human input/access/approval blockers pause in Awaiting Input. Preserve
manual ownership, existing PRs and concurrent edits; setup scaffolding stays out
of issue commits. PR links, latest SHA and evidence belong in the Linear workpad.
This uses vanilla agent instructions, with no coordinator, daemon or watcher.

At publication-policy adoption, merge execution was not authorized. Matthew
subsequently approved the bounded develop policy below on 2026-10-14. GitHub
native auto-merge remains disabled. The pinned upstream Merging/land example
uses ordinary PR merges; no upstream source or custom coordinator is needed.

## Parallel coding and database guards — 2026-10-13

Matthew authorized three workers with repo-local database coordination. See
`docs/agents/local-database-tests.md`. Database gates and database-backed previews
share a host-wide lock through startup/reset/seed/tests/cleanup. Guarded commands
automatically prepare and verify a separate disposable stack; normal shared
databases are never reset. Ordinary Docker bindings are approved. DB jobs wait
their turn while coding/unit work remains parallel.
Fresh clones receive the reviewed guard patch through the documented after_create
hook; incompatible source drift stops bootstrap. Already-created worker clones
retain their original pinned guard; do not overwrite active workers to upgrade it.
The bootstrap guard is existing
setup scaffolding: retain it and exclude its changes from unrelated issue commits.
No guard/DB command modifies Symphony itself, enrolls issues or bypasses ownership
and Icebox rules. This is serialized DB validation, not three isolated live DBs.


## Approved develop merge policy — 2026-10-14

Matthew accepted the Linear flow and explicitly approved replacing the develop
update block with PR/seven-check/up-to-date gates and removing admin bypass.
His production wording answered that precise develop question; it does not
approve main/release merges or deployment. Merge execution is now ENABLED after verified prerequisites: PR200 merged into
develop at34db4ead75659e5f933cd447542d2881d258d1ca; ruleset16823541 requires PRs,
all seven Actions15368 checks and up-to-date branches, with no bypass actors;
Dev Merging is started state3f8ad3a9-58a0-45fb-8ae6-d0c7199cfb7f.

Before activation, land the separate CI prerequisite that removes only CI's
whole-workflow PR path filter. Preserve the existing job-level browser/database
selection. Required contexts must report for documentation-only PRs as well.
Then freshly verify ruleset16823541 targets only refs/heads/develop, enforcement
active, no bypass actors; retains creation/deletion/non_fast_forward; requires
PRs with zero formal reviews and all seven contexts from Actions app15368:
Lint, Type Check, Test, UCAT Contracts, Detect web system tests, Build, Web Browser
and Database. Require the branch up to date. Main and native auto-merge are unchanged.
Never enable missing required-check lockout before the CI prerequisite lands.
Landing that prerequisite under old rules needs its own exact bootstrap approval;
the settings approval does not authorize an admin merge bypass.

Merging was created through the existing Chrome session with Matthew's explicit
browser authorization, and verified through the Linear connector. No new account,
credential or browser permission was needed. Active states are now Backlog/Todo/
In Progress/Merging. Preserve existing worker checkouts/claims; update their setup
instructions only at an idle safe checkpoint. The stock workflow reloads normally
without restart or key reentry. Browser fallback remains restricted except for
this specifically authorized status-creation/audit operation.

Only narrow, unambiguous restorations of specified behavior with actual recorded
red/green evidence, complete validation/review and no product/UX question may
merge unattended. Judge impact. Functionality changes, owner-verifiable UX and
critical changes pause for owner approval; billing always does. Ready/green alone
never proves eligibility. Unclear risk needs owner input rather than invented proof.

The agent supplies PR URL/number, develop base, full head, impact and evidence in
one explicit Linear merge request. Matthew replies directly approve and moves
In Review -> Merging; he does not copy a SHA or JSON. Record request/reply IDs and
approved head. Product answers and Todo are implementation permission only. Any
new head needs a fresh request/reply for protected work; meaningful base changes
also require reassessment. Agents must never manufacture the owner reply or move
protected work to Merging on his behalf. Both connectors act as Matthew, so author
IDs alone cannot distinguish agent text from human text: approval is a cooperative
instruction boundary, with no extra account/service infrastructure.

Immediately recheck current PR/head/base, effective rules, local/ticket validation,
latest-head CI, both review axes/feedback, risk and required approval. Use ordinary
squash PR merge with --match-head-commit; never routine admin bypass. Verify merged
state/base/merge SHA before In QA, matching the existing develop-merge automation.
Main's existing rule moves Done; that means main inclusion, not verified production
deployment. Agents have no main/release/deployment or shared DB authority.
Native GitHub permits deliberately skipped conditional jobs; verify the successful
path detector makes that work unnecessary. Missing, failed/canceled or unexpectedly
skipped work blocks merging. Strict up-to-date gates can require a rebase/new CI
and renewed approval after concurrent develop changes.


## Dev status audit — 2026-10-14

The native Dev branch rules are develop merge -> In QA and main merge -> Done;
generic PR open/review/ready/merge rules are No action. No observed automation
uses Ready for Release, and repository executable workflow references do not use
it. The connector audit including archived issues returned198 issues: Done101,
Backlog71, Icebox12, Canceled6, In Review3, Triage3, In QA1, Duplicate1. Todo,
In Progress, Awaiting Input, Merging and Ready for Release are empty.

Ready for Release is the clearest redundant status under the agreed lifecycle:
zero affected issues; no issue migration is needed if it is removed. Retain it for
now while recommending removal and checking any external/private integration.
Keep the other states: triage, ordinary backlog/admission, intentionally excluded
Icebox, accepted Todo, coding, durable input pause, owner review, explicit merge
handoff, QA and native terminal outcomes have distinct jobs even when empty.
The Ready for Release and Done UI descriptions still use older release-verification
wording; that conflicts with the actual main -> Done rule. Recommend aligning
those descriptions with branch inclusion vs separate deployment evidence. No
existing status was deleted, renamed, reordered or bulk-migrated during the audit.


## Final implementation review handoff

Exploratory feedback answers unresolved product/design choices; final review shows
what was implemented. Keep inspected presentation evidence and real functional
tests distinct. Record exact candidate, representative synthetic cases, tested
interactions, limits, review steps and next responsible actor. Never claim a
physical device or visual interaction was checked when it was not.

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

The former Tailscale slot/deadline procedure is retired by Matthew's 2026-10-22
direction. Existing routes and manually owned services are unchanged; their
removal needs separate exact-action approval. Historical preview URLs are not
promised live. No new hosting or credential mechanism replaces the retired flow.
