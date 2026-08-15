---
name: audit-ucat-questions
description: Audit UCAT question stems through the Altitutor UCAT MCP and apply fixes.
disable-model-invocation: true
---

Audit UCAT question stems. Apply fixes through the Altitutor UCAT MCP. One *stem* is the unit of work (shared stimulus plus every question on it).

This folder is self-contained. Read sibling files when a step names them. Do not look up this skill’s rules in a host repo.

## 1. MCP

This skill needs the Altitutor UCAT MCP. Two profiles, same tutor token:

| Profile | Edit | Use when |
|---|---|---|
| **Authoring** (drafts) | `create_question_stem`, `update_question_stem` | `draft` or `in_review` |
| **Production** (published) | `update_published_question_stem`, audit-run tools | `published` |

Both profiles can `search_ucat_content`, `get_ucat_content`, `get_ucat_reference_data`, `get_ucat_file`, `render_ucat_visual`, `generate_ucat_image`, `revise_ucat_image`.

If neither profile is available, stop and say so.

Tool input shapes live on the tools. Cache these gotchas:

- Re-read immediately before every write. Pass the opaque `revision`. On `mcp_stale_revision`, re-read, reconcile, retry.
- Typed operations only. Omission never deletes nested content.
- Authoring refuses published stems. Production cannot publish, unpublish, or delete.
- Do not submit for review. Do not call `delete_ucat_content`. Do not call `request_question_ai_assessment`.

**Done when:** the needed profile is callable, or you have stopped.

## 2. Resolve the selector

Turn the user’s criteria into stem IDs. Typical criteria: one stem id, a question-set name or id, a lifecycle (`draft` / `in_review` / `published`), a section (VR / DM / QR / SJ). They may say anything else — interpret it.

Use `search_ucat_content` and `get_ucat_content`. For a set, read the set and take its stem membership. For a section filter, resolve `sectionId` from `get_ucat_reference_data`. Paginate search until the match is complete or you hit the pause below.

- One clear match → continue.
- Several plausible matches (two sets named similarly, an id that hits more than one type) → list them and ask.
- More than 25 stems → show the count and the section/status mix, then ask before writing.

Split the list by status. Draft/in-review stems use authoring. Published stems use production. A mixed selector is two runs, one report.

**Done when:** you have an ordered list of `{ stemId, status, section }`, or you have asked and are waiting.

## 3. Pick a branch

- **Inline** — one stem, or this runtime cannot dispatch subagents. You audit each stem yourself using [STEM.md](STEM.md).
- **Fan-out** — more than one stem *and* subagents exist. One subagent per stem. Several stems in parallel. Never two workers on the same stem.

Default is inline.

**Done when:** the branch is chosen.

## 4. Published audit run

For the published list only:

1. `create_ucat_audit_run` with `publishedWriteMode: "apply_valid_changes"`, `workflowId: "audit-ucat-questions"`, `workflowVersion: "1"`, selector `explicit` targets `{ contentType: "stem", id }` (batches of ≤200 via `add_ucat_audit_run_targets` if needed). `idempotencyKey` stable for this run.
2. `start_ucat_audit_run` (freezes the manifest).
3. Each worker `claim_ucat_audit_run_targets` with `limit: 1`, `includeContent: true`, then audits, then `finish_ucat_audit_run_target` (`completed` / `failed` / `skipped`). Put the outcome object in `outcome`. Skipped = `suggest_delete` or `suggest_split`.
4. After every published target is terminal, `complete_ucat_audit_run`.

Pass `auditRunId` on `update_published_question_stem`.

Draft/in-review stems skip this step. Loop or fan-out them with `get_ucat_content` → [STEM.md](STEM.md) → `update_question_stem`.

**Done when:** published targets are claimed through a started run, or there are no published targets.

## 5. Fan-out prompt

Each subagent gets: this skill folder path, the stem id, status, `auditRunId` if any, and the instruction to read [STEM.md](STEM.md) and return one outcome object. It does not get the rest of the selector.

**Done when:** every stem has an outcome object.

## 6. Report

Counts at the top: `updated`, `unchanged`, `suggest_delete`, `suggest_split`, `failed`.

Then one line per stem: `stemId`, section, status, outcome, and a one-line why unless the outcome is a quiet `unchanged` or a quiet `updated` that only filled blanks. `suggest_delete` / `suggest_split` must say question vs whole stem, and why.

Outcome values:

- `updated` — writes applied
- `unchanged` — already good
- `suggest_delete` — irrecoverable; no MCP delete
- `suggest_split` — questions bundled on the wrong stem, and a new live stem could not be created (published)
- `failed` — MCP or revision error after retry

**Done when:** every resolved stem has a line, and delete/split suggestions are actionable without opening the MCP payload.