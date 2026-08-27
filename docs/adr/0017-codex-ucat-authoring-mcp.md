# Codex UCAT authoring MCP

Codex accesses UCAT authoring through a remotely hosted Streamable HTTP MCP
server authenticated by Supabase OAuth, rather than a local stdio server or a
service-role credential. Supabase OAuth dynamic client registration lets
supported Codex clients present the normal consent screen without brittle
per-client callback configuration. OAuth tokens preserve the acting tutor’s
`auth.uid()` identity and existing role façade. Passing `is_ucat_tutor()` is
sufficient; there is no additional staff allowlist. Database changes ship only
through CI/CD.

One MCP endpoint is hosted inside tutor-web as an isolated bearer-authenticated
adapter over shared UCAT authoring services. It exposes one catalogue across
all authoring lifecycles and is an additional client alongside tutor-web’s
embedded authoring agent, not its replacement. Lifecycle-specific endpoint
profiles are rejected because they duplicate shared tools without creating a
separate authorization boundary; the former production-maintenance endpoint is
removed rather than retained as a compatibility alias.

MCP may create drafts, edit draft or in-review content, submit drafts for
review, soft-delete eligible draft or in-review content, restore deleted
content as a draft, and apply explicitly authorised changes to published
content. It must reject publishing and soft-deleting published content; MCP
does not expose hard deletion. Editing in-review content preserves `in_review`,
and editing published content preserves `published`.

Aggregate-specific change tools apply edits directly to draft or in-review
content but stage a durable pending content change when the target is
published. One clearly destructive apply tool accepts only pending change IDs,
never raw content operations, and is the sole MCP path that changes live
content. During an explicitly requested interactive edit, the same agent may
stage and apply the change without a second human confirmation. Client approval
is an additional consent layer rather than the server's safety boundary. Tutor
identity, exact-revision checks, aggregate scope, validation, atomicity,
lifecycle preservation, and durable audit records are enforced even when a
trusted client is configured not to prompt.

Nested composition edits may add, reorder, update, or remove lesson blocks,
questions, answer options, stems within sets, and sets within mocks. Omission
never deletes nested content. Mutation batches are validated and committed
atomically against an opaque authoring revision. Learning-module block IDs are
stable across edits and moves. Published edits are scoped to one aggregate per
atomic mutation, but are not otherwise constrained to a "small correction": a
single question-stem mutation may coherently change the stem, multiple
questions, options, answer keys, explanations, metadata, and visuals. Bulk
changes across aggregates use independently revision-checked tool calls.
Published set and mock changes may likewise add, remove, or reorder stems
within a set and sets within a mock. Existing student attempts continue to use
their immutable content snapshots.
Published lesson changes may add, remove, edit, or reorder any supported block,
including rich text, tables, images, embedded questions, and skill trainers.
The complete lesson remains one revision-checked, recoverable aggregate.
Published learning-folder and navigation changes may rename, reorder, or
reparent folders and lessons through the same explicit published-change path.
Tree mutations must prevent cycles and invalid dependencies and remain
recoverable. A live folder may not be deleted while it contains content.

Lifecycle and audience scope are independent. New content defaults to
`access_scope = public`; draft and in-review content remains unavailable to
students until a tutor publishes it. MCP can explicitly choose private scope,
but does not infer that authoring work should be private.

Read access covers learning modules, question-stem bundles, sets, and mocks in
every lifecycle state and access scope, plus the authoring reference data,
files, generation runs, and assessments needed to work on them. Student,
attempt, class, billing, and other operational data remain outside the MCP
boundary.

Create and external-generation tools require durable idempotency keys so
timeout retries cannot duplicate records, generation runs, or images. Tool
responses expose structured MCP output with a JSON text fallback. Rich text
accepts plain strings, the documented Markdown dialect, or native
TipTap/ProseMirror JSON.

Question authoring supports both the existing durable AI generation pipeline
and direct structured generation by Codex. Pipeline requests retain their
prompts, gates, budgets, visuals, run tracking, and review behavior. Direct
Codex-created bundles record AI-generation provenance and begin as drafts.

V1 image authoring exposes the existing server-backed generation, revision, and
deterministic-rendering pathways. Results contain durable file IDs and
ready-to-insert ProseMirror image nodes. Importing bitmap files produced by a
client-local Codex image generator remains deferred because MCP has no portable
client-local binary upload mechanism.

Successful MCP mutations append compact activity events with the acting tutor,
OAuth client, tool, aggregate, revisions, operation kinds, and timestamp.
Prompts, hidden reasoning, duplicated content, and image bytes are not retained
in those audit events.

