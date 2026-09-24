# UCAT authoring MCP

Tutor-web exposes one remote Streamable HTTP MCP server:

```text
https://<tutor-web-origin>/api/mcp
```

Development:

```text
https://tutor.development.altitutor.com/api/mcp
```

The former `/api/mcp-production` profile has been removed. One catalogue now
covers draft, in-review, and published authoring so agents do not have to route
shared reads, media operations, assessments, or audits between connections.

## Authorization and lifecycle

- Authentication is Supabase OAuth 2.1 with the acting tutor's user token.
- The token must contain a Supabase OAuth `client_id`, use the `authenticated`
  audience, and come from this deployment's configured Supabase project.
- The user must pass `is_ucat_tutor()`.
- Reads use tutor views and writes use tutor RPCs, preserving `auth.uid()` and
  RLS behavior.
- MCP may create drafts, change draft or in-review content, submit drafts for
  review, and soft-delete or restore eligible non-published content.
- Submitting a mock for review also submits its remaining draft component sets;
  if any of those submissions fail, the mock stays in draft.
- MCP cannot publish, unpublish, hard-delete, or delete published content.
- Published changes preserve `published` and remain recoverable.
- Nested content is removed only through explicit typed operations; omission
  never deletes.

Lifecycle and audience remain separate. New content defaults to
`accessScope: "public"`, but it is not live for students until published by a
tutor.

Every aggregate read returns an opaque `revision`. Change, transition, delete,
and restore tools require that revision. The database locks the aggregate and
rejects stale writes before mutation.

## Content tools

Read tools:

- `search_ucat_content`
- `get_ucat_content`
- `get_ucat_reference_data`
- `get_ucat_mcp_capabilities`
- `list_ucat_blueprints`, `get_ucat_blueprint`
- `validate_question_set_composition`, `validate_mock_composition`

`search_ucat_content` and `get_ucat_content` support three projections:

- `catalogue`: compact identity and lifecycle metadata;
- `composition`: ordered membership, counts, response contracts, timing intent,
  blueprint references, publication blockers, and mock section slots;
- `full`: complete authoring content, including rich text and referenced files.

Search defaults to `catalogue`; direct reads default to `full`. Use
`composition` when assembling sets or mocks to avoid downloading authored prose
that is irrelevant to the composition decision.

Call `get_ucat_mcp_capabilities` before a long authoring run when deployment
drift is possible. It reports the overall contract version, mutation-schema
versions, and feature flags for blueprint reads, composition projections,
dry-run validation, blank mock creation, and explicit replacement operations.

Blueprints are immutable database records. Set tools require both `setFormat`
(`full_section` or `partial_section`) and `referenceBlueprintId`; mock tools
require `blueprintId`. The blueprint read tools return the UCAT section UUID for
each official section so callers do not need to infer IDs from labels or test
years. `get_ucat_reference_data` also includes blueprints for clients that load
all reference data in one request.

The validation tools are read-only dry runs. Full sets and mocks receive the
same official totals/timing checks and advisory Altitutor composition checks as
the authoring domain. Partial sets are exempt from full-section totals but still
check missing stems, duplicate membership, and section purity.

Create and change tools:

- `create_learning_module`, `change_learning_module`
- `create_question_stem`, `change_question_stem`
- `create_question_set`, `change_question_set`
- `create_mock`, `change_mock`
- `submit_ucat_content_for_review`
- `delete_ucat_content`, `restore_ucat_content`

The four change tools are lifecycle-aware:

- draft or in-review target: operations apply immediately and return
  `effect: "applied"` with the updated aggregate;
- published target or live learning folder: operations create a pending UCAT
  content change and return `effect: "staged"` with a `changeId`.

Creating a mock creates only the blank mock record. It does not create template
sets. Existing sets can then be assigned, or new sets created, one blueprint
section at a time. For complete membership changes, use `replace_stems` on a
set and `replace_section_sets` on a mock. For a single mock slot, use
`set_section_set`. These replacement operations are intentionally explicit;
omitting membership from another operation never removes it.

The create/change set and mock tools register their MCP input contracts from the
same Zod schemas used for runtime parsing and TypeScript inference. Contract
tests convert those schemas to MCP JSON Schema and assert the required blueprint
and format fields, preventing the exposed tool schema from drifting from the
implementation again.

