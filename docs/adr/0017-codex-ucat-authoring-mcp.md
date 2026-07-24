# Codex UCAT authoring MCP

Codex accesses UCAT authoring through a remotely hosted Streamable HTTP MCP
server authenticated by Supabase OAuth, rather than a local stdio server or a
service-role credential. Supabase OAuth dynamic client registration lets
supported Codex clients present the normal consent screen without brittle
per-client callback configuration. OAuth tokens preserve the acting tutor’s
`auth.uid()` identity and existing role façade. Passing `is_ucat_tutor()` is
sufficient; there is no additional staff allowlist. Database changes ship only
through CI/CD.

The MCP endpoint is hosted inside tutor-web as an isolated bearer-authenticated
adapter over shared UCAT authoring services. It is an additional client
alongside tutor-web’s embedded authoring agent, not its replacement.

MCP may create drafts, edit draft or in-review content, submit drafts for
review, soft-delete eligible draft or in-review content, and restore deleted
content as a draft. It must reject publishing, editing published content,
deleting published content, and mutating live learning folders. Eligible
mutations execute without a second confirmation because lifecycle,
authorization, validation, revision, dependency, and audit checks remain the
safety boundary. Editing in-review content preserves `in_review`.

Nested composition edits may add, reorder, update, or remove lesson blocks,
questions, answer options, stems within sets, and sets within mocks. Omission
never deletes nested content. Mutation batches are validated and committed
atomically against an opaque authoring revision. Learning-module block IDs are
stable across edits and moves.

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
