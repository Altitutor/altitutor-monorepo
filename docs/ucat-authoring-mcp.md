# UCAT MCP services

The tutor-web deployment exposes two remote Streamable HTTP MCP profiles backed
by the same implementation:

```text
Safe authoring:          https://<tutor-web-origin>/api/mcp
Production maintenance: https://<tutor-web-origin>/api/mcp-production
```

Development endpoints:

```text
https://tutor.development.altitutor.com/api/mcp
https://tutor.development.altitutor.com/api/mcp-production
```

Use safe authoring for ordinary draft creation and review preparation. Connect
production maintenance only to agents deliberately tasked with maintaining live
content. Splitting the catalogues reduces tool-selection noise and accidental
live edits; it is not a separate OAuth role or database security boundary.

## Authorization and lifecycle boundary

- Authentication is Supabase OAuth 2.1 with the acting tutor's user token.
- The token must contain a Supabase OAuth `client_id`, have the
  `authenticated` audience, and be issued by this deployment's configured
  Supabase project.
- The user must pass the existing `is_ucat_tutor()` check.
- All reads use tutor views and all writes use tutor RPCs, preserving
  `auth.uid()` and RLS behavior.
- Safe authoring may create drafts, edit drafts or in-review content, and move a
  draft to in review. It cannot edit published content.
- Safe authoring may soft-delete draft or in-review lessons, stems, sets, and
  mocks after active dependencies are removed, and may restore them as drafts.
- Production maintenance may apply exact-revision, recoverable edits to
  published content. It cannot publish, unpublish, delete, restore, or otherwise
  change lifecycle state.
- Nested blocks, questions, answer options, stem memberships, and set
  memberships may be explicitly added, updated, moved, or removed.
- Deleted top-level content appears in search only with `includeDeleted: true`.

Lifecycle and audience are separate. New MCP-authored content defaults to
`accessScope: "public"`, but a public draft or in-review item is still not live
for students. Publication remains a manual tutor action.

Every aggregate read returns an opaque `revision`. Update and submit tools
require it. The database locks the aggregate and rejects a stale revision before
performing the mutation.

## Safe-authoring tools

Read tools:

- `search_ucat_content`
- `get_ucat_content`
- `get_ucat_reference_data`
- `get_question_generation_runs`
- `get_question_ai_assessment`
- `get_ucat_file`
- `render_ucat_visual`

Write tools:

- `create_learning_module`, `update_learning_module`
- `create_question_stem`, `update_question_stem`
- `create_question_set`, `update_question_set`
- `create_mock`, `update_mock`
- `submit_ucat_content_for_review`
- `delete_ucat_content`, `restore_ucat_content`
- `start_question_generation`
- `request_question_ai_assessment`
- `generate_ucat_image`, `revise_ucat_image`

Create tools accept a complete initial aggregate. Update tools accept explicit
typed operations. Omitting a nested item never deletes it.

Every create, question-generation, image-generation, and image-revision call
requires an `idempotencyKey`. Generate one stable key for the logical operation
and reuse it unchanged after timeouts. Reusing a key with different inputs is
rejected. Tool results are returned as MCP `structuredContent` as well as a
JSON text fallback for older clients.

Rich-text fields accept plain text, explicit Markdown, or native
TipTap/ProseMirror JSON. See [UCAT MCP rich text](./ucat-mcp-rich-text.md) for
the supported Markdown dialect and image-node contract.

The direct question-stem tool records `codex_mcp` AI provenance and creates a
draft. The durable generator tool uses the existing background generator,
including its prompts, model profiles, source sampling, gates, budget, visuals,
run tracking, and automatic assessment flow.

Generated and revised images are stored through the existing `ucat-images`
pathway. Image tools return native MCP image content for immediate model
inspection alongside a preview URL, file ID, and ready-to-insert ProseMirror
`imageNode`; they do not attach the image automatically. Deterministic visual
rendering likewise returns a raster MCP preview. Stored-image reads return a
bounded model-facing derivative when the original is too large or
high-resolution. Base64 image data is carried only in MCP `content`, never in
`structuredContent` or durable idempotency records. Importing files produced
by Codex's client-local image generator is intentionally deferred in v1 because
MCP does not provide a portable client-local binary upload mechanism.

