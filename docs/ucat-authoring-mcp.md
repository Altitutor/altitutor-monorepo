# UCAT authoring MCP

The tutor-web deployment exposes a remote Streamable HTTP MCP server at:

```text
https://<tutor-web-origin>/api/mcp
```

It lets Codex read UCAT authoring content and create or edit content within the
draft/review boundary. It does not replace the embedded tutor-web authoring
agent.

## Authorization and lifecycle boundary

- Authentication is Supabase OAuth 2.1 with the acting tutor's user token.
- The token must contain a Supabase OAuth `client_id`, have the
  `authenticated` audience, and be issued by this deployment's configured
  Supabase project.
- The user must pass the existing `is_ucat_tutor()` check.
- All reads use tutor views and all writes use tutor RPCs, preserving
  `auth.uid()` and RLS behavior.
- MCP may create drafts, edit drafts or in-review content, and explicitly move
  a draft to in review.
- MCP cannot publish, edit published content, or delete/restore a top-level
  lesson, stem, set, or mock.
- Nested blocks, questions, answer options, stem memberships, and set
  memberships may be explicitly added, updated, moved, or removed.
- Deleted top-level content is readable but read-only and appears in search only
  with `includeDeleted: true`.

Every aggregate read returns an opaque `revision`. Update and submit tools
require it. The database locks the aggregate and rejects a stale revision before
performing the mutation.

## Tools

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
- `start_question_generation`
- `request_question_ai_assessment`
- `generate_ucat_image`, `revise_ucat_image`

Create tools accept a complete initial aggregate. Update tools accept explicit
typed operations. Omitting a nested item never deletes it.

The direct question-stem tool records `codex_mcp` AI provenance and creates a
draft. The durable generator tool uses the existing background generator,
including its prompts, model profiles, source sampling, gates, budget, visuals,
run tracking, and automatic assessment flow.

Generated images are stored through the existing `ucat-images` pathway. The
tool returns a preview URL, file ID, and a ready-to-insert ProseMirror image
node; it does not attach the image automatically. Importing files produced by
Codex's client-local image generator is intentionally deferred in v1 because
MCP does not provide a portable client-local binary upload mechanism.

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
```

Or add the following to a trusted project's `.codex/config.toml` or the shared
Codex configuration:

```toml
[mcp_servers.altitutor_ucat]
url = "https://<tutor-web-origin>/api/mcp"
auth = "oauth"
tool_timeout_sec = 300
default_tools_approval_mode = "approve"
```

`approve` matches the product decision that eligible draft/in-review mutations
do not need a second Codex confirmation. The server still enforces lifecycle,
revision, validation, authorization, and audit boundaries.

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
