# ALTI-540 Decision Making category audit

This is a read-only snapshot of every production Decision Making stem currently
categorised as `Syllogisms`. The machine-readable evidence is in
`alti-540-dm-category-audit-2026-08-10.json`.

## Snapshot

- 337 stems: 299 active and 38 stem-deleted.
- 337 questions: 299 active and 38 soft-deleted.
- 135 strong `Syllogisms` suggestions.
- 43 strong `Interpreting Information and Drawing Conclusions` suggestions.
- 159 weak, absent, or conflicting classifications requiring human review.

The report contains stable stem/question IDs, lifecycle state, publication
status, observed rich presentation formats, rich node and asset metadata,
semantic excerpts, formal-premise and
factual/data signals, confidence, evidence, and conflicts. Signed asset URLs and
tokens are deliberately excluded. `declaredPresentationFormat` is null because
the read-only production schema predates that expansion column; observed format
metadata is derived and reported separately, and is never category evidence.

## Review gate

Do not generate the category migration from interaction shape, Response type,
Answer scheme, or answer keys. A human reviewer must:

1. approve or correct every proposed move;
2. decide every row where `requiresHumanReview` is `true`, inspecting the source
   image where semantic text is insufficient; and
3. produce a complete stable-ID mapping for the immutable migration.

Until that mapping is approved, no production mutation is authorised and
ALTI-540 cannot satisfy its migration or post-migration acceptance criteria.

## Regeneration

With the read-only production environment configured for `tutor-web`:

```sh
pnpm --filter tutor-web audit:ucat-dm-categories \
  ../../docs/audits/alti-540-dm-category-audit-2026-08-10.json
```

The command performs GET requests only. It does not call database write APIs or
apply migrations.