## Production-maintenance tools

Shared inspection and media tools:

- `search_ucat_content`, `get_ucat_content`, `get_ucat_reference_data`
- `get_question_ai_assessment`, `request_question_ai_assessment`
- `decide_question_ai_assessment_finding`
- `generate_ucat_image`, `revise_ucat_image`, `render_ucat_visual`
- `get_ucat_file`

Published change tools:

- `update_published_question_stem`, `update_published_question_set`
- `update_published_mock`, `update_published_learning_module`
- the corresponding four `propose_published_*_change` tools
- `get_ucat_content_changes`
- `apply_ucat_content_changes`
- `reject_ucat_content_change`, `restore_ucat_content_change`
- `accept_question_ai_assessment_suggestion`

Audit-run tools:

- `create_ucat_audit_run`, `add_ucat_audit_run_targets`
- `start_ucat_audit_run`, `get_ucat_audit_run`
- `claim_ucat_audit_run_targets`, `finish_ucat_audit_run_target`
- `complete_ucat_audit_run`, `cancel_ucat_audit_run`

A direct published-update tool is the low-friction path for a deliberate,
interactive edit. A proposal is useful when a staged or separately reviewable
change is preferable. Proposals do not inherently require human review: the
same authorised agent or another authorised agent may inspect and apply them.
`apply_ucat_content_changes` accepts 1–50 IDs, replacing the redundant
single-change tool without adding a workflow step.

An audit run in `proposal_only` mode cannot apply its changes. An audit run in
`apply_valid_changes` mode may apply only while active and only to targets in
its frozen manifest. This authority is enforced again when a pending proposal
is applied, so deferring an audit change cannot bypass the run policy.

## Supabase configuration

Development deployment:

1. `supabase/scripts/deploy-config.sh` enables the Supabase OAuth 2.1 server and
   Dynamic Client Registration for the development environment through CI/CD.
2. The development Auth Site URL is the tutor-web development origin and the
   OAuth authorization path is `/oauth/consent`.
3. Tutor-web implements that consent screen, verifies `is_ucat_tutor()`, and
   requires an explicit allow/deny decision before returning to Codex.
4. Deploy the database migration through CI/CD. Do not apply it manually to a
   remote database.
5. Confirm this endpoint returns the Supabase Auth issuer:

   ```text
   https://<tutor-web-origin>/.well-known/oauth-protected-resource
   ```

No service-role credential is accepted from Codex. Existing server-side service
credentials remain limited to established background generation, file storage,
and signed-URL operations after tutor authorization.

## Connect Codex

Using the CLI:

```bash
codex mcp add altitutor-ucat --url https://<tutor-web-origin>/api/mcp
codex mcp login altitutor-ucat
codex mcp add altitutor-ucat-production --url https://<tutor-web-origin>/api/mcp-production
codex mcp login altitutor-ucat-production
```

Or add the following to a trusted project's `.codex/config.toml` or the shared
Codex configuration:

```toml
[mcp_servers.altitutor_ucat]
url = "https://<tutor-web-origin>/api/mcp"
auth = "oauth"
tool_timeout_sec = 300
default_tools_approval_mode = "approve"

[mcp_servers.altitutor_ucat_production]
url = "https://<tutor-web-origin>/api/mcp-production"
auth = "oauth"
tool_timeout_sec = 300
default_tools_approval_mode = "approve"
```

`approve` matches the product decision that eligible draft/in-review mutations
and deliberate production-maintenance mutations do not need a second Codex
confirmation. The server still enforces lifecycle, revision, validation,
authorization, recovery, and audit boundaries. A client or workspace may use a
stricter approval mode for the production profile without changing the server.

Codex desktop, CLI, and the IDE extension share MCP configuration. In desktop
or the IDE, the same server can be added as a Streamable HTTP server and
authenticated from the MCP settings screen.

## Audit trail

Each successful mutation appends one compact `activity_events` row containing:

- acting tutor;
- Supabase OAuth client ID;
- MCP tool;
- aggregate type and ID;
- before/after authoring revisions;
- operation kinds;
- timestamp.

Prompts, hidden reasoning, duplicated aggregate content, and image bytes are not
stored in the MCP audit event.