Published content changes use:

- `get_ucat_content_changes`
- `apply_ucat_content_changes`
- `reject_ucat_content_change`
- `restore_ucat_content_change`

`apply_ucat_content_changes` is the only general MCP tool that changes live
content. It accepts 1–50 durable change IDs and never accepts raw content
operations. Each target is independently revision-checked and validated, and
each applied change retains its base snapshot and recovery link.

During an explicitly requested interactive edit, the same agent may call a
change tool and immediately apply the returned `changeId`. A separate human
confirmation is not required.

Pending changes are also visible to tutors at `/ucat/content-changes`, where
staff can inspect diffs, apply changes in bounded batches, reject with a reason,
or open the target editor. Staff review can apply an explicitly proposal-only
audit change without granting that authority back to MCP.

## Audits

Audit tools:

- `create_ucat_audit_run`, `add_ucat_audit_run_targets`
- `start_ucat_audit_run`, `list_ucat_audit_runs`, `get_ucat_audit_run`
- `claim_ucat_audit_run_targets`, `finish_ucat_audit_run_target`
- `complete_ucat_audit_run`, `cancel_ucat_audit_run`

New runs default to `publishedWriteMode: "apply_valid_changes"`. Creating such
a run is destructive and authorises live changes only while the run is active
and only for members of its frozen manifest. No per-change confirmation is
required. Choose `proposal_only` explicitly when published changes should wait
in the staff review queue.

Applying a staged audit change rechecks the run mode, active status, and frozen
target membership. Cancelling a run immediately removes its unattended write
authority.

## Generation, assessment, and media

- `start_question_generation`, `get_question_generation_runs`
- `get_question_ai_assessment`, `request_question_ai_assessment`
- `decide_question_ai_assessment_finding`
- `change_question_ai_assessment_suggestion`
- `generate_ucat_image`, `revise_ucat_image`
- `render_ucat_visual`, `get_ucat_file`

An AI-assessment suggestion applies immediately to editable content and stages
a pending change for published content. Applying that change records the exact
suggestion as accepted.

Create, question-generation, image-generation, and image-revision calls require
a stable `idempotencyKey`. Reusing a key with different input is rejected.

Rich-text fields accept plain text, the documented Markdown dialect, or native
TipTap/ProseMirror JSON. See [UCAT MCP rich text](./ucat-mcp-rich-text.md).

Generated and revised images use the existing `ucat-images` pathway and return
native MCP image content, a preview URL, durable file ID, alt text, and a
ready-to-insert ProseMirror `imageNode`. They are not attached until a change
operation inserts the node. Base64 bytes appear only in MCP `content`, never in
structured output or durable idempotency records.

## Supabase configuration

Development deployment:

1. `supabase/scripts/deploy-config.sh` enables Supabase OAuth 2.1 and Dynamic
   Client Registration through CI/CD.
2. The Auth Site URL is the tutor-web origin and the authorization path is
   `/oauth/consent`.
3. Tutor-web verifies `is_ucat_tutor()` and requires an allow/deny decision.
4. Database migrations deploy through CI/CD; do not apply them manually to a
   remote database.
5. `/.well-known/oauth-protected-resource` must return the Supabase Auth issuer.

No service-role credential is accepted from Codex.

## Connect Codex

Remove any existing `altitutor-ucat-production` connection, then configure only:

```bash
codex mcp add altitutor-ucat --url https://<tutor-web-origin>/api/mcp
codex mcp login altitutor-ucat
```

Or:

```toml
[mcp_servers.altitutor_ucat]
url = "https://<tutor-web-origin>/api/mcp"
auth = "oauth"
tool_timeout_sec = 300
default_tools_approval_mode = "approve"
```

The server enforces authorization, lifecycle, revision, validation, recovery,
and audit constraints even when the client does not add another confirmation.

## Audit trail

Each successful mutation records the acting tutor, OAuth client, MCP tool,
aggregate type and ID, before/after authoring revisions, operation kinds, and
timestamp. Prompts, hidden reasoning, duplicated aggregate content, and image
bytes are not stored in the activity event.
