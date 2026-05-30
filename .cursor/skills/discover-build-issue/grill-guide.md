# Discovery & grill guide

Used in **Phase 2** of `discover-build-issue`. Adapted from [grill-with-docs](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/SKILL.md).

## Core behavior

Interview relentlessly until shared understanding. Walk the design tree branch by branch. For each question, provide a **recommended answer** from codebase exploration.

**One question at a time.** Wait for feedback before continuing.

If the answer is in the repo, **explore first** — do not ask the user to repeat what code already shows.

## Codebase exploration checklist

Run what applies before the first grill question:

| Area | Where to look |
|------|----------------|
| Feature UI | `apps/*/src/features/`, `packages/ui/` |
| API / data | `features/*/api/`, TanStack Query hooks |
| DB / RLS | `supabase/migrations/`, `docs/database/`, `vstudent_*` / `vtutor_*` views |
| Types | `packages/shared/src/supabase/generated.ts` |
| Rules | `.cursor/rules/` (RLS, migrations, testing, Next.js) |
| Similar feature | Grep for domain nouns from the issue title |

## During the session

### Challenge glossary

If `CONTEXT.md` or `CONTEXT-MAP.md` exists, read it first. When the user uses a term that conflicts, call it out: *"CONTEXT.md defines X as … but you seem to mean Y — which is it?"*

If no `CONTEXT.md` exists, create one **lazily** when the first project-specific term is resolved (not general programming terms). Glossary only — no implementation detail.

### Sharpen fuzzy language

*"You're saying 'account' — do you mean Student profile or Auth user? Those differ here."*

### Concrete scenarios

Invent edge-case scenarios to force precise boundaries:

- *"Student has two enrollments — which billing view should show?"*
- *"Tutor cancels within 24h of class — refund or credit?"*

### Cross-reference code

When the user states behavior, verify in code. Surface mismatches:

*"Code cancels the whole enrollment; you described partial subject removal — which is correct?"*

### Decision log format

Maintain in the conversation (and optionally in a Linear comment if pausing):

```markdown
| Topic | Status | Resolution |
|-------|--------|------------|
| Refund policy | ? | |
| Affected app | ✓ | student-web |
```

Status: `?` open, `✓` resolved.

### ADRs (sparingly)

Offer `docs/adr/` only when **all** are true:

1. Hard to reverse
2. Surprising without context
3. Real trade-off with alternatives considered

Otherwise skip.

## Question quality

**Good:** "Should tutors see cancelled classes in the default list, or only via a filter? I'd default to hidden (matches `classes/index.tsx` filtering active only)."

**Bad:** "Any preferences for the UI?"

Prioritize questions that **unlock AC** or **prevent wrong-layer work** (wrong app, wrong table, wrong role).

## When to stop grilling

Stop when:

- AC is testable without assumptions
- Scope boundaries are explicit
- No `?` rows remain in the decision log
- User confirms Gate A summary
