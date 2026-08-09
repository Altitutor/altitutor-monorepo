# Issue tracker: Obsidian (Altitutor)

Issues and specs for this repo live as Markdown notes in the local Obsidian vault
(synced via Obsidian Sync — not git). Agents edit these files on disk by absolute path.

## Location

- Vault area: `/Users/matthewchua/Documents/Matt Remote/Areas/Altitutor/`
- Issues folder: `/Users/matthewchua/Documents/Matt Remote/Areas/Altitutor/Issues/`
- Bases board: `/Users/matthewchua/Documents/Matt Remote/Areas/Altitutor/Altitutor Issues.base`
- Human workflow doc: `/Users/matthewchua/Documents/Matt Remote/Areas/Altitutor/Issue Workflow.md`

One issue = one `.md` file with YAML frontmatter. The filename is the title (no separate `title` property). Prefer `ALTI-N - slug.md` when an id exists; newer notes may omit the prefix until assigned.

## Frontmatter conventions

```yaml
id: ALTI-123
status: Ready to Implement
priority: High
estimate:
due:
labels: []
linear_url:
branch:
codex_ready: true
grilled: true
better_at_computer: false
created: 2026-06-28
```

### Kanban `status` values

`Inbox` · `Triage` · `Icebox` · `Backlog` · `Needs Grill` · `Ready to Implement` · `In Progress` · `In Review` · `Ready to Merge` · `Done`

### Priority values

`Urgent` · `High` · `Medium` · `Low` · `No priority`

### Triage roles

The five canonical triage roles live in `labels` (see `docs/agents/triage-labels.md`). They are queue roles, not a replacement for kanban `status`. When a skill applies a triage role, add/remove that string in `labels` and, when the mapping is clear, also move `status`:

| Triage role | Typical `status` move |
| --- | --- |
| `needs-triage` | `Triage` |
| `needs-info` | `Needs Grill` (or leave status; waiting on human) |
| `ready-for-agent` | `Ready to Implement` (+ `codex_ready: true`, `grilled: true`) |
| `ready-for-human` | keep/refine; often `Ready to Implement` with `better_at_computer: true` |
| `wontfix` | `Icebox` or `Done` with a short rationale in the body |

## Creating a new issue

Prefer the existing helpers (they assign the next `ALTI-N`):

```bash
python3 ~/Documents/matthews-obsidian-vault/_scripts/new_altitutor_issue.py \
  "Add support for X" \
  --status "Backlog" \
  --priority "Medium" \
  --labels "ucat,frontend"
```

If creating a file directly under `Issues/`, include the frontmatter keys above, set `status: Backlog` (or `Inbox`), set `created` to today, and leave `id` blank only if you cannot run the script — otherwise run the script so ids stay sequential.

## When a skill says "publish to the issue tracker"

Create a new note under the Issues folder (via the script when possible). Do not create GitHub or Linear issues unless the user explicitly asks.

## When a skill says "fetch the relevant ticket"

Read the issue `.md` at the given path or resolve `ALTI-N` by scanning filenames / `id:` frontmatter under the Issues folder.

## Wayfinding operations

Used by `/wayfinder`. Represent the **map** and **child tickets** as Obsidian notes in the Issues folder (or a dedicated subfolder if one is introduced later):

- **Map**: a note whose body holds Notes / Decisions-so-far / Fog; put `wayfinder:map` in `labels`.
- **Child ticket**: a separate issue note with `wayfinder:<type>` in `labels` (`research` / `prototype` / `grilling` / `task`) and a `Part of: ALTI-N` (or path) line near the top linking to the map.
- **Blocking**: a `Blocked by: ALTI-N, ALTI-N` line near the top. Unblocked when every listed blocker has `status: Done`.
- **Frontier**: open children that are unblocked and unclaimed; lowest `ALTI-N` wins.
- **Claim**: set `status: In Progress` and record `branch` if known.
- **Resolve**: append the answer under `## Answer`, set `status: Done`, then append a context pointer to the map's Decisions-so-far.