Every proposed published edit has a durable content-change record. It
identifies the target aggregate and base revision/fingerprint, records typed
operations, summary, rationale, source, status, author and timestamps, and
retains the base snapshot needed for review and recovery. Interactive edits may
stage and then apply that record within one agent task. Proposal-only audit jobs
and recoveries that cannot safely overwrite later work create pending records
which can later be applied, rejected, or marked stale. This is a proposal and
recovery log, not a branching content-version system.

Audit jobs default to `apply_valid_changes`. Creating a run with that default is
itself a destructive action and authorises live changes only for that run's
frozen targets while it remains active; no second authorization call or
per-change human confirmation is required. Callers may explicitly choose
`proposal_only`, in which case published changes remain pending for staff
review. Run authority is never global to the MCP connection or all AI-authored
published writes. Every application retains the same per-change revision
checks, validation, change records, and recovery data.

Once a run or schedule is authorised for live application, every change
the audit agent elects to make may be applied if it passes the ordinary tutor
authorization, exact-revision, aggregate, reference, and domain validation
checks. The server does not add hidden confidence thresholds or category-based
restrictions. Safety comes from frozen run scope, exact revisions, validation,
recoverable change records, and explicit proposal-only operation when human
review is wanted.

Codex is the initial audit reasoning and orchestration layer. MCP provides the
content reads, durable audit-run state, proposal and change records, and safe
published mutation tools; tutor-web does not duplicate Codex with another
general-purpose audit agent. Existing specialised server-side assessment
pipelines remain available for Codex to request when useful.

Audit methods, prompts, sequencing, and quality guidance live in versioned
agent skills rather than MCP tool descriptions or server-side named audit
profiles. MCP exposes stable generic primitives and does not require deployment
when an audit workflow changes. Audit-run provenance records the calling skill
or workflow identifier and version when supplied, plus a human-readable run
brief, without retaining hidden model reasoning.

Recurring scheduling is not an MCP-server responsibility. Agent-client
automation may invoke the same durable run tools on a schedule; Altitutor owns
run state and mutation safety, not another scheduling system.

Each audit run materialises its target aggregate IDs when it starts and tracks
every target as pending, in progress, completed, failed, or skipped. This
manifest makes whole-bank coverage measurable and permits interrupted Codex
work to resume. Content created after the run starts belongs to a later run
rather than expanding the active run indefinitely.

A selecting or active run can be cancelled explicitly. Cancellation immediately
removes that run's unattended write authority; it does not delete its manifest,
outcomes, proposals, or already applied change records.

Runs may select targets through either explicit aggregate IDs or typed
server-side filters such as aggregate type, lifecycle status, section,
category, or learning folder. Both forms resolve to the same materialised
target manifest. Large arbitrary selections may be assembled in a `selecting`
state through idempotent batches before the run starts and freezes the
manifest; whole-bank selections should normally use filters rather than
enumerating every ID.

The run freezes target membership, not complete content snapshots. Codex reads
each target's latest revision when it begins that item. If the revision changes
before a proposal is applied, the stale write is rejected and the item is
re-audited against the newer revision rather than overwriting concurrent work.

The existing complete-content read tool accepts either one aggregate ID or an
ordered batch of IDs for one aggregate type. Single reads preserve the original
response shape; batch reads return independent ordered successes or errors so
one unavailable aggregate does not discard the rest. Audit claims may
optionally include complete current content and revisions in the same MCP call.
Claiming remains the atomic database step and content is read immediately
afterward through the shared tutor-authorized aggregate reader. Agents choose
batch size according to aggregate weight and their calling harness; failed
content reads remain visibly claimed and can be retried, failed, or requeued.

Restoring an applied published change is itself a recorded published change
which references the change it reverses. If the aggregate remains at the
revision produced by the original change, the stored base snapshot may be
restored atomically. If later edits exist, restoration must not overwrite them;
instead the system creates a pending recovery proposal against the current
revision for normal review and application.

MCP can complete automated question-assessment review decisions. Dismissing a
finding requires a reason and does not change content. Rejecting a suggestion
also leaves content unchanged. Accepting a suggestion means its fingerprint was
current and its patches were successfully converted into and actioned through
the durable content-change path; the decision is not recorded first. A valid
finding which has not had that exact suggestion applied uses the distinct
`acknowledged` decision.

One durable content change may resolve or acknowledge multiple assessment
findings, and each finding reference is retained on that change. Pending
changes are visible to every authenticated UCAT tutor through tutor-web's AI
Content Changes queue and the MCP read interface, so review is shared authoring
work rather than being trapped in the proposing tutor's session. Tutors may
inspect diffs, apply changes in a bounded batch, reject with a reason, or open
the target in its editor. Application retains an independent transaction,
validation result, revision check, and recovery record per target; a stale
proposal never overwrites newer work.
