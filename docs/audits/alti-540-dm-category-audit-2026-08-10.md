# ALTI-540 Decision Making category audit

This audit covers every Decision Making stem categorised as `Syllogisms` in the
configured development project and the production project. The original
machine-readable development evidence is in
`alti-540-dm-category-audit-2026-08-10.json`; production evidence is in
`alti-540-dm-category-audit-prod-2026-08-10.json`.

## Source snapshots

- Development (`ysfslbdcacpbemodkwtl`): 337 stems, comprising 299 active and
  38 stem-deleted rows.
- Production (`mzgunxjfgvcyivcyqimn`): 251 stems, comprising 233 active and
  18 stem-deleted rows.
- The projects share 174 stable IDs; development has 163 additional IDs and
  production has 77 additional IDs.

The report contains stable stem/question IDs, lifecycle state, publication
status, observed rich presentation formats, rich node and asset metadata,
semantic excerpts, formal-premise and
factual/data signals, confidence, evidence, and conflicts. Signed asset URLs and
tokens are deliberately excluded. `declaredPresentationFormat` is null because
the read-only production schema predates that expansion column; observed format
metadata is derived and reported separately, and is never category evidence.

## Reviewed result

The complete, stable-ID decision record is in
`alti-540-dm-category-reviewed-mapping-2026-08-10.json`. The review applied the
approved semantic rules without reading Response type, Answer scheme, answer
keys, or interaction shape.

- Development after migration: 199 Syllogisms, 134 Interpreting Information and
  Drawing Conclusions, 3 Probabilistic and Statistical Reasoning, and one
  approved garbage-stem quarantine.
- Production after migration: 135 Syllogisms, 112 Interpreting Information and
  Drawing Conclusions, and 4 Probabilistic and Statistical Reasoning.
- Three shared-ID reviewer disagreements were resolved to production semantics;
  all three are applied schedule or business-condition problems and therefore
  Interpreting Information and Drawing Conclusions.
- No active published row remains unresolved. The reviewed report contains no
  response/category coupling evidence because response-contract fields were
  excluded from both audit inputs and the migration decision process.

The immutable migration updates only matching stable IDs when deployed through
CI/CD. No remote database was changed during this audit.

## Regeneration

With the intended read-only environment configured for `tutor-web`:

```sh
pnpm --filter tutor-web audit:ucat-dm-categories \
  ../../docs/audits/alti-540-dm-category-audit-2026-08-10.json
```

The command performs GET requests only. It does not call database write APIs or
apply migrations.
