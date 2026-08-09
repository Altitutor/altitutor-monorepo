# UCAT response-contract migration

This plan separates Question stem category, Response type, and Answer scheme across the UCAT codebase. It is intentionally staged: the final model is clean, but deployed clients and persisted attempts remain readable while data is moving.

## Target model

- `question_stems.question_stem_category_id` remains taxonomy and set-composition metadata.
- `ucat_questions.response_type` is `multiple_choice | drag_and_drop`.
- `ucat_questions.answer_scheme` is one of `single_choice`, `situational_judgement_rating`, `decision_making_binary_placement`, or `situational_judgement_most_least`.
- Answer options carry an explicit key value: `correct | yes | no | most | least | null`.
- Compound candidate answers use the canonical `ucat_response_v1` snapshot.
- A shared pure response-contract module owns definition validation, blank state, completeness, persistence normalization, scoring, maximum score, and review projection. Category names never select runtime behavior.
- `presentation_format` is optional stem metadata: `passage | table | graph_or_chart | diagram_or_image | mixed | other`.

## Release 1: expand and backfill foundations

1. Add the new response columns, key representation, presentation metadata, category rows, blueprint tables, and mock blueprint reference without removing legacy fields.
2. Add database constraints for valid Response type and Answer scheme pairs and scheme-specific answer-key cardinality.
3. Implement the shared response-contract module test-first and adapt current multiple-choice, SJT rating, and DM binary placement behavior to it.
4. Dual-read legacy and new persisted forms. New writes populate the canonical columns and snapshot.
5. Deterministically map all existing `syllogism` questions—including soft-deleted rows—to `drag_and_drop + decision_making_binary_placement`, converting Boolean keys to `yes | no`.
6. Backfill every `syllogism_v1` attempt into `ucat_response_v1`, including content snapshots, and verify zero unconverted records before proceeding.
7. Run an offline classifier over every current DM Syllogisms stem. It reuses the parser's pure evidence extraction but emits an explicit stable-ID mapping for human review; response type and answer pattern are never used as category evidence.
8. Leave new SJT Most/Least publication disabled until its complete authoring, rendering, persistence, and marking path is deployed.

## Release 2: activate every surface

1. Replace parser coupling with: structural parse, untyped answer-evidence parse, independent category/Response type/Answer scheme inference, then conflict reconciliation.
2. Support combined documents, separate documents, pasted answer tables, OCR/manual recovery, AI generation/import, MCP operations, previews, and deterministic publication gates.
3. Add the official DM category `Interpreting Information and Drawing Conclusions` and SJT category `Most/Least Appropriate`; apply the reviewed DM stable-ID mapping.
4. Generalise the tutor editor and import review UI. Category changes provide explicit suggested defaults but never reset an existing response contract or answer key silently.
5. Render both placement schemes with physical pointer/touch dragging on exam-like student and preview surfaces.
6. Route student state, autosave, final submission, marking, progress denominators, results, tutor review, analytics, PDF/export, and publication through the shared response contract.
7. Activate SJT Most/Least with exactly three actions and two distinct required placements. Keep its provisional scoring policy isolated in its Answer scheme implementation.
8. Add the immutable 2026 full-mock blueprint, range-aware whole-stem builder, compliance UI, and publication gate. Focused practice sets remain exempt.
9. Produce a read-only eligibility report for legacy mocks. Do not mutate shared sets or attach a blueprint automatically when any classification is unresolved.

## Release 3: contract legacy representation

Proceed only after production verification reports zero legacy question rows, answer keys, answer snapshots, content snapshots, API payloads, and active client writes.

1. Remove `question_type`, `is_answer`, the old enum value, legacy JSON casts, and `syllogism_v1` readers.
2. Remove all category-driven renderer, scoring, progress, validation, and authoring branches.
3. Rename generic UI/state/API symbols that still use `syllogism` only to mean the former response type. Preserve genuine syllogism category, teaching, parser-classification, and skill-trainer terminology.
4. Regenerate Supabase types and delete compatibility-only tests after canonical history tests prove the backfill.

## Verification gates

- Local Supabase reset, database lint, generated types, unit/integration tests, lint, typecheck, and production build pass with zero warnings.
- Golden response-contract fixtures cover valid, blank, incomplete, malformed, partial-credit, and review behavior for every Answer scheme.
- SQL and TypeScript publication checks agree on persisted structural invariants.
- Production reports show no category/Response type mismatches, no invalid answer keys, no unconverted snapshots, and no blueprint attached without a passing audit.
- Search-based checks distinguish response-type references that must disappear from genuine semantic `Syllogisms` references that must remain.

## Difficulty

The enum rename by itself is medium and mechanical. The complete migration is high difficulty because the old `syllogism` value currently controls rendering, answer shape, snapshots, scoring, progress weighting, publication gates, importing, authoring, and analytics. The staged design contains that risk and produces a cleaner final model without permanently carrying legacy compatibility.
