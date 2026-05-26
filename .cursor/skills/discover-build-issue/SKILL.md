---
name: discover-build-issue
description: >-
  End-to-end Linear issue workflow: fetch issue, discover requirements via
  codebase exploration and one-at-a-time grilling, update Linear with a
  implementation-ready spec, then implement with tests and quality checks. Use
  when the user wants to take a Linear issue from vague or partial spec through
  to shipped code, or says discover-build-issue, grill and build, or refine
  then implement ALT-123.
disable-model-invocation: true
---

# Discover & Build Issue

Take a Linear issue from **unknown or partial intent** → **shared understanding** → **implementation-ready spec** → **working code**.

Chains patterns from `write-issue`, `build-issue`, and [grill-with-docs](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/SKILL.md). Use sibling skills only when the user wants a subset: `/write-issue` (spec only), `/start-issue` (branch/PR), `/build-issue` (implement only).

## Monorepo context

- **Stack**: React 18, TypeScript, Tailwind, TanStack Query, Zustand, Supabase
- **Apps**: `admin-web` (3000), `student-web` (3001), `tutor-web` (3002), `student-app` (Expo)
- **Packages**: `shared`, `ui` — **Structure**: `apps/*/src/features/`, `supabase/`, `.cursor/rules/`
- **Linear MCP**: `get_issue`, `save_issue`, `list_comments` on server `user-Linear (Altitutor)`

## Phases (do not skip gates)

```
Linear issue → Assess → Discover → Gate A → Spec → Gate B → Build → Gate C
```

| Phase | Goal | Stop if |
|-------|------|---------|
| **0. Intake** | Issue ID, fetch Linear | API fails → ask user to paste issue |
| **1. Assess** | Classify spec richness | — |
| **2. Discover** | Shared understanding | User says stop / spec-only |
| **Gate A** | User confirms understanding | No → return to Discover |
| **3. Spec** | Update Linear description | User rejects draft |
| **Gate B** | User approves implementation plan | No → revise plan |
| **4. Build** | Code + tests + quality | Breaking change without approval |
| **Gate C** | `pnpm checkall` passes | Fix until green |

---

## Phase 0: Intake

1. Get issue ID (`ALT-123`) if not provided.
2. `get_issue` with `includeRelations: true`.
3. `list_comments` for clarifications.
4. Capture: title, description, status, labels, project, branch name, assignee, relations.

---

## Phase 1: Assess spec richness

| Level | Signals | Discover intensity |
|-------|---------|-------------------|
| **Sparse** | Title only or &lt;3 sentences, no AC | Heavy: explore first, many grill questions |
| **Partial** | Intent clear, AC or scope fuzzy | Medium: targeted questions + code cross-check |
| **Full** | AC, scope, technical hints | Light: validate against code, confirm edge cases |

Post a short **Issue snapshot** (title, richness level, what's missing).

---

## Phase 2: Discover (grill + explore)

Read [grill-guide.md](grill-guide.md) and follow it strictly.

**Rules:**

- **One question at a time.** Wait for the user before the next question.
- **Explore before asking** when the answer is likely in the repo (`.cursor/rules/`, `features/`, migrations, `vstudent_*` / `vtutor_*` views).
- Each question includes a **recommended answer** based on codebase findings.
- Cross-check user claims against code; surface contradictions immediately.
- Track decisions in a running **Decision log** (term → resolution). Update `CONTEXT.md` only for project-specific domain terms — see grill-guide.

**Sparse issues — minimum topics to resolve:**

1. Problem / user outcome (why now?)
2. In scope vs out of scope
3. Affected app(s) and surfaces
4. Acceptance criteria (testable)
5. Edge cases and error behavior
6. Data / auth / RLS implications (if any)
7. Dependencies or blocking issues

**End Discover when:** Decision log has no open `?` items and you can draft AC without guessing.

---

## Gate A: Shared understanding

Post **Understanding summary**:

```markdown
## Understanding — {issue_id}

### Problem
{one paragraph}

### Scope
- In: ...
- Out: ...

### Acceptance criteria
- [ ] ...

### Technical approach (high level)
{backend / frontend / fullstack — no file-level detail yet}

### Decisions
| Topic | Decision |
|-------|----------|

### Open risks
- ...
```

Ask: **"Does this match your intent? (yes / adjust / spec-only)"**

- **adjust** → one clarifying question, update summary, ask again
- **spec-only** → Phase 3 only, then stop
- **yes** → Phase 3

---

## Phase 3: Spec (update Linear)

Draft description using [issue-spec-template.md](issue-spec-template.md). Include paths from codebase search (not line-by-line dumps).

1. Show draft to user.
2. On approval, `save_issue` with `id` and full `description`.
3. Add labels: `frontend` | `backend` | `fullstack`, plus `needs-tests` / `breaking-change` if applicable.

**Success:** Another agent could implement without further product questions.

---

## Gate B: Implementation plan

Before coding, show plan (from `build-issue`):

```markdown
## Implementation plan — {issue_id}

### Overview
...

### Changes (ordered)
1. **{area}** — {action} — {rationale}

### Testing strategy
- Unit: ...
- Manual E2E: ...

### Risks / breaking changes
...
```

Ask: **"Proceed with implementation? (yes / adjust)"**

If no branch exists, offer `/start-issue` or create branch per `start-issue` skill.

---

## Phase 4: Build

Follow `.cursor/skills/build-issue/SKILL.md` from step 5 onward:

- context7 MCP for library docs before unfamiliar APIs
- TDD preferred; backend-before-frontend when both apply
- Incremental commits: `feat:` / `fix:` / `test:` with `ref {issue_id}`
- After major edits: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- Final: `pnpm checkall`
- E2E instructions for the user
- Stop for approval on breaking changes

---

## Gate C: Done

```markdown
## Complete — {issue_id}

### Linear
{link or id} — description updated

### Commits
- {sha}: {message}

### Quality
- [x] lint, typecheck, test, build

### Manual verification
{scenarios from build-issue}

### Next
- `/close-issue` when E2E passes
```

---

## Error handling

| Failure | Action |
|---------|--------|
| Linear MCP unavailable | User pastes issue; continue Discover |
| Issue not found | Verify ID format `[A-Z]+-\d+` |
| No related code | Ask for similar feature pointer |
| User wants to pause | Save Decision log + partial spec in a Linear comment via `save_comment` |

---

## Anti-patterns

- Asking five questions in one message during Discover
- Implementing before Gate A or Gate B
- Updating Linear without user seeing the draft
- Skipping `pnpm checkall` at the end
- Using `any` in new code
